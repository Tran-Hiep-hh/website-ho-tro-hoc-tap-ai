import { useState } from "react";
import { Brand, Icon } from "../components/Brand.jsx";
import { logout } from "../lib/api.js";
import { initialData } from "./data.js";
import { WorkspaceProvider, useWorkspace } from "./WorkspaceContext.jsx";
import { Badge, Button, Empty, Modal, Search } from "./ui.jsx";
import DashboardPage from "./DashboardPage.jsx";
import ProfilePage from "./ProfilePage.jsx";
import NotificationsPage from "./NotificationsPage.jsx";
import DocumentsPage from "./DocumentsPage.jsx";
import ClassesPage from "./ClassesPage.jsx";
import { LibraryPage, GeneratePage } from "./LearningPages.jsx";
import ContentPage from "./ContentPage.jsx";
import AssignmentsPage from "./AssignmentsPage.jsx";
import QuizPlayer from "./QuizPlayer.jsx";
import ResultsPage from "./ResultsPage.jsx";
import "./workspace.css";
import "./pages.css";
import "./quiz.css";
import "./colors.css";

const navigation = [
  ["home", "Tổng quan", "grid"],
  ["documents", "Tài liệu cá nhân", "file"],
  ["contents", "Học liệu", "spark"],
  ["classes", "Lớp học", "users"],
  ["assignments", "Bài Quiz được giao", "quiz"],
  ["results", "Kết quả học tập", "chart"],
];

