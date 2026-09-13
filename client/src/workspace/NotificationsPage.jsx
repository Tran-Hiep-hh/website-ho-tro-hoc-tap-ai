import { useState } from "react";
import { apiRequest } from "../lib/api.js";
import { Icon } from "../components/Brand.jsx";
import { useWorkspace } from "./WorkspaceContext.jsx";
import { dateLabel } from "./data.js";
import { Badge, Button, Empty, PageHeading, Tabs } from "./ui.jsx";

export default function NotificationsPage() {
  const { data, setData, update, navigate, isPreview, notify, reloadNotifications, notificationsLoading, notificationsError, reloadClasses, reloadAssignments } = useWorkspace();
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  async function markRead(item) {
    if (busy) return;
    setBusy(true);
    try {
      if (isPreview) {
        if (item) update("notifications", item.id, { read: true });
        else setData((old) => ({ ...old, notifications: old.notifications.map((entry) => ({ ...entry, read: true })) }));
      } else {
        if (item) await apiRequest(`/notifications/${item.id}/read`, { method: "PUT", body: {} });
        else if (data.notifications.length) {
          const throughId = data.notifications.reduce((highest, entry) => BigInt(entry.id) > BigInt(highest) ? entry.id : highest, "0");
          await apiRequest("/notifications/read", { method: "PUT", body: { throughId } });
        }
        await reloadNotifications();
        if (item) await Promise.all([reloadClasses(), reloadAssignments()]);
      }
      if (item) navigate(item.route);
    } catch (error) { notify(error.message); }
    finally { setBusy(false); }
  }
  const items = data.notifications.filter(
    (item) => filter === "all" || !item.read,
  );
  if (notificationsLoading) return <Empty title="Đang tải thông báo…" />;
  return (
    <>
      <PageHeading
        title="Thông báo"
        description="Cập nhật bài Quiz và học liệu mới trong không gian học tập."
        action={
          <Button
            variant="secondary"
            icon="check"
            disabled={busy || !data.notifications.some((item) => !item.read)}
            onClick={() => markRead()}
          >
            Đánh dấu tất cả đã đọc
          </Button>
        }
      />
      <section className="ws-panel">
        {!isPreview && <Button variant="secondary" disabled={busy} onClick={reloadNotifications}>Làm mới</Button>}
        {notificationsError && <p className="ws-inline-error" role="alert">{notificationsError}</p>}
        <Tabs
          items={[
            ["all", "Tất cả"],
            [
              "unread",
              `Chưa đọc (${data.notifications.filter((item) => !item.read).length})`,
            ],
          ]}
          value={filter}
          onChange={setFilter}
        />
        {items.map((item) => (
          <button
            key={item.id}
            className={`ws-notification ${!item.read ? "unread" : ""}`}
            disabled={busy}
            onClick={() => markRead(item)}
          >
            <span className="ws-icon-tile green">
              <Icon name={item.icon} />
            </span>
            <div>
              <strong>{item.title}</strong>
              <p>{item.text}</p>
              <small>{dateLabel(item.date)}</small>
            </div>
            {!item.read && <Badge>Mới</Badge>}
            <Icon name="chevron" size={18} />
          </button>
        ))}
        {!items.length && (
          <Empty
            title="Bạn đã xem hết thông báo"
            text="Thông báo mới sẽ được hiển thị tại đây."
          />
        )}
      </section>
    </>
  );
}
