import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { readFile, mkdtemp, readdir, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import pg from "pg";
import { env } from "../src/config/env.js";
import { createApp } from "../src/app.js";
import { createAuthRepository } from "../src/repositories/authRepository.js";

const schema = `documents_test_${randomUUID().replaceAll("-", "")}`;
const database = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL ?? env.databaseUrl, options: `-c search_path=${schema}`, connectionTimeoutMillis: 5000 });
let server, base, storage, created = false;
const tokens = [];
before(async () => {
  await database.query(`CREATE SCHEMA ${schema}`); created = true;
  await database.query(await readFile(new URL("../../database/init.sql", import.meta.url), "utf8"));
  const migration = await readFile(new URL("../../database/migrations/002_documents.sql", import.meta.url), "utf8");
  await database.query(migration); await database.query(migration);
  storage = await mkdtemp(path.join(tmpdir(), "study-documents-"));
  server = createApp({ authRepository: createAuthRepository(database), documentDatabase: database, documentStorageRoot: storage }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
  for (const role of ["STUDENT", "TEACHER"]) {
    const body = { fullName: "Người kiểm thử", email: `${role}@example.com`, role, password: "Document-test-123", confirmPassword: "Document-test-123" };
    const response = await fetch(`${base}/auth/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    assert.equal(response.status, 201);
    const login = await fetch(`${base}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    tokens.push((await login.json()).accessToken);
  }
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (created && /^documents_test_[a-f0-9]{32}$/.test(schema)) await database.query(`DROP SCHEMA ${schema} CASCADE`);
  await database.end();
  if (storage) { for (const name of await readdir(storage)) await unlink(path.join(storage, name)); await rmdir(storage); }
});
const request = (route = "", options = {}, token = tokens[0]) => fetch(`${base}/documents${route}`, { ...options, headers: { Authorization: `Bearer ${token}` } });
function upload(name, text, token) {
  const body = new FormData(); body.append("file", new Blob([text]), name);
  return request("", { method: "POST", body }, token);
}
test("uploads UTF-8 text, persists metadata, downloads exact bytes and isolates owners", async () => {
  const text = "Khóa chính và khóa ngoại\nNội dung tài liệu cá nhân.";
  const response = await upload("Tài liệu.txt", text);
  assert.equal(response.status, 201);
  const { document } = await response.json();
  assert.equal(document.name, "Tài liệu.txt"); assert.equal(document.text, text); assert.equal(document.status, "READY");
  assert.equal((await (await request()).json()).documents.length, 1);
  assert.equal((await (await request("", {}, tokens[1])).json()).documents.length, 0);
  for (const route of [`/${document.id}`, `/${document.id}/download`]) assert.equal((await request(route, {}, tokens[1])).status, 404);
  assert.equal((await request(`/${document.id}`, { method: "DELETE" }, tokens[1])).status, 404);
  assert.equal(await (await request(`/${document.id}/download`)).text(), text);
  assert.equal((await request(`/${document.id}`, { method: "DELETE" })).status, 200);
  assert.equal((await request(`/${document.id}/download`)).status, 404);
  assert.equal((await readdir(storage)).length, 0);
});
test("rejects unauthenticated, invalid and oversized files without storing them", async () => {
  assert.equal((await fetch(`${base}/documents`)).status, 401);
  for (const [name, text, status] of [["bad.exe", "hello", 400], ["bad.pdf", "not a pdf", 422], ["bad.docx", "not a docx", 422], ["empty.txt", "", 400], ["large.txt", "a".repeat(10 * 1024 * 1024 + 1), 400]]) {
    assert.equal((await upload(name, text)).status, status, name);
  }
  assert.equal((await readdir(storage)).length, 0);
});
test("shared teacher documents cannot be deleted until removed from class", async () => {
  const { document } = await (await upload("teacher.txt", "Teacher material", tokens[1])).json();
  const { rows } = await database.query("INSERT INTO classrooms (teacher_id,class_name,join_code) VALUES ($1,'Test','DOCSTEST') RETURNING class_id", [document.ownerId]);
  await database.query("INSERT INTO class_materials (class_id,document_id) VALUES ($1,$2)", [rows[0].class_id, document.id]);
  assert.equal((await request(`/${document.id}`, { method: "DELETE" }, tokens[1])).status, 409);
  await database.query("DELETE FROM class_materials WHERE document_id=$1", [document.id]);
  assert.equal((await request(`/${document.id}`, { method: "DELETE" }, tokens[1])).status, 200);
});

test("extracts real PDF and DOCX text and preserves the original files", async () => {
  const content = "BT /F1 12 Tf 50 750 Td (Database study document) Tj ET";
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${content.length} >>\nstream\n${content}\nendstream`];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  // Mammoth ships this small, valid Word fixture with its installed package.
  const docx = await readFile(new URL("../../../node_modules/mammoth/test/test-data/single-paragraph.docx", import.meta.url));
  for (const [name, bytes, expected] of [["document.pdf", Buffer.from(pdf), /Database study document/], ["document.docx", docx, /./]]) {
    const response = await upload(name, bytes);
    assert.equal(response.status, 201);
    const { document } = await response.json();
    assert.equal(document.status, "READY"); assert.match(document.text, expected);
    assert.deepEqual(Buffer.from(await (await request(`/${document.id}/download`)).arrayBuffer()), bytes);
    assert.equal((await request(`/${document.id}`, { method: "DELETE" })).status, 200);
  }
});
