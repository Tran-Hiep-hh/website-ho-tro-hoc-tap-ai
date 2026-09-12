import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import pg from "pg";
import { env } from "../src/config/env.js";
import { createApp } from "../src/app.js";
import { createAuthRepository } from "../src/repositories/authRepository.js";

const schema = `classes_test_${randomUUID().replaceAll("-", "")}`;
const database = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL ?? env.databaseUrl, options: `-c search_path=${schema}`, connectionTimeoutMillis: 5000 });
let server, base, storage, created = false;
const accounts = [];
before(async () => {
  await database.query(`CREATE SCHEMA ${schema}`); created = true;
  await database.query(await readFile(new URL("../../database/init.sql", import.meta.url), "utf8"));
  const migration = await readFile(new URL("../../database/migrations/005_classes.sql", import.meta.url), "utf8");
  await database.query(migration); await database.query(migration);
  storage = await mkdtemp(path.join(tmpdir(), "study-classes-test-"));
  server = createApp({ authRepository: createAuthRepository(database), documentDatabase: database, documentStorageRoot: storage }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
  for (const [i, role] of ["TEACHER", "TEACHER", "STUDENT", "STUDENT"].entries()) {
    const body = { fullName: `Người dùng ${i}`, email: `classes${i}@example.com`, role, password: "Classes-test-123", confirmPassword: "Classes-test-123" };
    assert.equal((await fetch(`${base}/auth/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).status, 201);
    const login = await fetch(`${base}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await login.json(); accounts.push({ token: result.accessToken, user: result.user });
  }
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (created && /^classes_test_[a-f0-9]{32}$/.test(schema)) await database.query(`DROP SCHEMA ${schema} CASCADE`);
  await database.end();
  if (storage && path.dirname(storage) === path.resolve(tmpdir()) && path.basename(storage).startsWith("study-classes-test-")) await rm(storage, { recursive: true, force: true });
});
async function call(route, method = "GET", body, who = 0) {
  const response = await fetch(`${base}${route}`, { method, headers: { Authorization: `Bearer ${accounts[who].token}`, "Content-Type": "application/json" }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, ...await response.json() };
}
async function classroom() {
  const result = await call("/classes", "POST", { name: "Cơ sở dữ liệu", group: "67PM2", description: "Lớp thử" });
  assert.equal(result.status, 201);
  return (await call("/classes")).classes.find((item) => item.id === result.id);
}
async function document(who = 0) {
  const form = new FormData(); form.append("file", new Blob(["Nội dung lớp học"]), "lesson.txt");
  const response = await fetch(`${base}/documents`, { method: "POST", headers: { Authorization: `Bearer ${accounts[who].token}` }, body: form });
  assert.equal(response.status, 201); return (await response.json()).document;
}
test("Classes enforce roles, ownership and field validation", async () => {
  assert.equal((await fetch(`${base}/classes`)).status, 401);
  assert.equal((await call("/classes", "POST", { name: "Không được tạo" }, 2)).status, 403);
  assert.equal((await call("/classes", "POST", { name: " " })).status, 400);
  const cls = await classroom();
  assert.match(cls.code, /^[A-F0-9]{10}$/);
  assert.equal((await call(`/classes/${cls.id}`, "PUT", { name: "Chiếm lớp" }, 1)).status, 404);
  assert.equal((await call(`/classes/${cls.id}`, "DELETE", {}, 1)).status, 404);
  assert.equal((await call("/classes", "GET", undefined, 1)).classes.length, 0);
  assert.equal((await call(`/classes/${cls.id}`, "PUT", { name: "Đã sửa", group: "Nhóm mới" })).status, 200);
  assert.equal((await call("/classes")).classes.find((item) => item.id === cls.id).name, "Đã sửa");
});
test("Pending requests cannot read materials; approval grants read-only access and leaving revokes it", async () => {
  const cls = await classroom(), doc = await document(), foreign = await document(1);
  assert.equal((await call(`/classes/${cls.id}/materials`, "POST", { documentIds: [foreign.id] })).status, 400);
  assert.equal((await call(`/classes/${cls.id}/materials`, "POST", { documentIds: [doc.id], contentIds: [1] })).status, 400);
  assert.equal((await call(`/classes/${cls.id}/materials`, "POST", { documentIds: [doc.id] })).status, 200);
  assert.equal((await call(`/classes/${cls.id}/materials`, "POST", { documentIds: [doc.id] })).status, 200);
  assert.equal((await call(`/documents/${doc.id}`, "DELETE", {})).status, 409);
  const lookup = await call("/classes/lookup", "POST", { code: cls.code.toLowerCase() }, 2);
  assert.equal(lookup.classroom.id, cls.id); assert.deepEqual(lookup.classroom.materialIds, []);
  assert.equal((await call(`/classes/${cls.id}/join`, "POST", { code: "WRONG" }, 2)).status, 404);
  const simultaneous = await Promise.all([call(`/classes/${cls.id}/join`, "POST", { code: cls.code }, 2), call(`/classes/${cls.id}/join`, "POST", { code: cls.code }, 2)]);
  assert.deepEqual(simultaneous.map((r) => r.status).sort(), [201, 409]);
  const pending = await call("/classes", "GET", undefined, 2);
  assert.equal(pending.classes.find((item) => item.id === cls.id).pending, true);
  assert.deepEqual(pending.documents, []); assert.deepEqual(pending.members, []);
  assert.equal((await call(`/documents/${doc.id}`, "GET", undefined, 2)).status, 404);
  const req = (await call("/classes")).requests.find((item) => item.classId === cls.id);
  assert.equal((await call(`/classes/${cls.id}/requests/${req.id}`, "POST", { approve: true }, 1)).status, 404);
  assert.equal((await call(`/classes/${cls.id}/requests/${req.id}`, "POST", { approve: true })).status, 200);
  assert.equal((await call(`/classes/${cls.id}/requests/${req.id}`, "POST", { approve: true })).status, 409);
  const joined = await call("/classes", "GET", undefined, 2);
  assert.equal(joined.documents.length, 1); assert.equal(joined.documents[0].id, doc.id);
  assert.equal((await call("/documents", "GET", undefined, 2)).documents.length, 0);
  assert.equal((await call(`/documents/${doc.id}`, "DELETE", {}, 2)).status, 404);
  const download = await fetch(`${base}/documents/${doc.id}/download`, { headers: { Authorization: `Bearer ${accounts[2].token}` } });
  assert.equal(download.status, 200); assert.equal(await download.text(), "Nội dung lớp học");
  assert.equal((await call(`/documents/${doc.id}`, "GET", undefined, 3)).status, 404);
  assert.equal((await call(`/classes/${cls.id}/leave`, "POST", {}, 2)).status, 200);
  assert.equal((await call(`/documents/${doc.id}/download`, "GET", undefined, 2)).status, 404);
  assert.equal((await call(`/classes/${cls.id}`, "DELETE", {})).status, 200);
  assert.equal((await call(`/documents/${doc.id}`, "DELETE", {})).status, 200);
});
test("Rejected students may reapply; removal and unsharing revoke access", async () => {
  const cls = await classroom(), doc = await document();
  for (const approve of [false, true]) {
    assert.equal((await call(`/classes/${cls.id}/join`, "POST", { code: cls.code }, 3)).status, 201);
    const req = (await call("/classes")).requests.find((item) => item.classId === cls.id);
    assert.equal((await call(`/classes/${cls.id}/requests/${req.id}`, "POST", { approve })).status, 200);
  }
  await call(`/classes/${cls.id}/materials`, "POST", { documentIds: [doc.id] });
  assert.equal((await call(`/documents/${doc.id}`, "GET", undefined, 3)).status, 200);
  await call(`/classes/${cls.id}/materials/${doc.id}`, "DELETE", {});
  assert.equal((await call(`/documents/${doc.id}`, "GET", undefined, 3)).status, 404);
  await call(`/classes/${cls.id}/materials`, "POST", { documentIds: [doc.id] });
  const member = (await call("/classes")).members.find((item) => item.classId === cls.id);
  assert.equal((await call(`/classes/${cls.id}/members/${member.id}`, "DELETE", {})).status, 200);
  assert.equal((await call(`/documents/${doc.id}`, "GET", undefined, 3)).status, 404);
  assert.ok(!(await call("/classes", "GET", undefined, 3)).classes.some((item) => item.id === cls.id));
});
test("Active class quizzes block leaving, removing members and deleting the class", async () => {
  const cls = await classroom();
  await call(`/classes/${cls.id}/join`, "POST", { code: cls.code }, 2);
  const req = (await call("/classes")).requests.find((item) => item.classId === cls.id);
  await call(`/classes/${cls.id}/requests/${req.id}`, "POST", { approve: true });
  const member = (await call("/classes")).members.find((item) => item.classId === cls.id);
  const { rows: contents } = await database.query("INSERT INTO generated_contents(owner_id,content_type,title,difficulty,status) VALUES ($1,'QUIZ','Quiz thử','EASY','READY') RETURNING content_id", [accounts[0].user.userId]);
  const { rows: versions } = await database.query("INSERT INTO quiz_versions(quiz_id,version_number) VALUES ($1,1) RETURNING quiz_version_id", [contents[0].content_id]);
  await database.query("INSERT INTO quiz_assignments(class_id,quiz_version_id,title,start_at,due_at,max_attempts) VALUES ($1,$2,'Quiz đang diễn ra',NOW()-INTERVAL '1 hour',NOW()+INTERVAL '1 hour',1)", [cls.id, versions[0].quiz_version_id]);
  assert.equal((await call(`/classes/${cls.id}/leave`, "POST", {}, 2)).status, 409);
  assert.equal((await call(`/classes/${cls.id}/members/${member.id}`, "DELETE", {})).status, 409);
  assert.equal((await call(`/classes/${cls.id}`, "DELETE", {})).status, 409);
  await database.query("UPDATE quiz_assignments SET status='CANCELLED' WHERE class_id=$1", [cls.id]);
  assert.equal((await call(`/classes/${cls.id}/leave`, "POST", {}, 2)).status, 200);
  assert.equal((await call(`/classes/${cls.id}`, "DELETE", {})).status, 200);
});
