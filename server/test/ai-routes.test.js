import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";

// Isolated Node test process: never call a paid provider, even if .env contains a key.
process.env.AI_PROVIDER = "openrouter";
process.env.OPENROUTER_API_KEY = "test-only";
process.env.OPENROUTER_MODEL = "test/model";
const { env } = await import("../src/config/env.js");
const { createApp } = await import("../src/app.js");
const { createAuthRepository } = await import("../src/repositories/authRepository.js");
const schema = `ai_test_${randomUUID().replaceAll("-", "")}`;
const database = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL ?? env.databaseUrl, options: `-c search_path=${schema}`, connectionTimeoutMillis: 5000 });
const originalFetch = globalThis.fetch;
let server, base, created = false, token, source, reply, calls = 0, prompt;
before(async () => {
  globalThis.fetch = (url, options) => {
    if (String(url).startsWith("https://openrouter.ai/")) {
      calls++; prompt = JSON.parse(options.body);
      return Promise.resolve(Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(reply) } }] }));
    }
    assert.ok(String(url).startsWith(base), "Unexpected network request");
    return originalFetch(url, options);
  };
  await database.query(`CREATE SCHEMA ${schema}`); created = true;
  await database.query(await readFile(new URL("../../database/init.sql", import.meta.url), "utf8"));
  server = createApp({ authRepository: createAuthRepository(database), documentDatabase: database }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
  const account = { fullName: "AI test", role: "STUDENT", email: "ai@example.com", password: "AI-testing-123", confirmPassword: "AI-testing-123" };
  assert.equal((await call("/auth/register", account)).status, 201);
  const login = await call("/auth/login", account); token = login.accessToken;
  const { rows } = await database.query("INSERT INTO source_documents(owner_id,file_name,file_type,storage_path,extracted_text,status) VALUES ($1,'biology.txt','TXT','unused','Tế bào là đơn vị cấu trúc của cơ thể sống.','READY') RETURNING document_id", [login.user.userId]);
  source = String(rows[0].document_id);
});
after(async () => {
  globalThis.fetch = originalFetch;
  if (server) await new Promise((resolve) => server.close(resolve));
  if (created && /^ai_test_[a-f0-9]{32}$/.test(schema)) await database.query(`DROP SCHEMA ${schema} CASCADE`);
  await database.end();
});
async function call(path, body) {
  const response = await fetch(`${base}${path}`, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, ...await response.json() };
}
test("real-provider generation uses owned text and saves edited Quiz, Flashcard and Mindmap with AI labels", async () => {
  const input = { title: "Sinh học", difficulty: "Dễ", sources: [source], quantity: 1, contentRequest: "Dễ hiểu" };
  const cases = [
    ["QUIZ", "/quizzes", { questions: [{ text: "Đơn vị cấu trúc?", options: ["Tế bào", "Đá", "Nước", "Không khí"], answer: 0, explanation: "Tài liệu nêu tế bào là đơn vị cấu trúc.", source: "biology.txt" }] }],
    ["FLASHCARD", "/study-materials", { cards: [{ front: "Đơn vị cấu trúc", back: "Tế bào", keyword: "Tế bào" }] }],
    ["MINDMAP", "/study-materials", { nodes: [{ id: "root", parent: null, label: "Sinh học" }, { id: "cell", parent: "root", label: "Tế bào" }] }],
  ];
  for (const [type, path, value] of cases) {
    reply = value;
    const generated = await call(`${path}/generate`, { ...input, type });
    assert.equal(generated.status, 200, generated.message);
    assert.equal(generated.content.generationMode, "OPENROUTER");
    assert.equal(generated.content.documents, undefined);
    assert.equal(JSON.parse(prompt.messages[1].content).documents[0].text, "Tế bào là đơn vị cấu trúc của cơ thể sống.");
    const saved = await call(path, { ...generated.content, title: "Đã chỉnh sửa" });
    assert.equal(saved.status, 201, saved.message);
    assert.equal(saved.content.generationMode, "OPENROUTER");
    assert.equal(saved.content.generationModel, "test/model");
    assert.equal((await call(path)).contents.find((item) => item.id === saved.content.id).title, "Đã chỉnh sửa");
  }
  const before = calls;
  assert.equal((await call("/quizzes/generate", { ...input, sources: ["999999"] })).status, 400);
  assert.equal(calls, before);
  reply = { questions: [{ text: "Broken", options: ["A"], answer: 0 }] };
  const invalid = await call("/quizzes/generate", input);
  assert.equal(invalid.status, 502); assert.match(invalid.message, /AI trả về/);
  assert.equal((await call("/quizzes")).contents.length, 1);
});