function Shell({ route, previewRole, onLogout }) {
  const { data, setData, user, isTeacher, href, navigate, notify, confirm, accessibleDocuments, quizzesLoading, quizzesError, reloadQuizzes, documentsLoading, documentsError, reloadDocuments, classesLoading, classesError, reloadClasses, assignmentsLoading, assignmentsError, reloadAssignments } =
    useWorkspace();
  const [pending, setPending] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const section = route.split("/")[0] || "home";
  const activeSection = ["content", "generate"].includes(section) ? "contents" : section === "play" ? (route.split("/")[1] === "assignment" ? "assignments" : "contents") : section;
  const label =
    navigation.find(([key]) => key === section)?.[1] ??
    {
      profile: "Hồ sơ cá nhân",
      notifications: "Thông báo",
      generate: "Tạo học liệu",
      content: "Chi tiết học liệu",
      play: "Làm Quiz",
    }[section] ??
    "StudyAI";
  const unread = data.notifications.filter((item) => !item.read).length;
  async function signOut() {
    if (previewRole) {
      window.location.hash = "/login";
      return;
    }
    setPending(true);
    try {
      await logout();
      onLogout();
    } catch (error) {
      notify(error.message);
    } finally {
      setPending(false);
    }
  }
  const searchItems = [
    ...accessibleDocuments.map((item) => ({
      title: item.name,
      route: `documents/${item.id}`,
      icon: "file",
    })),
    ...data.contents.map((item) => ({
      title: item.title,
      route: `content/${item.id}`,
      icon: "spark",
    })),
    ...data.classes
      .filter((item) => isTeacher || item.joined)
      .map((item) => ({
        title: item.name,
        route: `classes/${item.id}`,
        icon: "users",
      })),
  ].filter((item) =>
    item.title.toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi")),
  );
  let page;
  if (section === "home") page = <DashboardPage />;
  else if (section === "profile") page = <ProfilePage />;
  else if (section === "notifications") page = <NotificationsPage />;
  else if (section === "documents")
    page = <DocumentsPage documentId={route.split("/")[1]} />;
  else if (section === "classes")
    page = <ClassesPage classId={route.split("/")[1]} initialTab={route.split("/")[2]} />;
  else if (section === "contents") page = <LibraryPage />;
  else if (section === "generate")
    page = <GeneratePage sourceId={route.split("/")[1]} />;
  else if (section === "content")
    page = <ContentPage contentId={route.split("/")[1]} />;
  else if (section === "assignments")
    page = <AssignmentsPage segments={route.split("/").slice(1)} />;
  else if (section === "play")
    page = (
      <QuizPlayer mode={route.split("/")[1]} targetId={route.split("/")[2]} />
    );
  else if (section === "results")
    page = <ResultsPage segments={route.split("/").slice(1)} />;
  else
    page = (
      <Empty
        title="Không tìm thấy trang"
        text="Đường dẫn không hợp lệ. Bạn có thể quay lại trang tổng quan."
        action={<Button onClick={() => navigate("home")}>Về tổng quan</Button>}
      />
    );
  if (["contents", "content", "play", "results", "assignments"].includes(section)) {
    if (quizzesLoading) page = <Empty title="Đang tải học liệu và kết quả…" />;
    else if (quizzesError) page = <Empty title="Không tải được học liệu" text={quizzesError} action={<Button onClick={reloadQuizzes}>Thử lại</Button>} />;
  }
  if (section === "generate") {
    if (documentsLoading) page = <Empty title="Đang tải tài liệu nguồn…" />;
    else if (documentsError) page = <Empty title="Không tải được tài liệu" text={documentsError} action={<Button onClick={reloadDocuments}>Thử lại</Button>} />;
  }
  if (["contents", "assignments", "results"].includes(section) || (section === "documents" && route.split("/")[1])) {
    if (classesLoading) page = <Empty title="Đang tải tài liệu lớp…" />;
    else if (classesError) page = <Empty title="Không tải được tài liệu lớp" text={classesError} action={<Button onClick={reloadClasses}>Thử lại</Button>} />;
  }
  if (["assignments", "results", "classes"].includes(section) || (section === "play" && route.split("/")[1] === "assignment")) {
    if (assignmentsLoading) page = <Empty title="Đang tải bài giao và kết quả…" />;
    else if (assignmentsError) page = <Empty title="Không tải được bài giao" text={assignmentsError} action={<Button onClick={reloadAssignments}>Thử lại</Button>} />;
  }
  return (
    <div className="ws-app">
      <aside className="ws-sidebar">
        <Brand href={href("home")} />
        <div className="ws-space-label">KHÔNG GIAN CỦA BẠN</div>
        <nav aria-label="Điều hướng chính">
          {navigation.map(([key, text, icon]) => (
            <a
              key={key}
              className={activeSection === key ? "active" : ""}
              href={href(key)}
              aria-current={activeSection === key ? "page" : undefined}
            >
              <Icon name={icon} size={19} />
              <span>
                {key === "assignments" && isTeacher ? "Giao Quiz" : text}
              </span>
              {key === "classes" && (
                <small>
                  {
                    data.classes.filter((item) => isTeacher || item.joined)
                      .length
                  }
                </small>
              )}
            </a>
          ))}
        </nav>
        <div className="ws-sidebar-tip">
          <span>
            <Icon name="spark" size={18} />
            Học một cách chủ động
          </span>
          <p>Bắt đầu với một tài liệu, khám phá nhiều cách ghi nhớ.</p>
          <a href={href("generate")}>
            Tạo học liệu <Icon name="arrow" size={15} />
          </a>
        </div>
        <nav className="ws-bottom-nav" aria-label="Tài khoản">
          <a
            className={section === "notifications" ? "active" : ""}
            href={href("notifications")}
          >
            <Icon name="bell" size={19} />
            Thông báo{unread > 0 && <small>{unread}</small>}
          </a>
          <a
            className={section === "profile" ? "active" : ""}
            href={href("profile")}
          >
            <Icon name="settings" size={19} />
            Hồ sơ cá nhân
          </a>
        </nav>
        <a className="ws-sidebar-user" href={href("profile")}>
          <span className="avatar">
            {user.fullName.split(" ").at(-1).slice(0, 1)}
          </span>
          <span>
            <strong>{user.fullName}</strong>
            <small data-testid="current-role">
              {isTeacher ? "Giáo viên" : "Người học"}
            </small>
          </span>
          <Icon name="chevron" size={16} />
        </a>
        <button className="ws-logout" onClick={signOut} disabled={pending}>
          <Icon name="logout" size={16} />
          {previewRole
            ? "Về đăng nhập"
            : pending
              ? "Đang đăng xuất…"
              : "Đăng xuất"}
        </button>
      </aside>
      <div className="ws-main-area">
        <header className="ws-topbar">
          <div className="ws-breadcrumb">
            Không gian học tập <Icon name="chevron" size={13} />
            <strong>{label}</strong>
          </div>
          <div className="ws-topbar-actions">
            <button
              className="ws-top-search"
              onClick={() => setSearchOpen(true)}
            >
              <Icon name="search" size={17} />
              Tìm kiếm trong không gian
            </button>
            <a
              href={href("notifications")}
              className="ws-bell"
              aria-label={`Thông báo, ${unread} chưa đọc`}
            >
              <Icon name="bell" />
              {unread > 0 && <span className="ws-notification-count" aria-hidden="true">{unread > 99 ? "99+" : unread}</span>}
            </a>
            <a className="ws-top-avatar" href={href("profile")} aria-label="Mở hồ sơ cá nhân" title="Hồ sơ cá nhân">
              {user.fullName.split(" ").at(-1).slice(0, 1)}
            </a>
          </div>
        </header>
        <div className="ws-preview-strip">
          <span>
            <Badge tone="orange">{previewRole ? "Bản xem trước" : "AI giả lập"}</Badge> {previewRole ? "Dữ liệu học tập là dữ liệu mẫu. Thao tác được giữ trong phiên xem này." : "Tài liệu, học liệu, lớp học, bài giao, kết quả và thông báo được lưu trên máy chủ. Nội dung AI đang giả lập."}
          </span>
          <div>
            {previewRole && (
              <select
                aria-label="Xem theo vai trò"
                value={previewRole}
                onChange={(event) => {
                  window.location.hash = `/preview/${event.target.value}/home`;
                }}
              >
                <option value="teacher">Giáo viên</option>
                <option value="student">Người học</option>
              </select>
            )}
            <button
              onClick={() =>
                confirm({
                  title: "Đặt lại dữ liệu mẫu?",
                  text: "Các thay đổi trong bản xem trước sẽ được đặt lại. Tài khoản thật không bị ảnh hưởng.",
                  label: "Đặt lại",
                  action: () => {
                    setData((old) => ({ ...initialData(user), ...(!previewRole ? { notifications: old.notifications, documents: old.documents, contents: old.contents, learned: old.learned, attempts: old.attempts, classes: old.classes, members: old.members, requests: old.requests, sharedDocuments: old.sharedDocuments, assignments: old.assignments, classAttempts: old.classAttempts } : {}) }));
                    navigate("home");
                  },
                })
              }
            >
              <Icon name="refresh" size={13} />
              Đặt lại
            </button>
          </div>
        </div>
        <main className="ws-content" key={route}>
          {page}
        </main>
        <footer className="ws-footer">
          StudyAI · Hỗ trợ dạy và học cùng trí tuệ nhân tạo
          <span>{new Date().getFullYear()}</span>
        </footer>
      </div>
      {searchOpen && (
        <Modal
          title="Tìm kiếm trong không gian"
          onClose={() => setSearchOpen(false)}
        >
          <Search
            value={query}
            onChange={setQuery}
            placeholder="Tìm tài liệu, học liệu hoặc lớp học…"
          />
          <div className="ws-search-results">
            {searchItems.map((item) => (
              <button
                key={item.route}
                onClick={() => {
                  navigate(item.route);
                  setSearchOpen(false);
                }}
              >
                <Icon name={item.icon} size={18} />
                {item.title}
                <Icon name="chevron" size={15} />
              </button>
            ))}
            {!searchItems.length && (
              <Empty
                title="Không tìm thấy kết quả"
                text="Thử một từ khóa ngắn hơn."
              />
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

export default function Workspace(props) {
  return (
    <WorkspaceProvider user={props.user} previewRole={props.previewRole} onUserChange={props.onUserChange}>
      <Shell {...props} />
    </WorkspaceProvider>
  );
}
