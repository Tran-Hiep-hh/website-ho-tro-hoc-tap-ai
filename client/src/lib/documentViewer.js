import { apiRequest } from "./api.js";

export async function viewDocument(item, { isPreview, navigate, notify, url: existingUrl = "" }) {
  if (isPreview || item.type !== "PDF") { navigate(`documents/${item.id}`); return; }
  let tab;
  try {
    tab = window.open(existingUrl || "about:blank", "_blank", "noopener,noreferrer");
  } catch {
    tab = null;
  }
  if (!tab) {
    notify("Trình duyệt đã chặn tab mới. Đang mở bản xem trước trong ứng dụng.");
    navigate(`documents/${item.id}`);
    return;
  }
  if (existingUrl) return;
  try {
    tab.opener = null;
    tab.document.title = item.name;
    tab.document.body.textContent = "Đang mở tài liệu PDF…";
    const file = await apiRequest(`/documents/${item.id}/download`, { blob: true });
    if (tab.closed) return;
    const url = URL.createObjectURL(new Blob([file], { type: "application/pdf" }));
    tab.location.replace(url);
    const timer = setInterval(() => {
      if (tab.closed) { URL.revokeObjectURL(url); clearInterval(timer); }
    }, 1000);
  } catch (error) {
    if (!tab.closed) tab.close();
    notify(error.message);
    navigate(`documents/${item.id}`);
  }
}
