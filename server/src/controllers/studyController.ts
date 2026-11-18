// @ts-nocheck
import { pool } from "../config/database.js";
import { authRateLimit } from "../middlewares/auth.js";
import { httpError } from "../utils/httpError.js";
import { generationSettings } from "../services/aiMaterialGenerator.js";
import { aiError } from "../utils/aiError.js";
import { normalizeMindmap } from "../services/normalizeMindmap.js";
import { createSourceDocumentRepository } from "../repositories/sourceDocumentRepository.js";
import { createStudyRepository } from "../repositories/studyRepository.js";
import { createStudyContentService } from "../services/studyContentService.js";
import { createMaterialGenerationService } from "../services/materialGenerationService.js";
import { difficulties, studySettings as validateSettings, text, validateCards, validateNodes } from "../validators/studyValidator.js";

const validId = (id) => /^[1-9]\d{0,18}$/.test(String(id)) && BigInt(id) <= 9223372036854775807n;
const missing = () => httpError(404, "Không tìm thấy học liệu hoặc bạn không có quyền truy cập.");

export function createStudyController({ database = pool, studyRepository = createStudyRepository(database), studyContentService = createStudyContentService(studyRepository, difficulties, database), materialGenerationService = createMaterialGenerationService({ sourceDocumentRepository: createSourceDocumentRepository(database) }) } = {}) {
  const handlers = {};
  async function sources(db, userId, ids) {
    const result = await createSourceDocumentRepository(db).findReadyOwned(userId, ids);
    if (result.count !== ids.length) throw httpError(400, "Tài liệu phải thuộc về bạn và có văn bản sẵn sàng.");
    return ids.map((id) => result.rows.find((row) => String(row.document_id) === id));
  }
  async function writeCards(db, contentId, cards) {
    const { rows: old } = await studyRepository.findCardsForWrite(contentId, db);
    for (const card of cards) if (card.id && !old.some((entry) => String(entry.flashcard_id) === card.id)) throw httpError(400, "Thẻ không thuộc bộ học liệu này.");
    const keep = cards.filter((card) => card.id).map((card) => card.id);
    await studyRepository.deleteRemovedCards(contentId, keep, db);
    // Move existing orders out of the target range before reordering.
    await studyRepository.shiftCardOrder(contentId, db);
    for (const [index, card] of cards.entries()) {
      if (card.id) {
        const previous = old.find((entry) => String(entry.flashcard_id) === card.id);
        if (previous.front_text !== card.front || previous.back_text !== card.back) await studyRepository.deleteProgress(card.id, db);
        await studyRepository.updateCard(card.id, { ...card, order: index + 1 }, db);
      } else await studyRepository.insertCard(contentId, { ...card, order: index + 1 }, db);
    }
  }
  async function writeNodes(db, contentId, nodes) {
    await studyRepository.deleteNodes(contentId, db);
    const ids = new Map();
    async function insert(node) {
      const { rows } = await studyRepository.insertNode(contentId, { parentId: node.parent === null ? null : ids.get(node.parent), label: node.label, order: ids.size + 1 }, db);
      ids.set(node.id, rows[0].node_id);
      for (const child of nodes.filter((entry) => entry.parent === node.id)) await insert(child);
    }
    await insert(nodes.find((node) => node.parent === null));
  }
  handlers.list = async (req, res) => {
    const { rows } = await studyRepository.listOwned(req.user.userId, database);
    res.json({ success: true, contents: await Promise.all(rows.map((row) => studyContentService.material(database, row))) });
  };
  handlers.generate = async (req, res) => {
    const input = validateSettings(req.body);
    const quantity = Number(req.body.quantity ?? 6), detail = req.body.detail ?? "detailed";
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20 || !["overview", "detailed"].includes(detail)) throw httpError(400, "Chọn 1–20 thẻ và mức chi tiết hợp lệ.");
    const generated = await materialGenerationService.generateStudyMaterial(req.user.userId, { ...input, quantity, detail });
    try {
      if (input.type === "FLASHCARD") {
        generated.cards = validateCards(generated.cards?.map((card) => ({ ...card, id: undefined })));
        if (generated.cards.length !== quantity) throw new Error("quantity");
      } else generated.nodes = validateNodes(normalizeMindmap(generated.nodes));
    } catch (error) {
      if (input.type === "MINDMAP") throw aiError(502, `Mindmap do AI tạo chưa hợp lệ: ${error.statusCode === 400 ? error.message : "Không đọc được cấu trúc nút."}`);
      throw aiError(502, "AI trả về Flashcard sai cấu trúc hoặc chưa đủ số thẻ. Vui lòng thử lại.");
    }
    res.json({ success: true, content: generated });
  };
  handlers.create = async (req, res) => {
    const input = validateSettings(req.body);
    const items = input.type === "FLASHCARD" ? validateCards(req.body.cards) : validateNodes(req.body.nodes);
    const result = await studyContentService.runInTransaction(async (db) => {
      await sources(db, req.user.userId, input.sources);
      const { rows } = await studyRepository.createContent([req.user.userId, input.type, input.title, difficulties[input.difficulty], { ...generationSettings(req.body), contentRequest: input.contentRequest }], db);
      for (const id of input.sources) await studyRepository.addSource(rows[0].content_id, id, db);
      if (input.type === "FLASHCARD") await writeCards(db, rows[0].content_id, items);
      else await writeNodes(db, rows[0].content_id, items);
      return studyContentService.material(db, rows[0]);
    });
    res.status(201).json({ success: true, content: result });
  };
  handlers.update = async (req, res) => {
    const result = await studyContentService.runInTransaction(async (db) => {
      const row = await studyContentService.owned(db, req.user.userId, req.params.id, true);
      if (req.body?.revision !== row.revision) throw httpError(409, "Học liệu đã thay đổi. Tải lại trang trước khi chỉnh sửa.");
      const title = text(req.body.title, 150);
      if (row.content_type === "FLASHCARD") await writeCards(db, row.content_id, validateCards(req.body.cards));
      else await writeNodes(db, row.content_id, validateNodes(req.body.nodes));
      const { rows } = await studyRepository.updateTitle(row.content_id, title, db);
      return studyContentService.material(db, rows[0]);
    });
    res.json({ success: true, content: result });
  };
  handlers.updateProgress = async (req, res) => {
    const result = await studyContentService.runInTransaction(async (db) => {
      const row = await studyContentService.owned(db, req.user.userId, req.params.id, true);
      if (row.content_type !== "FLASHCARD") throw httpError(400, "Chỉ Flashcard có tiến độ ghi nhớ.");
      if (req.body?.revision !== row.revision) throw httpError(409, "Bộ thẻ đã thay đổi. Tải lại trang để ôn tập.");
      if (!validId(req.body.cardId) || typeof req.body.remembered !== "boolean") throw httpError(400, "Tiến độ không hợp lệ.");
      const card = await studyRepository.findCard(row.content_id, req.body.cardId, db);
      if (!card.rowCount) throw missing();
      await studyRepository.updateProgress(req.user.userId, req.body.cardId, req.body.remembered, db);
      return studyContentService.material(db, row);
    });
    res.json({ success: true, content: result });
  };
  handlers.remove = async (req, res) => {
    await studyContentService.runInTransaction(async (db) => {
      const row = await studyContentService.owned(db, req.user.userId, req.params.id, true);
      const linked = await studyRepository.hasContentLinks(row.content_id, db);
      if (linked.rowCount) throw httpError(409, "Gỡ học liệu khỏi lớp trước khi xóa.");
      await studyRepository.markDeleted(row.content_id, db);
    });
    res.json({ success: true });
  };
  return handlers;
}

