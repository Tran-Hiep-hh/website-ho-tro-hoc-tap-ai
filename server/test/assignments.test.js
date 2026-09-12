import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { env } from "../src/config/env.js";
import { createApp } from "../src/app.js";
import { createAuthRepository } from "../src/repositories/authRepository.js";

const schema = `assignments_test_${randomUUID().replaceAll("-", "")}`;
const database = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL ?? env.databaseUrl, options: `-c search_path=${schema}`, connectionTimeoutMillis: 5000 });
let server, base, created = false;
const accounts = [];
before(async () => {
  await database.query(`CREATE SCHEMA ${schema}`); created = true;
  await database.query(await readFile(new URL("../../database/init.sql", import.meta.url), "utf8"));
  const migration = await readFile(new URL("../../database/migrations/006_assignments.sql", import.meta.url), "utf8");
  await database.query(migration); await database.query(migration);
  server = createApp({ authRepository: createAuthRepository(database), documentDatabase: database }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
  for (const [i, role] of ["TEACHER", "TEACHER", "STUDENT", "STUDENT"].entries()) {
    const body = { fullName: `Người dùng ${i}`, email: `assignment${i}@example.com`, role, password: "Assignment-test-123", confirmPassword: "Assignment-test-123" };
    assert.equal((await fetch(`${base}/auth/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).status, 201);
    const login = await fetch(`${base}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await login.json(); accounts.push({ token: result.accessToken, user: result.user });
  }
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (created && /^assignments_test_[a-f0-9]{32}$/.test(schema)) await database.query(`DROP SCHEMA ${schema} CASCADE`);
  await database.end();
});
async function call(route, method = "GET", body, who = 0) {
  const response = await fetch(`${base}${route}`, { method, headers: { Authorization: `Bearer ${accounts[who].token}`, "Content-Type": "application/json" }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, ...await response.json() };
}
async function fixture(overrides = {}) {
  const cls = await call("/classes", "POST", { name: "Lớp kiểm tra" });
  const { rows: contents } = await database.query("INSERT INTO generated_contents(owner_id,content_type,title,difficulty,status) VALUES ($1,'QUIZ','Quiz gốc','EASY','READY') RETURNING content_id", [accounts[0].user.userId]);
  const { rows: versions } = await database.query("INSERT INTO quiz_versions(quiz_id,version_number,title) VALUES ($1,1,'Phiên bản gốc') RETURNING quiz_version_id", [contents[0].content_id]);
  for (let i = 0; i < 2; i++) {
    const { rows } = await database.query("INSERT INTO quiz_questions(quiz_version_id,question_text,explanation,display_order) VALUES ($1,$2,'Giải thích bí mật',$3) RETURNING question_id", [versions[0].quiz_version_id, `Câu gốc ${i}`, i + 1]);
    for (let j = 0; j < 4; j++) await database.query("INSERT INTO answer_options(question_id,option_text,is_correct,display_order) VALUES ($1,$2,$3,$4)", [rows[0].question_id, `Lựa chọn ${j}`, j === i, j + 1]);
  }
  await database.query("INSERT INTO class_memberships(class_id,student_id) VALUES ($1,$2)", [cls.id, accounts[2].user.userId]);
  const input = { classId: cls.id, contentId: String(contents[0].content_id), versionId: String(versions[0].quiz_version_id), title: "Bài kiểm tra", startAt: new Date(Date.now() - 60_000).toISOString(), dueAt: new Date(Date.now() + 3600_000).toISOString(), maxAttempts: 1, showAnswers: false, status: "PUBLISHED", ...overrides };
  const result = await call("/assignments", "POST", input); assert.equal(result.status, 201, result.message);
  return { ...input, id: result.id };
}
test("Assignment creation validates role, class ownership, Quiz version and scheduling", async () => {
  const a = await fixture({ status: "DRAFT" });
  assert.equal((await fetch(`${base}/assignments`)).status, 401);
  assert.equal((await call("/assignments", "POST", a, 2)).status, 403);
  assert.equal((await call("/assignments", "POST", a, 1)).status, 404);
  for (const invalid of [{ maxAttempts: 0 }, { maxAttempts: 11 }, { title: " " }, { dueAt: a.startAt }, { startAt: "bad" }, { status: "INVALID" }]) assert.equal((await call("/assignments", "POST", { ...a, ...invalid })).status, 400);
  assert.equal((await call("/assignments", "POST", { ...a, versionId: "999999" })).status, 409);
  assert.ok(!(await call("/assignments", "GET", undefined, 2)).assignments.some((item) => item.id === a.id));
  assert.equal((await call(`/assignments/${a.id}/attempts`, "POST", {}, 2)).status, 409);
  assert.equal((await call(`/assignments/${a.id}/status`, "POST", { status: "PUBLISHED" }, 1)).status, 404);
  assert.equal((await call(`/assignments/${a.id}/status`, "POST", { status: "PUBLISHED" })).status, 200);
  const listed = (await call("/assignments", "GET", undefined, 2)).assignments.find((item) => item.id === a.id);
  assert.deepEqual(listed.questions, []); assert.equal(listed.questionCount, 2);
  assert.equal((await call(`/assignments/${a.id}/attempts`, "POST", {}, 3)).status, 404);
  assert.equal((await call(`/assignments/${a.id}/attempts`, "POST", {}, 0)).status, 403);
  assert.equal((await call(`/assignments/${a.id}/status`, "POST", { status: "CANCELLED" })).status, 409);
  const future = await fixture({ startAt: new Date(Date.now() + 600_000).toISOString() });
  assert.equal((await call(`/assignments/${future.id}/attempts`, "POST", {}, 2)).status, 409);
  assert.equal((await call(`/assignments/${future.id}/status`, "POST", { status: "CANCELLED" })).status, 200);
  assert.equal((await call(`/assignments/${future.id}/attempts`, "POST", {}, 2)).status, 409);
});
test("Starts and submits are idempotent; drafts resume and stale tabs cannot overwrite; answers stay hidden", async () => {
  const a = await fixture();
  const starts = await Promise.all([call(`/assignments/${a.id}/attempts`, "POST", {}, 2), call(`/assignments/${a.id}/attempts`, "POST", {}, 2)]);
  assert.equal(starts[0].status, 200); assert.equal(starts[0].attempt.id, starts[1].attempt.id);
  const t = starts[0].attempt;
  assert.ok(t.questions.every((q) => !Object.hasOwn(q, "answer") && !Object.hasOwn(q, "optionIds") && !Object.hasOwn(q, "explanation")));
  assert.equal((await call(`/assignments/attempts/${t.id}/answers`, "PUT", { answers: [0, -1], revision: 0 }, 3)).status, 404);
  assert.equal((await call(`/assignments/attempts/${t.id}/answers`, "PUT", { answers: [4, -1], revision: 0 }, 2)).status, 400);
  const saved = await call(`/assignments/attempts/${t.id}/answers`, "PUT", { answers: [0, -1], revision: 0 }, 2); assert.equal(saved.revision, 1);
  assert.equal((await call(`/assignments/attempts/${t.id}/answers`, "PUT", { answers: [1, 1], revision: 0 }, 2)).status, 409);
  const resumed = (await call(`/assignments/${a.id}/attempts`, "POST", {}, 2)).attempt;
  assert.deepEqual(resumed.answers, [0, -1]); assert.equal(resumed.revision, 1);
  const submitted = await Promise.all([call(`/assignments/attempts/${t.id}/submit`, "POST", { answers: [0, -1], revision: 1, score: 100 }, 2), call(`/assignments/attempts/${t.id}/submit`, "POST", { answers: [3, 3], revision: 1 }, 2)]);
  assert.ok(submitted.every((r) => r.status === 200));
  assert.equal(submitted[0].attempt.score, submitted[1].attempt.score);
  // Whichever concurrent submit won, the persisted score is derived from that exact answer set.
  const final = submitted[0].attempt;
  assert.equal(final.score, final.answers[0] === 0 ? 50 : 0);
  assert.equal(final.showAnswers, false); assert.ok(final.questions.every((q) => q.answer === undefined && q.explanation === undefined));
  assert.equal((await call(`/assignments/${a.id}/attempts`, "POST", {}, 2)).status, 409);
  const history = (await call("/assignments", "GET", undefined, 2)).attempts.find((item) => item.id === t.id);
  assert.equal(history.score, final.score); assert.equal(history.questions[0].answer, undefined);
  const teacherResult = (await call("/assignments")).classAttempts.find((item) => item.id === t.id);
  assert.equal(teacherResult.questions[0].answer, 0); assert.equal(teacherResult.showAnswers, true);
  assert.ok(!(await call("/assignments", "GET", undefined, 1)).classAttempts.some((item) => item.id === t.id));
});
test("Assignments freeze the Quiz version; only permitted submitted results reveal answers", async () => {
  const a = await fixture({ showAnswers: true, maxAttempts: 2 });
  await database.query("INSERT INTO quiz_versions(quiz_id,version_number,title) VALUES ($1,2,'Phiên bản mới')", [a.contentId]);
  const t = (await call(`/assignments/${a.id}/attempts`, "POST", {}, 2)).attempt;
  assert.equal(t.questions[0].text, "Câu gốc 0"); assert.equal(t.questions[0].answer, undefined);
  const submitted = await call(`/assignments/attempts/${t.id}/submit`, "POST", { answers: [0, 1], revision: 0 }, 2);
  assert.equal(submitted.attempt.score, 100); assert.equal(submitted.attempt.questions[1].answer, 1);
  assert.equal((await call(`/assignments/${a.id}/attempts`, "POST", {}, 2)).status, 200);
  assert.equal((await call(`/quizzes/${a.contentId}`, "DELETE", {})).status, 409);
});
test("Deadline rejects late edits and finalizes saved answers even when the browser is closed", async () => {
  const a = await fixture();
  const t = (await call(`/assignments/${a.id}/attempts`, "POST", {}, 2)).attempt;
  await call(`/assignments/attempts/${t.id}/answers`, "PUT", { answers: [0, -1], revision: 0 }, 2);
  await database.query("UPDATE quiz_assignments SET due_at=NOW()-INTERVAL '1 second' WHERE assignment_id=$1", [a.id]);
  const late = await call(`/assignments/attempts/${t.id}/submit`, "POST", { answers: [0, 1], revision: 1 }, 2);
  assert.equal(late.attempt.score, 50); assert.deepEqual(late.attempt.answers, [0, -1]);
  const b = await fixture();
  const other = (await call(`/assignments/${b.id}/attempts`, "POST", {}, 2)).attempt;
  await database.query("UPDATE quiz_assignments SET due_at=NOW()-INTERVAL '1 second' WHERE assignment_id=$1", [b.id]);
  const automatic = (await call("/assignments")).classAttempts.find((item) => item.id === other.id);
  assert.equal(automatic.score, 0); assert.equal(automatic.status, "SUBMITTED");
  assert.equal((await call(`/assignments/${b.id}/attempts`, "POST", {}, 2)).status, 409);
});
