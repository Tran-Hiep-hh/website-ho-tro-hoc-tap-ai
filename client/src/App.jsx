import { useEffect, useState } from "react";
import { Brand } from "./components/Brand.jsx";
import { refreshSession } from "./lib/api.js";
import AuthPage from "./pages/AuthPage.jsx";
import HomePage from "./pages/HomePage.jsx";

const currentPage = () => window.location.hash === "#/register" ? "register" : "login";

export default function App() {
  const [page, setPage] = useState(currentPage);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState("");
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const changed = () => setPage(currentPage());
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true); setSessionError("");
    refreshSession().then((account) => { if (active) setUser(account); })
      .catch((error) => { if (active && error.status !== 401) setSessionError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);

  useEffect(() => {
    document.title = `${user ? "Trang chính" : page === "register" ? "Đăng ký" : "Đăng nhập"} | StudyAI`;
    if (user) window.history.replaceState(null, "", "#/home");
    else if (!loading && window.location.hash !== "#/register") window.history.replaceState(null, "", "#/login");
  }, [user, page, loading]);

  if (loading) return <main className="session-screen"><Brand /><span className="spinner" /><p role="status">Đang mở không gian của bạn…</p></main>;
  if (sessionError) return <main className="session-screen"><Brand /><div className="notice notice-error" role="alert">{sessionError}</div><button className="primary-button" onClick={() => setRetry(retry + 1)}>Thử kết nối lại</button><button className="text-button" onClick={() => setSessionError("")}>Về trang đăng nhập</button></main>;
  if (user) return <HomePage user={user} onLogout={() => { setUser(null); setNotice("Bạn đã đăng xuất thành công."); setPage("login"); window.location.hash = "/login"; }} />;
  return <AuthPage key={page} mode={page} notice={notice} initialEmail={email}
    onLogin={(account) => { setUser(account); setNotice(""); }}
    onRegistered={(registeredEmail) => { setEmail(registeredEmail); setNotice("Tạo tài khoản thành công. Hãy đăng nhập để bắt đầu."); window.location.hash = "/login"; }} />;
}
