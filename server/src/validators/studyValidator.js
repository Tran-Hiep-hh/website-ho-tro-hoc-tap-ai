import { httpError } from "../utils/httpError.js";

const difficulties = { "Dễ": "EASY", "Trung bình": "MEDIUM", "Khó": "HARD" };
const validId = (value) => /^[1-9]\d{0,18}$/.test(String(value)) && BigInt(value) <= 9223372036854775807n;

export function text(value, max, optional = false) {
  if (typeof value !== "string" || value.length > max || (!optional && !value.trim()) || value.includes("\0")) throw httpError(400, "Nội dung trống hoặc vượt độ dài cho phép.");
  return value.trim();
}

export function studySettings(body) {
  if (!body || !["FLASHCARD", "MINDMAP"].includes(body.type)) throw httpError(400, "Loại học liệu không hợp lệ.");
  if (!Object.hasOwn(difficulties, body.difficulty)) throw httpError(400, "Độ khó không hợp lệ.");
  if (!Array.isArray(body.sources) || !body.sources.length || body.sources.length > 10 || !body.sources.every(validId)) throw httpError(400, "Chọn từ 1 đến 10 tài liệu nguồn.");
  return { type: body.type, title: text(body.title, 150), difficulty: body.difficulty, sources: [...new Set(body.sources.map(String))], contentRequest: text(body.contentRequest ?? "", 3000, true) };
}

export function validateCards(cards) {
  if (!Array.isArray(cards) || !cards.length || cards.length > 50) throw httpError(400, "Cần từ 1 đến 50 thẻ.");
  const result = cards.map((card) => ({ id: card?.id === undefined ? undefined : String(card.id), front: text(card?.front, 4000), back: text(card?.back, 4000), keyword: text(card?.keyword ?? "", 100, true) }));
  const ids = result.filter((card) => card.id !== undefined).map((card) => card.id);
  if (!ids.every(validId) || new Set(ids).size !== ids.length) throw httpError(400, "Mã thẻ không hợp lệ hoặc trùng lặp.");
  return result;
}

export function validateNodes(nodes) {
  if (!Array.isArray(nodes) || !nodes.length || nodes.length > 30) throw httpError(400, "Mindmap cần từ 1 đến 30 nút.");
  const result = nodes.map((node, index) => {
    if (typeof node?.label !== "string" || !node.label.trim() || node.label.includes("\0")) throw httpError(400, `Nút ${index + 1} thiếu tên hợp lệ.`);
    if (node.label.trim().length > 48) throw httpError(400, `Tên nút ${index + 1} dài quá 48 ký tự. Hãy yêu cầu AI dùng cụm từ ngắn cho mỗi nút.`);
    if (typeof node?.id !== "string" || !node.id.trim() || node.id.length > 80) throw httpError(400, `Nút ${index + 1} có mã không hợp lệ.`);
    if (node.parent !== null && (typeof node.parent !== "string" || !node.parent.trim() || node.parent.length > 80)) throw httpError(400, `Nút ${index + 1} thiếu mã nút cha; nút gốc phải có parent=null.`);
    return { id: text(node.id, 80), parent: node.parent === null ? null : text(node.parent, 80), label: text(node.label.trim(), 48) };
  });
  const map = new Map(result.map((node) => [node.id, node]));
  if (map.size !== result.length || result.filter((node) => node.parent === null).length !== 1) throw httpError(400, "Mindmap phải có một nút gốc và các mã nút khác nhau.");
  for (const node of result) {
    const seen = new Set([node.id]); let parent = node.parent;
    while (parent !== null) {
      if (!map.has(parent) || seen.has(parent)) throw httpError(400, "Nhánh Mindmap không hợp lệ: nút cha không tồn tại hoặc tạo vòng lặp.");
      seen.add(parent); parent = map.get(parent).parent;
    }
  }
  return result;
}

export { difficulties };
