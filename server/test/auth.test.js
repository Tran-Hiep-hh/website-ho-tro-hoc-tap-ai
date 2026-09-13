import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import pg from "pg";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

process.env.NODE_ENV = "test";
const { env } = await import("../src/config/env.js");
const { createApp } = await import("../src/app.js");
const { createAuthRepository } = await import("../src/repositories/authRepository.js");
const schema = `auth_test_${randomUUID().replaceAll("-", "")}`;
const connectionString = process.env.TEST_DATABASE_URL ?? env.databaseUrl;
const admin = new pg.Pool({ connectionString, connectionTimeoutMillis: 5000 });
const database = new pg.Pool({ connectionString, options: `-c search_path=${schema}`, connectionTimeoutMillis: 5000 });
let server, baseUrl, created = false;
const password = "Study-test-password-123";

async function call(path, { method = "POST", body = {}, cookie, token, headers = {} } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    ...(method === "GET" ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });
  return { status: response.status, data: await response.json(), headers: response.headers,
    cookie: response.headers.get("set-cookie")?.split(";")[0] };
}

async function account(role = "STUDENT") {
  const input = { fullName: "  Nguyễn   An  ", email: `test-${randomUUID()}@example.com`, password, confirmPassword: password, role };
  const registered = await call("/register", { body: input });
  assert.equal(registered.status, 201);
  return { input, user: registered.data.user };
}
const signIn = (input) => call("/login", { body: { email: input.email, password: input.password } });

