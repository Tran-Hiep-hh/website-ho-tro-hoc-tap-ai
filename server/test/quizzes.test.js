import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { env } from "../src/config/env.js";
import { createApp } from "../src/app.js";
import { createAuthRepository } from "../src/repositories/authRepository.js";

const schema = `quizzes_test_${randomUUID().replaceAll("-", "")}`;
const database = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL ?? env.databaseUrl, options: `-c search_path=${schema}`, connectionTimeoutMillis: 5000 });
let server, base, created = false;
const accounts = [];
before(async () => {
  await database.query(`CREATE SCHEMA ${schema}`); created = true;
  await database.query(await readFile(new URL("../../database/init.sql", import.meta.url), "utf8"));
  const migration = await readFile(new URL("../../database/migrations/003_quizzes.sql", import.meta.url), "utf8");
  await database.query(migration); await database.query(migration);
  server = createApp({ authRepository: createAuthRepository(database), documentDatabase: database }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
  for (const role of ["STUDENT", "TEACHER"]) {
    const input = { fullName: "Người làm Quiz", email: `${role}@example.com`, role, password: "Quiz-tests-123", confirmPassword: "Quiz-tests-123" };
    const registered = await fetch(`${base}/auth/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    assert.equal(registered.status, 201);
    const response = await fetch(`${base}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    const { user, accessToken } = await response.json();
    const { rows } = await database.query("INSERT INTO source_documents(owner_id,file_name,file_type,storage_path,extracted_text,status) VALUES ($1,'source.txt','TXT','unused','Nội dung tài liệu thử nghiệm','READY') RETURNING document_id", [user.userId]);
    accounts.push({ user, token: accessToken, source: String(rows[0].document_id) });
  }
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (created && /^quizzes_test_[a-f0-9]{32}$/.test(schema)) await database.query(`DROP SCHEMA ${schema} CASCADE`);
  await database.end();
});
async function call(route = "", method = "GET", body, account = accounts[0]) {
  const response = await fetch(`${base}/quizzes${route}`, { method, headers: { Authorization: `Bearer ${account.token}`, "Content-Type": "application/json" }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, ...await response.json() };
}
async function saved() {
  const generated = await call("/generate", "POST", { title: "Quiz thử nghiệm", sources: [accounts[0].source], difficulty: "Trung bình", quantity: 5, contentRequest: "Giải thích dễ hiểu" });
  assert.equal(generated.status, 200);
  const result = await call("", "POST", generated.content);
  assert.equal(result.status, 201); return result.content;
}
test("mock generation needs no key, validates sources and persists settings and four options", async () => {
  assert.equal((await fetch(`${base}/quizzes`)).status, 401);
  const invalid = { title: "Quiz", sources: [accounts[1].source], difficulty: "Dễ", quantity: 5 };
  assert.equal((await call("/generate", "POST", invalid)).status, 400);
  assert.equal((await call("/generate", "POST", { ...invalid, sources: [accounts[0].source], quantity: 21 })).status, 400);
  const quiz = await saved();
  assert.equal(quiz.contentRequest, "Giải thích dễ hiểu"); assert.equal(quiz.generationMode, "MOCK");
  assert.equal(quiz.questions.length, 5);
  for (const q of quiz.questions) { assert.equal(q.options.length, 4); assert.ok(q.answer >= 0 && q.answer <= 3); }
  assert.ok((await call()).contents.some((item) => item.id === quiz.id));
  assert.equal((await call("", "GET", undefined, accounts[1])).contents.length, 0);
  assert.equal((await call(`/${quiz.id}`, "PUT", quiz, accounts[1])).status, 404);
  assert.equal((await call(`/${quiz.id}`, "DELETE", {}, accounts[1])).status, 404);
  assert.equal((await call(`/${quiz.id}/attempts`, "POST", {}, accounts[1])).status, 404);
  const invalidQuestions = structuredClone(quiz); invalidQuestions.questions[0].options.pop();
  assert.equal((await call(`/${quiz.id}`, "PUT", invalidQuestions)).status, 400);
});
test("versions preserve old questions and server scoring ignores a forged client score", async () => {
  const quiz = await saved();
  const { attempt } = await call(`/${quiz.id}/attempts`, "POST", {});
  assert.equal(attempt.questions[0].answer, undefined);
  const edited = structuredClone(quiz); edited.title = "Quiz phiên bản mới"; edited.questions[0].answer = 1;
  const next = await call(`/${quiz.id}`, "PUT", edited);
  assert.equal(next.status, 200); assert.notEqual(next.content.versionId, quiz.versionId);
  assert.equal((await call(`/${quiz.id}`, "PUT", edited)).status, 409);
  const answers = quiz.questions.map((q, index) => index < 3 ? q.answer : -1);
  assert.equal((await call(`/attempts/${attempt.id}/submit`, "POST", { answers }, accounts[1])).status, 404);
  assert.equal((await call(`/attempts/${attempt.id}/submit`, "POST", { answers: [99] })).status, 400);
  const result = await call(`/attempts/${attempt.id}/submit`, "POST", { answers, score: 100 });
  assert.equal(result.status, 200); assert.equal(result.attempt.score, 60);
  assert.equal(result.attempt.title, quiz.title); assert.equal(result.attempt.questions[0].answer, quiz.questions[0].answer);
  const retry = await call(`/attempts/${attempt.id}/submit`, "POST", { answers: quiz.questions.map((q) => q.answer) });
  assert.equal(retry.attempt.score, 60);
  assert.ok((await call("/attempts")).attempts.some((item) => item.id === attempt.id && item.score === 60));
  const newAttempt = await call(`/${quiz.id}/attempts`, "POST", {});
  assert.notEqual(newAttempt.attempt.id, attempt.id);
});
test("concurrent start/submit is idempotent and deleted quizzes keep historical results", async () => {
  const quiz = await saved();
  const starts = await Promise.all([call(`/${quiz.id}/attempts`, "POST", {}), call(`/${quiz.id}/attempts`, "POST", {})]);
  assert.equal(starts[0].attempt.id, starts[1].attempt.id);
  const body = { answers: quiz.questions.map((q) => q.answer) };
  const results = await Promise.all([call(`/attempts/${starts[0].attempt.id}/submit`, "POST", body), call(`/attempts/${starts[0].attempt.id}/submit`, "POST", body)]);
  assert.equal(results[0].attempt.score, 100); assert.equal(results[1].attempt.score, 100);
  const counts = await database.query("SELECT count(*) FROM attempt_answers WHERE attempt_id=$1", [starts[0].attempt.id]);
  assert.equal(Number(counts.rows[0].count), 5);
  assert.equal((await call(`/${quiz.id}`, "DELETE", {})).status, 200);
  assert.equal((await call(`/${quiz.id}/attempts`, "POST", {})).status, 404);
  assert.ok((await call("/attempts")).attempts.some((item) => item.id === starts[0].attempt.id));
});
