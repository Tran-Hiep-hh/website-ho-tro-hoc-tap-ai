import { useEffect, useState } from "react";
import { Brand } from "./components/Brand.jsx";
import { refreshSession } from "./lib/api.js";
import AuthPage from "./pages/AuthPage.jsx";
import Workspace from "./workspace/Workspace.jsx";

const currentPage = () =>
  window.location.hash === "#/register" ? "register" : "login";
const currentRoute = () => window.location.hash.replace(/^#\//, "") || "home";

export default function App() {
  const [page, setPage] = useState(currentPage);
  const [route, setRoute] = useState(currentRoute);
  const previewRole = /^preview\/(teacher|student)(\/|$)/.exec(route)?.[1];
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState("");
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const changed = () => {
      setPage(currentPage());
      setRoute(currentRoute());
    };
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);

  useEffect(() => {
    let active = true;
    if (previewRole) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setSessionError("");
    refreshSession()
      .then((account) => {
        if (active) setUser(account);
      })
      .catch((error) => {
        if (!active) return;
        if (error.status === 401) setUser(null);
        else setSessionError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [retry, previewRole]);

  useEffect(() => {
    document.title = `${previewRole ? "Xem trước giao diện" : user ? "Không gian học tập" : page === "register" ? "Đăng ký" : "Đăng nhập"} | StudyAI`;
    if (previewRole) return;
    if (user && ["login", "register"].includes(route))
      window.location.hash = "/home";
    else if (!user && !loading && !["login", "register"].includes(route))
      window.location.hash = "/login";
  }, [user, page, loading, route, previewRole]);

  if (previewRole)
    return (
      <Workspace
        key={previewRole}
        previewRole={previewRole}
        route={route.split("/").slice(2).join("/") || "home"}
        user={{
          userId: `preview-${previewRole}`,
          fullName:
            previewRole === "teacher" ? "Nguyễn Minh Anh" : "Trần Minh An",
          email: `${previewRole}@example.com`,
          role: previewRole === "teacher" ? "TEACHER" : "STUDENT",
        }}
      />
    );
  if (loading)
    return (
      <main className="session-screen">
        <Brand />
        <span className="spinner" />
        <p role="status">Đang mở không gian của bạn…</p>
      </main>
    );
  if (sessionError)
    return (
      <main className="session-screen">
        <Brand />
        <div className="notice notice-error" role="alert">
          {sessionError}
        </div>
        <button className="primary-button" onClick={() => setRetry(retry + 1)}>
          Thử kết nối lại
        </button>
        <button className="text-button" onClick={() => setSessionError("")}>
          Về trang đăng nhập
        </button>
      </main>
    );
  if (user)
    return (
      <Workspace
        route={route}
        user={user}
        onLogout={() => {
          setUser(null);
          setNotice("Bạn đã đăng xuất thành công.");
          setPage("login");
          window.location.hash = "/login";
        }}
      />
    );
  return (
    <AuthPage
      key={page}
      mode={page}
      notice={notice}
      initialEmail={email}
      onLogin={(account) => {
        setUser(account);
        setRoute("home");
        window.location.hash = "/home";
        setNotice("");
      }}
      onRegistered={(registeredEmail) => {
        setEmail(registeredEmail);
        setNotice("Tạo tài khoản thành công. Hãy đăng nhập để bắt đầu.");
        window.location.hash = "/login";
      }}
    />
  );
}
