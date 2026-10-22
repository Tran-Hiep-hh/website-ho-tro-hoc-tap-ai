import { httpError } from "../utils/httpError.js";

const difficulties = { "Dễ": "EASY", "Trung bình": "MEDIUM", "Khó": "HARD" };

export function text(value, max, required = true) {
  if (typeof value !== "string" || value.length > max || (required && !value.trim()) || value.includes("\0")) {
    throw httpError(400, "Nội dung trống hoặc vượt độ dài cho phép.");
  }
  return value.trim();
}

export function quizSettings(body = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw httpError(400, "Thiết lập Quiz không hợp lệ.");
  const title = text(body.title, 150);
  if (!Object.hasOwn(difficulties, body.difficulty)) throw httpError(400, "Độ khó không hợp lệ.");
  if (!Array.isArray(body.sources) || !body.sources.length || body.sources.length > 10 || !body.sources.every((value) => /^[1-9]\d{0,18}$/.test(String(value)) && BigInt(value) <= 9223372036854775807n)) {
    throw httpError(400, "Chọn từ 1 đến 10 tài liệu nguồn.");
  }
  return { title, difficulty: body.difficulty, sources: [...new Set(body.sources.map(String))], contentRequest: text(body.contentRequest ?? "", 3000, false) };
}

export function validateQuestions(questions) {
  if (!Array.isArray(questions) || !questions.length || questions.length > 50) throw httpError(400, "Quiz cần từ 1 đến 50 câu hỏi.");
  return questions.map((question) => {
    if (!question || !Array.isArray(question.options) || question.options.length !== 4 || !Number.isInteger(question.answer) || question.answer < 0 || question.answer > 3) throw httpError(400, "Mỗi câu cần 4 lựa chọn và 1 đáp án đúng.");
    const options = question.options.map((option) => text(option, 2000));
    if (new Set(options.map((option) => option.toLocaleLowerCase())).size !== 4) throw httpError(400, "Các lựa chọn trong một câu không được trùng nhau.");
    return { text: text(question.text, 4000), options, answer: question.answer, explanation: text(question.explanation, 4000), source: text(question.source ?? "Bổ sung thủ công", 1000, false) };
  });
}

export { difficulties };
