import { useRef, useState } from "react";
import { Icon } from "../components/Brand.jsx";
import { useWorkspace } from "./WorkspaceContext.jsx";
import { dateLabel, id } from "./data.js";
import { apiRequest } from "../lib/api.js";
import { viewDocument as openDocument } from "../lib/documentViewer.js";
import {
  Badge,
  Button,
  Empty,
  IconButton,
  Modal,
  PageHeading,
  Search,
  downloadText,
} from "./ui.jsx";

export default function DocumentsPage({ documentId }) {
  const { data, setData, navigate, remove, confirm, notify, ownerId, personalDocuments, accessibleDocuments, isPreview, documentsLoading, documentsError, reloadDocuments } = useWorkspace();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("ALL");
  const [upload, setUpload] = useState(false);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInput = useRef(null);
  const document = accessibleDocuments.find((item) => item.id === documentId);
  const isOwner = document?.ownerId === ownerId;
  function deleteDocument(item) {
    if (item.ownerId !== ownerId) return;
    if (isPreview && data.classes.some((cls) => cls.materialIds.includes(item.id))) {
      notify("Hãy gỡ tài liệu khỏi lớp trước khi xóa.");
      return;
    }
    confirm({
      title: "Xóa tài liệu?",
      text: `Xóa “${item.name}”? Học liệu đã tạo vẫn được giữ lại.`,
      label: "Xóa tài liệu",
      action: async () => {
        if (!isPreview) {
          try { await apiRequest(`/documents/${item.id}`, { method: "DELETE" }); }
          catch (error) { notify(error.message); return; }
        }
        remove("documents", item.id);
        if (documentId) navigate("documents");
        notify(isPreview ? "Đã xóa tài liệu trong bản xem trước." : "Đã xóa tài liệu.");
      },
    });
  }
  async function addFiles() {
    setError("");
    if (!files.length) {
      setError("Vui lòng chọn ít nhất một tệp.");
      return;
    }
    if (
      files.some(
        (file) =>
          !/\.(pdf|docx|txt)$/i.test(file.name) ||
          file.size > 10 * 1024 * 1024 ||
          file.size === 0,
      )
    ) {
      setError("Chỉ nhận PDF, DOCX, TXT có nội dung, tối đa 10 MB mỗi tệp.");
      return;
    }
    setBusy(true);
    try {
      if (!isPreview) {
        for (const file of files) {
          const body = new FormData();
          body.append("file", file);
          const result = await apiRequest("/documents", { method: "POST", body });
          setData((old) => ({ ...old, documents: [result.document, ...old.documents] }));
          setFiles((old) => old.filter((entry) => entry !== file));
        }
        setUpload(false);
        notify("Đã tải lên và xử lý tài liệu.");
        return;
      }
      const newDocuments = await Promise.all(
        files.map(async (file) => ({
          id: id(),
          ownerId,
          name: file.name,
          type: file.name.split(".").at(-1).toUpperCase(),
          size: `${(file.size / 1024).toFixed(1)} KB`,
          date: new Date().toISOString(),
          status: /\.txt$/i.test(file.name) ? "READY" : "PROCESSING",
          text: /\.txt$/i.test(file.name)
            ? await file.text()
            : "Tệp đã được chọn trong bản xem trước. Trích xuất nội dung PDF/DOCX sẽ được kết nối với dịch vụ xử lý tài liệu ở bước tiếp theo.",
        })),
      );
      setData((old) => ({
        ...old,
        documents: [...newDocuments, ...old.documents],
      }));
      setUpload(false);
      setFiles([]);
      notify("Đã thêm tài liệu vào bản xem trước; chưa tải lên máy chủ.");
    } catch (error) {
      setError(error.message || "Không thể đọc tệp. Vui lòng chọn lại.");
    } finally {
      setBusy(false);
    }
  }
  async function downloadDocument(item = document) {
    if (isPreview) { downloadText(item.text, `${item.name}.txt`); return; }
    try {
      const blob = await apiRequest(`/documents/${item.id}/download`, { blob: true });
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = url; anchor.download = item.name; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { notify(error.message); }
  }
  const viewDocument = (item) => openDocument(item, { isPreview, navigate, notify });
  if (documentsLoading) return <PageHeading title="Đang tải tài liệu…" />;
  if (documentsError) return <Empty title="Không tải được tài liệu" text={documentsError} action={<Button onClick={reloadDocuments}>Thử lại</Button>} />;
  if (documentId)
    return document ? (
      <>
        <Button
          variant="ghost"
          icon="back"
          onClick={() => navigate(isOwner ? "documents" : "contents")}
        >
          {isOwner ? "Tài liệu cá nhân" : "Học liệu lớp học"}
        </Button>
        <PageHeading
          title={document.name}
          description={`${document.type} · ${document.size} · Thêm ngày ${dateLabel(document.date)}`}
          action={
            <>
              {!isPreview && document.type === "PDF" && (
                <Button variant="secondary" icon="eye" onClick={() => viewDocument(document)}>
                  Xem PDF trong tab mới
                </Button>
              )}
              <Button
                variant="secondary"
                icon="download"
                onClick={() => downloadDocument()}
              >
                {isPreview ? "Tải văn bản xem trước" : "Tải tệp gốc"}
              </Button>
              {isOwner && <Button
                icon="spark"
                disabled={document.status !== "READY"}
                onClick={() => navigate(`generate/${document.id}`)}
              >
                Tạo học liệu
              </Button>}
            </>
          }
        />
        <div className="ws-document-layout">
          <article className="ws-paper">
            <div className="ws-paper-top">
              <Badge tone="gray">VĂN BẢN XEM TRƯỚC</Badge>
              <Icon name="file" />
            </div>
            <pre>{document.text || "Không tìm thấy văn bản trong tài liệu. Nếu đây là PDF dạng ảnh, hãy dùng bản PDF có văn bản hoặc chuyển sang DOCX/TXT."}</pre>
          </article>
          <aside className="ws-panel">
            <h2>Thông tin tài liệu</h2>
            <dl className="ws-detail-list">
              <dt>Định dạng</dt>
              <dd>{document.type}</dd>
              <dt>Dung lượng</dt>
              <dd>{document.size}</dd>
              <dt>Trạng thái</dt>
              <dd>
                <Badge tone={document.status === "READY" ? "green" : "orange"}>
                  {document.status === "READY" ? "Sẵn sàng" : document.status === "FAILED" ? "Không có văn bản đọc được" : "Chờ xử lý"}
                </Badge>
              </dd>
              <dt>Học liệu liên quan</dt>
              <dd>
                {
                  data.contents.filter((item) =>
                    item.sources.includes(document.id),
                  ).length
                }{" "}
                nội dung
              </dd>
            </dl>
            {isOwner && <Button
              variant="danger"
              icon="trash"
              onClick={() => deleteDocument(document)}
            >
              Xóa tài liệu
            </Button>}
          </aside>
        </div>
      </>
    ) : (
      <Empty
        title="Tài liệu không còn tồn tại"
        action={
          <Button onClick={() => navigate("documents")}>Về danh sách</Button>
        }
      />
    );
  const items = personalDocuments.filter(
    (item) =>
      item.name
        .toLocaleLowerCase("vi")
        .includes(query.toLocaleLowerCase("vi")) &&
      (type === "ALL" || item.type === type),
  );
  return (
    <>
      <PageHeading
        title="Tài liệu cá nhân"
        description="Chỉ gồm tài liệu do bạn tải lên. Tài liệu giáo viên chia sẻ nằm trong Học liệu."
        action={
          <Button icon="upload" onClick={() => setUpload(true)}>
            Thêm tài liệu
          </Button>
        }
      />
      <div className="ws-info-banner">
        <span className="ws-icon-tile green">
          <Icon name="file" />
        </span>
        <div>
          <strong>Một tài liệu, nhiều cách học</strong>
          <p>
            Chọn tài liệu để tạo Quiz, Flashcard hoặc hệ thống hóa kiến thức
            bằng Mindmap.
          </p>
        </div>
        <Button
          variant="secondary"
          icon="spark"
          onClick={() => navigate("generate")}
        >
          Tạo học liệu AI
        </Button>
      </div>
      <section className="ws-panel">
        <div className="ws-toolbar">
          <Search
            value={query}
            onChange={setQuery}
            placeholder="Tìm theo tên tài liệu…"
          />
          <div className="ws-actions">
            <span className="ws-muted">{items.length} tài liệu</span>
            <select
              className="ws-select"
              aria-label="Lọc định dạng"
              value={type}
              onChange={(event) => setType(event.target.value)}
            >
              <option value="ALL">Tất cả định dạng</option>
              {["PDF", "DOCX", "TXT"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </div>
        </div>
        {items.length ? (
          <table className="ws-table">
            <thead>
              <tr>
                <th>Tên tài liệu</th>
                <th>Dung lượng</th>
                <th>Ngày thêm</th>
                <th>Trạng thái</th>
                <th className="ws-align-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <button
                      className="ws-table-name"
                      onClick={() => viewDocument(item)}
                    >
                      <span
                        className={`ws-file-label ${item.type.toLowerCase()}`}
                      >
                        {item.type}
                      </span>
                      <span>
                        {item.name}
                        <small>Tài liệu cá nhân</small>
                      </span>
                    </button>
                  </td>
                  <td>{item.size}</td>
                  <td>{dateLabel(item.date)}</td>
                  <td>
                    <Badge tone={item.status === "READY" ? "green" : "orange"}>
                      {item.status === "READY" ? "Sẵn sàng" : item.status === "FAILED" ? "Không có văn bản đọc được" : "Chờ xử lý"}
                    </Badge>
                  </td>
                  <td>
                    <div className="ws-row-actions">
                      <IconButton
                        icon="eye"
                        label={`Xem ${item.name}`}
                        onClick={() => viewDocument(item)}
                      />
                      <IconButton
                        icon="spark"
                        label={`Tạo học liệu từ ${item.name}`}
                        disabled={item.status !== "READY"}
                        onClick={() => navigate(`generate/${item.id}`)}
                      />
                      {!isPreview && (
                        <IconButton
                          icon="download"
                          label={`Tải xuống ${item.name}`}
                          onClick={() => downloadDocument(item)}
                        />
                      )}
                      <IconButton
                        icon="trash"
                        label={`Xóa ${item.name}`}
                        onClick={() => deleteDocument(item)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty
            title="Không có tài liệu phù hợp"
            text="Thử đổi bộ lọc hoặc thêm tài liệu mới."
          />
        )}
      </section>
      {upload && (
        <Modal
          title="Thêm tài liệu học tập"
          onClose={() => !busy && setUpload(false)}
        >
          <p className="ws-muted">
            {isPreview ? "Chọn tài liệu từ máy tính. Tệp chỉ được đọc trong trình duyệt ở bản xem trước này." : "Tải PDF, DOCX hoặc TXT lên để lưu và trích xuất nội dung. PDF dạng ảnh chưa hỗ trợ nhận diện chữ (OCR)."}
          </p>
          <input
            ref={fileInput}
            type="file"
            accept=".pdf,.docx,.txt"
            multiple
            hidden
            onChange={(event) => {
              setFiles(Array.from(event.target.files));
              setError("");
            }}
          />
          <button
            className="ws-dropzone"
            onClick={() => fileInput.current.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              setFiles(Array.from(event.dataTransfer.files));
            }}
          >
            <Icon name="upload" size={30} />
            <strong>Kéo thả tài liệu vào đây</strong>
            <span>hoặc nhấn để chọn tệp</span>
            <small>PDF, DOCX, TXT · Tối đa 10 MB/tệp</small>
          </button>
          {files.map((file, index) => (
            <div className="ws-selected-file" key={`${file.name}-${index}`}>
              <Icon name="file" size={17} />
              {file.name}
              <small>{(file.size / 1024).toFixed(1)} KB</small>
            </div>
          ))}
          {error && (
            <p className="ws-inline-error" role="alert">
              {error}
            </p>
          )}
          <div className="ws-modal-actions">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setUpload(false)}
            >
              Hủy
            </Button>
            <Button icon="upload" disabled={busy} onClick={addFiles}>
              {busy ? "Đang xử lý…" : isPreview ? "Thêm vào bản xem trước" : "Tải tài liệu lên"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