before(async () => {
  await admin.query(`CREATE SCHEMA ${schema}`);
  created = true;
  await database.query(await readFile(new URL("../../database/init.sql", import.meta.url), "utf8"));
  const migration = await readFile(new URL("../../database/migrations/001_auth.sql", import.meta.url), "utf8");
  await database.query(migration);
  await database.query(migration);
  server = createApp({ authRepository: createAuthRepository(database) }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api/auth`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await database.end();
  if (created && /^auth_test_[a-f0-9]{32}$/.test(schema)) await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
});

test("registers both roles, normalizes identity and stores only a password hash", async () => {
  for (const role of ["STUDENT", "TEACHER"]) {
    const { input, user } = await account(role);
    assert.equal(user.role, role);
    assert.equal(user.fullName, "Nguyễn An");
    assert.deepEqual(Object.keys(user).sort(), ["email", "fullName", "role", "userId"]);
    const { rows } = await database.query("SELECT password_hash, status FROM users WHERE user_id=$1", [user.userId]);
    assert.notEqual(rows[0].password_hash, password);
    assert.equal(await bcrypt.compare(password, rows[0].password_hash), true);
    assert.equal(rows[0].status, "ACTIVE");
    const duplicate = await call("/register", { body: { ...input, email: ` ${input.email.toUpperCase()} ` } });
    assert.equal(duplicate.status, 409);
    assert.ok(duplicate.data.errors.email);
  }
});

test("rejects invalid fields, elevated roles, mismatched confirmation and bcrypt truncation", async () => {
  const invalid = await call("/register", { body: { fullName: "A", email: "bad", password: "short", confirmPassword: "other", role: "ADMIN" } });
  assert.equal(invalid.status, 400);
  assert.deepEqual(Object.keys(invalid.data.errors).sort(), ["confirmPassword", "email", "fullName", "password", "role"]);
  const tooLong = "ệ".repeat(25);
  const long = await call("/register", { body: { fullName: "An Nguyễn", email: "long@example.com", password: tooLong, confirmPassword: tooLong, role: "STUDENT" } });
  assert.equal(long.status, 400);
  assert.ok(long.data.errors.password);
  assert.equal((await call("/register", { body: { email: {}, password: [] } })).status, 400);
});

test("rejects incorrect passwords and blocked/inactive accounts", async () => {
  const { input, user } = await account();
  const wrong = await signIn({ ...input, password: "wrong-password" });
  const missing = await signIn({ ...input, email: "missing@example.com" });
  assert.equal(wrong.status, 401);
  assert.equal(missing.status, 401);
  assert.equal(wrong.data.message, missing.data.message);
  for (const status of ["BLOCKED", "INACTIVE"]) {
    await database.query("UPDATE users SET status=$1 WHERE user_id=$2", [status, user.userId]);
    assert.equal((await signIn(input)).status, 403);
  }
});

test("login, me, refresh rotation and logout revoke access immediately", async () => {
  const { input, user } = await account("TEACHER");
  const login = await signIn(input);
  assert.equal(login.status, 200);
  assert.equal(login.data.user.role, "TEACHER");
  assert.equal(login.data.refreshToken, undefined);
  assert.equal(login.headers.get("cache-control"), "no-store");
  assert.match(login.headers.get("set-cookie"), /HttpOnly/);
  assert.match(login.headers.get("set-cookie"), /SameSite=Lax/);
  assert.match(login.headers.get("set-cookie"), /Path=\/api\/auth/);
  const rawRefresh = decodeURIComponent(login.cookie.split("=")[1]);
  const { rows } = await database.query("SELECT token_hash FROM refresh_tokens WHERE user_id=$1", [user.userId]);
  assert.match(rows[0].token_hash, /^[a-f0-9]{64}$/);
  assert.notEqual(rows[0].token_hash, rawRefresh);
  assert.equal((await call("/me", { method: "GET", token: login.data.accessToken })).status, 200);
  assert.equal((await call("/me", { method: "GET", token: rawRefresh })).status, 401);
  const refreshed = await call("/refresh", { cookie: login.cookie });
  assert.equal(refreshed.status, 200);
  assert.notEqual(refreshed.cookie, login.cookie);
  assert.equal((await call("/refresh", { cookie: login.cookie })).status, 401);
  const signedOut = await call("/logout", { cookie: refreshed.cookie, token: refreshed.data.accessToken });
  assert.equal(signedOut.status, 200);
  assert.match(signedOut.headers.get("set-cookie"), /Expires=Thu, 01 Jan 1970/);
  for (const token of [login.data.accessToken, refreshed.data.accessToken]) {
    assert.equal((await call("/me", { method: "GET", token })).status, 401);
  }
  assert.equal((await call("/refresh", { cookie: refreshed.cookie })).status, 401);
  assert.equal((await call("/logout")).status, 200);
});

test("only one concurrent refresh succeeds and a loser does not clear the new cookie", async () => {
  const { input } = await account();
  const login = await signIn(input);
  const results = await Promise.all([call("/refresh", { cookie: login.cookie }), call("/refresh", { cookie: login.cookie })]);
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 401]);
  assert.equal(results.find((r) => r.status === 401).headers.get("set-cookie"), null);
  const success = results.find((r) => r.status === 200);
  assert.equal((await call("/me", { method: "GET", token: success.data.accessToken })).status, 200);
});

test("logout affects the current session while another device stays signed in", async () => {
  const { input } = await account();
  const first = await signIn(input);
  const second = await signIn(input);
  await call("/logout", { token: first.data.accessToken });
  assert.equal((await call("/me", { method: "GET", token: first.data.accessToken })).status, 401);
  assert.equal((await call("/me", { method: "GET", token: second.data.accessToken })).status, 200);
});

test("rejects expired/tampered tokens and enforces account status on existing sessions", async () => {
  const { input, user } = await account();
  const login = await signIn(input);
  const claims = jwt.decode(login.data.accessToken);
  const expired = jwt.sign({ type: "access", sid: claims.sid }, env.jwtAccessSecret, {
    subject: claims.sub, issuer: "study-ai", audience: "study-ai-web", expiresIn: -1,
  });
  assert.equal((await call("/me", { method: "GET", token: expired })).status, 401);
  const expiredRefresh = jwt.sign({ type: "refresh", sid: claims.sid }, env.jwtRefreshSecret, {
    subject: claims.sub, issuer: "study-ai", audience: "study-ai-web", expiresIn: -1,
  });
  assert.equal((await call("/refresh", { cookie: `study_ai_refresh=${expiredRefresh}` })).status, 401);
  assert.equal((await call("/me", { method: "GET", token: `${login.data.accessToken}bad` })).status, 401);
  assert.equal((await call("/me", { method: "GET" })).status, 401);
  await database.query("UPDATE users SET status='BLOCKED' WHERE user_id=$1", [user.userId]);
  assert.equal((await call("/me", { method: "GET", token: login.data.accessToken })).status, 403);
  assert.equal((await call("/refresh", { cookie: login.cookie })).status, 401);
  await database.query("UPDATE users SET status='ACTIVE' WHERE user_id=$1", [user.userId]);
  assert.equal((await call("/logout", { token: expired })).status, 200);
  assert.equal((await call("/refresh", { cookie: login.cookie })).status, 401);
});

test("rejects cross-origin mutations, form posts and malformed JSON", async () => {
  assert.equal((await call("/logout", { headers: { Origin: "https://untrusted.example" } })).status, 403);
  assert.equal((await call("/logout", { headers: { "Content-Type": "text/plain" } })).status, 415);
  assert.equal((await call("/login", { body: "{" })).status, 400);
  assert.equal((await call("/logout", { cookie: "study_ai_refresh=%invalid" })).status, 200);
});

test("Profile updates only the authenticated user's name and preserves email and role", async () => {
  const { input, user } = await account();
  const session = await signIn(input);
  assert.equal((await call("/profile", { method: "PUT", body: { fullName: "Tên mới" } })).status, 401);
  for (const body of [{ fullName: " " }, { fullName: "a".repeat(101) }, { fullName: "Tên\0mới" }, { fullName: "Tên mới", role: "TEACHER" }, { fullName: "Tên mới", email: "other@example.com" }]) assert.equal((await call("/profile", { method: "PUT", token: session.data.accessToken, body })).status, 400);
  const result = await call("/profile", { method: "PUT", token: session.data.accessToken, body: { fullName: "  Trần   Minh Anh  " } });
  assert.equal(result.status, 200); assert.equal(result.data.user.fullName, "Trần Minh Anh");
  assert.equal(result.data.user.userId, user.userId); assert.equal(result.data.user.role, user.role); assert.equal(result.data.user.email, user.email);
  assert.equal((await call("/me", { method: "GET", token: session.data.accessToken })).data.user.fullName, "Trần Minh Anh");
  assert.equal((await call("/refresh", { cookie: session.cookie })).data.user.fullName, "Trần Minh Anh");
});
test("Password change validates credentials, hashes the new password and revokes every session", async () => {
  const { input, user } = await account();
  const first = await signIn(input), second = await signIn(input);
  const oldHash = (await database.query("SELECT password_hash FROM users WHERE user_id=$1", [user.userId])).rows[0].password_hash;
  const body = { currentPassword: password, newPassword: "Changed-password-456", confirmPassword: "Changed-password-456" };
  for (const invalid of [{ currentPassword: "incorrect" }, { newPassword: "short", confirmPassword: "short" }, { newPassword: "😀".repeat(19), confirmPassword: "😀".repeat(19) }, { confirmPassword: "mismatch" }, { newPassword: password, confirmPassword: password }]) assert.equal((await call("/password", { token: first.data.accessToken, body: { ...body, ...invalid } })).status, 400);
  assert.equal((await call("/me", { method: "GET", token: first.data.accessToken })).status, 200);
  const changed = await call("/password", { token: first.data.accessToken, body });
  assert.equal(changed.status, 200); assert.match(changed.headers.get("set-cookie"), /study_ai_refresh=;/);
  const hash = (await database.query("SELECT password_hash FROM users WHERE user_id=$1", [user.userId])).rows[0].password_hash;
  assert.notEqual(hash, body.newPassword); assert.ok(await bcrypt.compare(body.newPassword, hash));
  for (const session of [first, second]) {
    assert.equal((await call("/me", { method: "GET", token: session.data.accessToken })).status, 401);
    assert.equal((await call("/refresh", { cookie: session.cookie })).status, 401);
  }
  assert.equal(await createAuthRepository(database).createSession({ userId: user.userId, passwordHash: oldHash, sessionId: randomUUID(), tokenHash: "0".repeat(64), expiresAt: new Date(Date.now() + 60000) }), false);
  assert.equal((await signIn(input)).status, 401);
  assert.equal((await signIn({ ...input, password: body.newPassword })).status, 200);
});
test("Concurrent password changes cannot both commit", async () => {
  const { input } = await account();
  const session = await signIn(input);
  const results = await Promise.all(["New-password-one", "New-password-two"].map((next) => call("/password", { token: session.data.accessToken, body: { currentPassword: password, newPassword: next, confirmPassword: next } })));
  assert.equal(results.filter((r) => r.status === 200).length, 1);
  assert.ok(results.some((r) => [401, 409].includes(r.status)));
});
test("limits repeated login requests", async () => {
  let response;
  for (let i = 0; i < 31; i += 1) response = await call("/login");
  assert.equal(response.status, 429);
  assert.ok(Number(response.headers.get("retry-after")) > 0);
});
