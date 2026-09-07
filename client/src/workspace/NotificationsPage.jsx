import { useState } from "react";
import { Icon } from "../components/Brand.jsx";
import { useWorkspace } from "./WorkspaceContext.jsx";
import { dateLabel } from "./data.js";
import { Badge, Button, Empty, PageHeading, Tabs } from "./ui.jsx";

export default function NotificationsPage() {
  const { data, setData, update, navigate } = useWorkspace();
  const [filter, setFilter] = useState("all");
  const items = data.notifications.filter(
    (item) => filter === "all" || !item.read,
  );
  return (
    <>
      <PageHeading
        title="Thông báo"
        description="Cập nhật bài Quiz và học liệu mới trong không gian học tập."
        action={
          <Button
            variant="secondary"
            icon="check"
            onClick={() =>
              setData((old) => ({
                ...old,
                notifications: old.notifications.map((item) => ({
                  ...item,
                  read: true,
                })),
              }))
            }
          >
            Đánh dấu tất cả đã đọc
          </Button>
        }
      />
      <section className="ws-panel">
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
            onClick={() => {
              update("notifications", item.id, { read: true });
              navigate(item.route);
            }}
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
