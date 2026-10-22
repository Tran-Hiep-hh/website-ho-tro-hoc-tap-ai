import { httpError } from "../utils/httpError.js";

export function createDocumentController({ documentService }) {
  return {
    list: async (req, res) => res.json({ success: true, documents: await documentService.list(req.user.userId) }),
    upload: async (req, res) => res.status(201).json({ success: true, document: await documentService.upload(req.user.userId, req.file) }),
    get: async (req, res) => res.json({ success: true, document: await documentService.get(req.user.userId, req.params.id) }),
    download: async (req, res, next) => {
      const row = await documentService.download(req.user.userId, req.params.id);
      res.download(row.storage_path, row.file_name, { root: documentService.storageRoot, dotfiles: "deny" }, (error) => {
        if (error && !res.headersSent) next(error.code === "ENOENT" ? httpError(404, "Tài liệu không tồn tại hoặc bạn không có quyền truy cập.") : error);
      });
    },
    remove: async (req, res) => {
      await documentService.remove(req.user.userId, req.params.id);
      res.json({ success: true });
    },
  };
}

