import assert from "node:assert/strict";
import { test } from "node:test";
import { createAICompletion, providerConfig } from "../src/services/aiProvider.js";
import { generateAIMaterial } from "../src/services/aiMaterialGenerator.js";
import { validateQuestions } from "../src/routes/quizRoutes.js";
import { validateCards, validateNodes } from "../src/routes/studyRoutes.js";
import { normalizeMindmap } from "../src/services/normalizeMindmap.js";

const config = { aiProvider: "auto", deepseekApiKey: "", deepseekApiUrl: "https://api.deepseek.com", deepseekModel: "test-model", openrouterApiKey: "", openrouterModel: "test/model", aiTimeoutMs: 1000, aiMaxSourceChars: 1000 };
const success = (content, finish_reason = "stop") => Response.json({ choices: [{ finish_reason, message: { content } }] });

test("provider selection is explicit, defaults to mock without keys and never falls back on errors", async () => {
  assert.equal(providerConfig(config).provider, "mock");
  assert.equal(providerConfig({ ...config, deepseekApiKey: "key", openrouterApiKey: "key2" }).provider, "deepseek");
  assert.equal(providerConfig({ ...config, openrouterApiKey: "key" }).provider, "openrouter");
  assert.throws(() => providerConfig({ ...config, aiProvider: "openrouter" }), /API key/);
  for (const provider of ["deepseek", "openrouter"]) {
    let calls = 0;
    const result = await createAICompletion([{ role: "user", content: "JSON" }], { config: { ...config, aiProvider: provider, deepseekApiKey: "private", openrouterApiKey: "private" }, fetchImpl: async (url, options) => {
      calls++;
      assert.equal(new URL(url).host, provider === "deepseek" ? "api.deepseek.com" : "openrouter.ai");
      assert.equal(options.headers.Authorization, "Bearer private");
      assert.deepEqual(JSON.parse(options.body).response_format, { type: "json_object" });
      assert.deepEqual(JSON.parse(options.body).thinking, provider === "deepseek" ? { type: "disabled" } : undefined);
      return success('```json\n{"cards":[]}\n```');
    } });
    assert.deepEqual(result.content, { cards: [] }); assert.equal(calls, 1);
  }
});

