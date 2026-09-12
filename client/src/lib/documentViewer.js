import { apiRequest } from "./api.js";

export async function viewDocument(item, { isPreview, navigate, notify }) {
  if (isPreview || item.type !== "PDF") { navigate(`documents/${item.id}`); return; }
  const tab = window.open("about:blank", "_blank");
  if (!tab) { notify("Trình duyệt đã chặn tab mới. Hãy cho phép cửa sổ bật lên để xem PDF."); return; }
  tab.opener = null;
  tab.document.title = item.name;
  tab.document.body.textContent = "Đang mở tài liệu PDF…";
  try {
    const file = await apiRequest(`/documents/${item.id}/download`, { blob: true });
    if (tab.closed) return;
    const url = URL.createObjectURL(new Blob([file], { type: "application/pdf" }));
    tab.location.replace(url);
    const timer = setInterval(() => {
      if (tab.closed) { URL.revokeObjectURL(url); clearInterval(timer); }
    }, 1000);
  } catch (error) { tab.close(); notify(error.message); }
}
