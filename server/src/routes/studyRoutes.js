import { Router } from "express";
import { pool } from "../config/database.js";
import { createAuthRepository } from "../repositories/authRepository.js";
import { createAuthService } from "../services/authService.js";
import { requireAuth, protectAuthMutation, authRateLimit } from "../middlewares/auth.js";
import { httpError } from "../utils/httpError.js";
import { generateStudyMaterial } from "../services/studyGenerator.js";

const difficulties = { "Dễ": "EASY", "Trung bình": "MEDIUM", "Khó": "HARD" };
const validId = (id) => /^[1-9]\d{0,18}$/.test(String(id)) && BigInt(id) <= 9223372036854775807n;
const missing = () => httpError(404, "Không tìm thấy học liệu hoặc bạn không có quyền truy cập.");
function text(value, max, optional = false) {
  if (typeof value !== "string" || value.length > max || (!optional && !value.trim()) || value.includes("\0")) throw httpError(400, "Nội dung trống hoặc vượt độ dài cho phép.");
  return value.trim();
}
function validateSettings(body) {
  if (!body || !["FLASHCARD", "MINDMAP"].includes(body.type)) throw httpError(400, "Loại học liệu không hợp lệ.");
  if (!Object.hasOwn(difficulties, body.difficulty)) throw httpError(400, "Độ khó không hợp lệ.");
  if (!Array.isArray(body.sources) || !body.sources.length || body.sources.length > 10 || !body.sources.every(validId)) throw httpError(400, "Chọn từ 1 đến 10 tài liệu nguồn.");
  return { type: body.type, title: text(body.title, 150), difficulty: body.difficulty, sources: [...new Set(body.sources.map(String))], contentRequest: text(body.contentRequest ?? "", 3000, true) };
}
function validateCards(cards) {
  if (!Array.isArray(cards) || !cards.length || cards.length > 50) throw httpError(400, "Cần từ 1 đến 50 thẻ.");
  const result = cards.map((card) => ({ id: card?.id === undefined ? undefined : String(card.id), front: text(card?.front, 4000), back: text(card?.back, 4000), keyword: text(card?.keyword ?? "", 100, true) }));
  const ids = result.filter((card) => card.id !== undefined).map((card) => card.id);
  if (!ids.every(validId) || new Set(ids).size !== ids.length) throw httpError(400, "Mã thẻ không hợp lệ hoặc trùng lặp.");
  return result;
}
function validateNodes(nodes) {
  if (!Array.isArray(nodes) || !nodes.length || nodes.length > 30) throw httpError(400, "Mindmap cần từ 1 đến 30 nút.");
  const result = nodes.map((node) => ({ id: text(node?.id, 80), parent: node?.parent === null ? null : text(node?.parent, 80), label: text(node?.label, 48) }));
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

export function createStudyRouter({ database = pool, authRepository = createAuthRepository() } = {}) {
  const router = Router();
  router.use(requireAuth(createAuthService(authRepository)));
  router.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
  router.use((req, res, next) => ["GET", "HEAD"].includes(req.method) ? next() : protectAuthMutation(req, res, next));
  async function transaction(fn) {
    const db = await database.connect();
    try { await db.query("BEGIN"); const value = await fn(db); await db.query("COMMIT"); return value; }
    catch (error) { await db.query("ROLLBACK"); throw error; }
    finally { db.release(); }
  }
  async function owned(db, userId, id, lock = false) {
    if (!validId(id)) throw missing();
    const { rows } = await db.query(`SELECT * FROM generated_contents WHERE content_id=$1 AND owner_id=$2 AND content_type IN ('FLASHCARD','MINDMAP') AND status <> 'DELETED'${lock ? " FOR UPDATE" : ""}`, [id, userId]);
    if (!rows[0]) throw missing(); return rows[0];
  }
  async function sources(db, userId, ids) {
    const result = await db.query("SELECT document_id FROM source_documents WHERE document_id=ANY($1::bigint[]) AND owner_id=$2 AND status='READY' AND length(trim(extracted_text))>0 FOR SHARE", [ids, userId]);
    if (result.rowCount !== ids.length) throw httpError(400, "Tài liệu phải thuộc về bạn và có văn bản sẵn sàng.");
  }
  async function material(db, row) {
    const { rows: docs } = await db.query("SELECT document_id FROM content_sources WHERE content_id=$1 ORDER BY document_id", [row.content_id]);
    const result = { id: String(row.content_id), type: row.content_type, title: row.title, revision: row.revision, persisted: true, generationMode: row.generation_settings.mode ?? "MOCK", contentRequest: row.generation_settings.contentRequest ?? "", difficulty: Object.keys(difficulties).find((key) => difficulties[key] === row.difficulty), sources: docs.map((doc) => String(doc.document_id)), createdAt: row.created_at };
    if (row.content_type === "FLASHCARD") {
      const { rows } = await db.query("SELECT f.*, COALESCE(p.remembered,FALSE) AS remembered FROM flashcards f LEFT JOIN flashcard_progress p ON p.flashcard_id=f.flashcard_id AND p.user_id=$2 WHERE f.content_id=$1 ORDER BY f.display_order", [row.content_id, row.owner_id]);
      result.cards = rows.map((card) => ({ id: String(card.flashcard_id), front: card.front_text, back: card.back_text, keyword: card.keyword }));
      result.learned = rows.flatMap((card, index) => card.remembered ? [index] : []);
    } else {
      const { rows } = await db.query("SELECT * FROM mindmap_nodes WHERE content_id=$1 ORDER BY display_order", [row.content_id]);
      result.nodes = rows.map((node) => ({ id: String(node.node_id), parent: node.parent_node_id === null ? null : String(node.parent_node_id), label: node.label }));
    }
    return result;
  }
  async function writeCards(db, contentId, cards) {
    const { rows: old } = await db.query("SELECT * FROM flashcards WHERE content_id=$1", [contentId]);
    for (const card of cards) if (card.id && !old.some((entry) => String(entry.flashcard_id) === card.id)) throw httpError(400, "Thẻ không thuộc bộ học liệu này.");
    const keep = cards.filter((card) => card.id).map((card) => card.id);
    await db.query("DELETE FROM flashcards WHERE content_id=$1 AND NOT (flashcard_id=ANY($2::bigint[]))", [contentId, keep]);
    // Move existing orders out of the target range before reordering.
    await db.query("UPDATE flashcards SET display_order=display_order+1000 WHERE content_id=$1", [contentId]);
    for (const [index, card] of cards.entries()) {
      if (card.id) {
        const previous = old.find((entry) => String(entry.flashcard_id) === card.id);
        if (previous.front_text !== card.front || previous.back_text !== card.back) await db.query("DELETE FROM flashcard_progress WHERE flashcard_id=$1", [card.id]);
        await db.query("UPDATE flashcards SET front_text=$2,back_text=$3,keyword=$4,display_order=$5 WHERE flashcard_id=$1", [card.id, card.front, card.back, card.keyword, index + 1]);
      } else await db.query("INSERT INTO flashcards(content_id,front_text,back_text,keyword,display_order) VALUES ($1,$2,$3,$4,$5)", [contentId, card.front, card.back, card.keyword, index + 1]);
    }
  }
  async function writeNodes(db, contentId, nodes) {
    await db.query("DELETE FROM mindmap_nodes WHERE content_id=$1", [contentId]);
    const ids = new Map();
    async function insert(node) {
      const { rows } = await db.query("INSERT INTO mindmap_nodes(content_id,parent_node_id,label,display_order) VALUES ($1,$2,$3,$4) RETURNING node_id", [contentId, node.parent === null ? null : ids.get(node.parent), node.label, ids.size + 1]);
      ids.set(node.id, rows[0].node_id);
      for (const child of nodes.filter((entry) => entry.parent === node.id)) await insert(child);
    }
    await insert(nodes.find((node) => node.parent === null));
  }
  router.get("/", async (req, res) => {
    const { rows } = await database.query("SELECT * FROM generated_contents WHERE owner_id=$1 AND content_type IN ('FLASHCARD','MINDMAP') AND status <> 'DELETED' ORDER BY created_at DESC", [req.user.userId]);
    res.json({ success: true, contents: await Promise.all(rows.map((row) => material(database, row))) });
  });
  router.post("/generate", authRateLimit(30, 15 * 60_000), async (req, res) => {
    const input = validateSettings(req.body);
    const quantity = Number(req.body.quantity ?? 6), detail = req.body.detail ?? "detailed";
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20 || !["overview", "detailed"].includes(detail)) throw httpError(400, "Chọn 1–20 thẻ và mức chi tiết hợp lệ.");
    await sources(database, req.user.userId, input.sources);
    res.json({ success: true, content: await generateStudyMaterial({ ...input, quantity, detail }) });
  });
  router.post("/", async (req, res) => {
    const input = validateSettings(req.body);
    const items = input.type === "FLASHCARD" ? validateCards(req.body.cards) : validateNodes(req.body.nodes);
    const result = await transaction(async (db) => {
      await sources(db, req.user.userId, input.sources);
      const { rows } = await db.query("INSERT INTO generated_contents(owner_id,content_type,title,difficulty,status,generation_settings) VALUES ($1,$2,$3,$4,'READY',$5) RETURNING *", [req.user.userId, input.type, input.title, difficulties[input.difficulty], { mode: "MOCK", contentRequest: input.contentRequest }]);
      for (const id of input.sources) await db.query("INSERT INTO content_sources(content_id,document_id) VALUES ($1,$2)", [rows[0].content_id, id]);
      if (input.type === "FLASHCARD") await writeCards(db, rows[0].content_id, items);
      else await writeNodes(db, rows[0].content_id, items);
      return material(db, rows[0]);
    });
    res.status(201).json({ success: true, content: result });
  });
  router.put("/:id", async (req, res) => {
    const result = await transaction(async (db) => {
      const row = await owned(db, req.user.userId, req.params.id, true);
      if (req.body?.revision !== row.revision) throw httpError(409, "Học liệu đã thay đổi. Tải lại trang trước khi chỉnh sửa.");
      const title = text(req.body.title, 150);
      if (row.content_type === "FLASHCARD") await writeCards(db, row.content_id, validateCards(req.body.cards));
      else await writeNodes(db, row.content_id, validateNodes(req.body.nodes));
      const { rows } = await db.query("UPDATE generated_contents SET title=$2,revision=revision+1 WHERE content_id=$1 RETURNING *", [row.content_id, title]);
      return material(db, rows[0]);
    });
    res.json({ success: true, content: result });
  });
  router.put("/:id/progress", async (req, res) => {
    const result = await transaction(async (db) => {
      const row = await owned(db, req.user.userId, req.params.id, true);
      if (row.content_type !== "FLASHCARD") throw httpError(400, "Chỉ Flashcard có tiến độ ghi nhớ.");
      if (req.body?.revision !== row.revision) throw httpError(409, "Bộ thẻ đã thay đổi. Tải lại trang để ôn tập.");
      if (!validId(req.body.cardId) || typeof req.body.remembered !== "boolean") throw httpError(400, "Tiến độ không hợp lệ.");
      const card = await db.query("SELECT 1 FROM flashcards WHERE flashcard_id=$1 AND content_id=$2", [req.body.cardId, row.content_id]);
      if (!card.rowCount) throw missing();
      await db.query("INSERT INTO flashcard_progress(user_id,flashcard_id,remembered) VALUES ($1,$2,$3) ON CONFLICT(user_id,flashcard_id) DO UPDATE SET remembered=EXCLUDED.remembered,updated_at=NOW()", [req.user.userId, req.body.cardId, req.body.remembered]);
      return material(db, row);
    });
    res.json({ success: true, content: result });
  });
  router.delete("/:id", async (req, res) => {
    await transaction(async (db) => {
      const row = await owned(db, req.user.userId, req.params.id, true);
      const linked = await db.query("SELECT 1 FROM class_materials WHERE content_id=$1", [row.content_id]);
      if (linked.rowCount) throw httpError(409, "Gỡ học liệu khỏi lớp trước khi xóa.");
      await db.query("UPDATE generated_contents SET status='DELETED' WHERE content_id=$1", [row.content_id]);
    });
    res.json({ success: true });
  });
  return router;
}