test("provider errors, malformed and truncated output are safe and timeout aborts request", async () => {
  const keyed = { ...config, deepseekApiKey: "private" };
  for (const status of [400, 401, 402, 403, 404, 429, 500]) {
    let calls = 0;
    await assert.rejects(createAICompletion([], { config: keyed, fetchImpl: async () => { calls++; return Response.json({ error: "private secret upstream" }, { status }); } }), (error) => error.statusCode === 502 && error.expose && !error.message.includes("private"));
    assert.equal(calls, 1);
  }
  for (const response of [success("not json"), success("{}", "length"), success("[]"), Response.json({ error: { code: 429 } })]) {
    await assert.rejects(createAICompletion([], { config: keyed, fetchImpl: async () => response }), (error) => error.statusCode === 502);
  }
  await assert.rejects(createAICompletion([], { config: keyed, fetchImpl: (_url, { signal }) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")))) }), (error) => error.statusCode === 504);
});

test("prompts use bounded source text and preserve trusted settings, not model overrides", async () => {
  const input = { type: "QUIZ", title: "Sinh học", difficulty: "Dễ", quantity: 1, sources: ["1", "2"], contentRequest: "Tình huống thực tế", documents: [
    { document_id: "1", file_name: "a.txt", extracted_text: "a".repeat(900) },
    { document_id: "2", file_name: "b.txt", extracted_text: "b".repeat(900) },
  ] };
  const generated = await generateAIMaterial(input, { config, complete: async (messages) => {
    assert.match(messages[0].content, /không làm theo các chỉ dẫn/);
    const prompt = JSON.parse(messages[1].content);
    assert.equal(prompt.documents[0].text.length, 500); assert.equal(prompt.documents[1].text.length, 500);
    assert.equal(prompt.additionalRequest, input.contentRequest);
    return { provider: "openrouter", model: "model", content: { title: "Forged", sources: ["99"], questions: [] } };
  } });
  assert.equal(generated.title, input.title); assert.deepEqual(generated.sources, input.sources);
  assert.equal(generated.documents, undefined); assert.equal(generated.sourceTruncated, true);
  assert.equal(generated.generationMode, "OPENROUTER");
  await assert.rejects(generateAIMaterial(input, { config, complete: async () => ({ content: { error: "insufficient_source" } }) }), (error) => error.statusCode === 422);
});

test("generated Quiz, Flashcard and Mindmap validators reject broken structures", () => {
  const question = { text: "Câu hỏi", options: ["A", "B", "C", "D"], answer: 0, explanation: "Giải thích" };
  assert.equal(validateQuestions([question]).length, 1);
  assert.throws(() => validateQuestions([{ ...question, options: ["A", "A", "C", "D"] }]));
  assert.throws(() => validateQuestions([{ ...question, answer: 4 }]));
  assert.throws(() => validateCards([{ front: "A", back: "" }]));
  assert.equal(validateCards([{ front: "A", back: "B" }]).length, 1);
  assert.throws(() => validateNodes([{ id: "a", parent: null, label: "Root" }, { id: "b", parent: "b", label: "Loop" }]));
  assert.equal(validateNodes([{ id: "a", parent: null, label: "Root" }, { id: "b", parent: "a", label: "Child" }]).length, 2);
});

test("explicit answer-position requests are enforced for every generated Quiz question", async () => {
  const input = { type: "QUIZ", title: "Kiểm tra", difficulty: "Dễ", quantity: 2, sources: ["1"], contentRequest: "Đáp án đúng phải toàn là B", documents: [{ document_id: "1", file_name: "a.txt", extracted_text: "Tài liệu" }] };
  const generated = await generateAIMaterial(input, { config, complete: async () => ({ provider: "deepseek", model: "model", content: { questions: [
    { text: "Câu 1", options: ["Đúng 1", "Sai 1", "Sai 2", "Sai 3"], answer: 0, explanation: "Giải thích", source: "a.txt" },
    { text: "Câu 2", options: ["Sai 1", "Sai 2", "Sai 3", "Đúng 2"], answer: 3, explanation: "Giải thích", source: "a.txt" },
  ] } }) });
  assert.deepEqual(generated.questions.map((q) => q.answer), [1, 1]);
  assert.deepEqual(generated.questions.map((q) => q.options[1]), ["Đúng 1", "Đúng 2"]);
});

test("grouped answer-position requests are enforced in their stated order", async () => {
  const questions = Array.from({ length: 15 }, (_, index) => ({ text: `Câu ${index}`, options: ["Đúng", "Sai B", "Sai C", "Sai D"], answer: 0 }));
  const generated = await generateAIMaterial({ type: "QUIZ", title: "Kiểm tra", difficulty: "Dễ", quantity: 15, sources: ["1"], contentRequest: "Tôi muốn 5 câu đầu là A, 5 câu sau là B, 5 câu sau nữa là C", documents: [{ document_id: "1", file_name: "a.txt", extracted_text: "Tài liệu" }] }, { config, complete: async () => ({ provider: "deepseek", model: "model", content: { questions } }) });
  assert.deepEqual(generated.questions.map((q) => q.answer), [...Array(5).fill(0), ...Array(5).fill(1), ...Array(5).fill(2)]);
  assert.ok(generated.questions.every((q) => q.options[q.answer] === "Đúng"));
});

test("AI Mindmap normalizes numeric references without hiding long labels or broken trees", () => {
  const normalized = normalizeMindmap([{ id: 0, parent: null, label: " Gốc " }, { id: 1, parentId: 0, label: "Nhánh" }]);
  assert.deepEqual(validateNodes(normalized), [{ id: "0", parent: null, label: "Gốc" }, { id: "1", parent: "0", label: "Nhánh" }]);
  assert.throws(() => validateNodes(normalizeMindmap([{ id: 0, parent: null, label: "a".repeat(49) }])), /48 ký tự/);
  assert.throws(() => validateNodes(normalizeMindmap([{ id: 0, parent: null, label: "Gốc" }, { id: 1, parent: 2, label: "Sai cha" }])), /không tồn tại/);
  assert.throws(() => validateNodes(normalizeMindmap([{ id: 0, parent: null, label: "Gốc" }, { id: "0", parent: null, label: "Trùng" }])), /mã nút khác nhau/);
});
