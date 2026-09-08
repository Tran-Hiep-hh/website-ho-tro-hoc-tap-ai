import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { env } from "../src/config/env.js";
import { createApp } from "../src/app.js";
import { createAuthRepository } from "../src/repositories/authRepository.js";

const schema = `study_test_${randomUUID().replaceAll("-", "")}`;
const database = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL ?? env.databaseUrl, options: `-c search_path=${schema}`, connectionTimeoutMillis: 5000 });
let server, base, created = false;
const accounts = [];
before(async () => {
  await database.query(`CREATE SCHEMA ${schema}`); created = true;
  await database.query(await readFile(new URL("../../database/init.sql", import.meta.url), "utf8"));
  const migration = await readFile(new URL("../../database/migrations/004_study_materials.sql", import.meta.url), "utf8");
  await database.query(migration); await database.query(migration);
  server = createApp({ authRepository: createAuthRepository(database), documentDatabase: database }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
  for (const role of ["STUDENT", "TEACHER"]) {
    const body = { fullName: "Người học thử", email: `${role}@example.com`, role, password: "Study-test-123", confirmPassword: "Study-test-123" };
    assert.equal((await fetch(`${base}/auth/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).status, 201);
    const login = await fetch(`${base}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const { user, accessToken } = await login.json();
    const { rows } = await database.query("INSERT INTO source_documents(owner_id,file_name,file_type,storage_path,extracted_text,status) VALUES ($1,'source.txt','TXT','unused','Tài liệu thử nghiệm','READY') RETURNING document_id", [user.userId]);
    accounts.push({ user, token: accessToken, source: String(rows[0].document_id) });
  }
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (created && /^study_test_[a-f0-9]{32}$/.test(schema)) await database.query(`DROP SCHEMA ${schema} CASCADE`);
  await database.end();
});
async function call(route = "", method = "GET", body, account = accounts[0]) {
  const response = await fetch(`${base}/study-materials${route}`, { method, headers: { Authorization: `Bearer ${account.token}`, "Content-Type": "application/json" }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, ...await response.json() };
}
async function draft(type) {
  const result = await call("/generate", "POST", { type, title: "Học liệu thử", difficulty: "Dễ", sources: [accounts[0].source], quantity: 3, contentRequest: "Yêu cầu bổ sung" });
  assert.equal(result.status, 200); return result.content;
}
async function saved(type) {
  const result = await call("", "POST", await draft(type)); assert.equal(result.status, 201); return result.content;
}
test("Flashcards preserve per-card progress on reorder and reset only changed cards", async () => {
  let item = await saved("FLASHCARD");
  assert.equal(item.generationMode, "MOCK"); assert.equal(item.contentRequest, "Yêu cầu bổ sung");
  const firstId = item.cards[0].id;
  let progress = await call(`/${item.id}/progress`, "PUT", { revision: item.revision, cardId: firstId, remembered: true });
  assert.deepEqual(progress.content.learned, [0]);
  const reordered = { ...item, title: "Tên mới", cards: [...item.cards].reverse() };
  const edited = await call(`/${item.id}`, "PUT", reordered); assert.equal(edited.status, 200);
  item = edited.content; assert.deepEqual(item.learned, [2]);
  assert.equal((await call(`/${item.id}`, "PUT", reordered)).status, 409);
  assert.equal((await call(`/${item.id}/progress`, "PUT", { revision: reordered.revision, cardId: firstId, remembered: false })).status, 409);
  progress = await call(`/${item.id}/progress`, "PUT", { revision: item.revision, cardId: firstId, remembered: false });
  assert.deepEqual(progress.content.learned, []);
  await call(`/${item.id}/progress`, "PUT", { revision: item.revision, cardId: firstId, remembered: true });
  item.cards[2].back = "Nội dung đã thay đổi";
  item = (await call(`/${item.id}`, "PUT", item)).content;
  assert.deepEqual(item.learned, []);
  const listing = (await call()).contents.find((entry) => entry.id === item.id);
  assert.equal(listing.cards[2].back, "Nội dung đã thay đổi");
  assert.equal((await call(`/${item.id}`, "PUT", { ...item, cards: [{ front: "", back: "bad" }] })).status, 400);
});
test("Mindmaps preserve hierarchy and reject cycles, missing parents and duplicate roots", async () => {
  let item = await saved("MINDMAP");
  const root = item.nodes.find((node) => !node.parent);
  item.nodes.push({ id: "new-node", parent: root.id, label: "Nhánh mới" });
  item = (await call(`/${item.id}`, "PUT", item)).content;
  assert.ok(item.nodes.some((node) => node.label === "Nhánh mới" && node.parent === item.nodes.find((entry) => !entry.parent).id));
  for (const nodes of [
    [{ id: "root", parent: null, label: "Root" }, { id: "a", parent: "b", label: "A" }, { id: "b", parent: "a", label: "B" }],
    [{ id: "root", parent: null, label: "Root" }, { id: "a", parent: "unknown", label: "A" }],
    [{ id: "root", parent: null, label: "Root" }, { id: "b", parent: null, label: "Other root" }],
  ]) assert.equal((await call(`/${item.id}`, "PUT", { ...item, nodes })).status, 400);
  assert.equal((await call()).contents.find((entry) => entry.id === item.id).nodes.length, item.nodes.length);
});
test("Ownership isolates sources, edits, deletes and progress; shared material blocks deletion", async () => {
  assert.equal((await fetch(`${base}/study-materials`)).status, 401);
  const input = await draft("FLASHCARD");
  assert.equal((await call("", "POST", { ...input, sources: [accounts[1].source] })).status, 400);
  const item = await saved("FLASHCARD");
  assert.equal((await call("", "GET", undefined, accounts[1])).contents.length, 0);
  for (const [route, method, body] of [[`/${item.id}`, "PUT", item], [`/${item.id}`, "DELETE", {}], [`/${item.id}/progress`, "PUT", { revision: item.revision, cardId: item.cards[0].id, remembered: true }]]) assert.equal((await call(route, method, body, accounts[1])).status, 404);
  const other = await saved("FLASHCARD");
  assert.equal((await call(`/${item.id}/progress`, "PUT", { revision: item.revision, cardId: other.cards[0].id, remembered: true })).status, 404);
  assert.equal((await call(`/${item.id}`, "PUT", { ...item, cards: other.cards })).status, 400);
  const { rows } = await database.query("INSERT INTO classrooms(teacher_id,class_name,join_code) VALUES ($1,'Test','STUDYTEST') RETURNING class_id", [accounts[1].user.userId]);
  await database.query("INSERT INTO class_materials(class_id,content_id) VALUES ($1,$2)", [rows[0].class_id, item.id]);
  assert.equal((await call(`/${item.id}`, "DELETE", {})).status, 409);
  await database.query("DELETE FROM class_materials WHERE content_id=$1", [item.id]);
  assert.equal((await call(`/${item.id}`, "DELETE", {})).status, 200);
  assert.ok(!(await call()).contents.some((entry) => entry.id === item.id));
  assert.equal((await call(`/${item.id}/progress`, "PUT", { revision: item.revision, cardId: item.cards[0].id, remembered: true })).status, 404);
});
