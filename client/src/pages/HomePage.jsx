import { useState } from "react";
import { Brand, Icon } from "../components/Brand.jsx";
import { logout } from "../lib/api.js";

export default function HomePage({ user, onLogout }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const teacher = user.role === "TEACHER";
  async function signOut() {
    setPending(true); setError("");
    try { await logout(); onLogout(); }
    catch (failure) { setError(failure.message); }
    finally { setPending(false); }
  }
  return <div className="home-layout">
    <header className="home-header"><Brand /><div className="home-header-actions"><span className="role-badge">{teacher ? "Giáo viên" : "Người học"}</span><button className="secondary-button" onClick={signOut} disabled={pending}><Icon name="logout" size={17} />{pending ? "Đang đăng xuất…" : "Đăng xuất"}</button></div></header>
    <main className="home-main">
      {error && <div className="notice notice-error" role="alert">{error}</div>}
      <div className="welcome-banner"><div><span className="eyebrow"><span className="live-dot" /> KHÔNG GIAN {teacher ? "GIẢNG DẠY" : "HỌC TẬP"}</span><h1>Xin chào, {user.fullName}.</h1><p>{teacher ? "Chào mừng bạn đến với không gian dành cho Giáo viên." : "Chào mừng bạn đến với không gian dành cho Người học."}</p></div><div className="welcome-symbol" aria-hidden="true"><Icon name="book" size={62} /></div></div>
      <section className="account-card" aria-labelledby="account-title"><div className="account-heading"><div className="avatar">{user.fullName.trim().split(/\s+/).at(-1).slice(0, 1).toUpperCase()}</div><div><h2 id="account-title">Tài khoản của bạn</h2><p><span className="status-dot" />Đã đăng nhập thành công</p></div></div><dl className="account-details"><div><dt>Họ và tên</dt><dd>{user.fullName}</dd></div><div><dt>Địa chỉ email</dt><dd>{user.email}</dd></div><div><dt>Vai trò</dt><dd>{teacher ? "Giáo viên" : "Người học"}</dd></div></dl></section>
      <p className="home-footnote">Học một điều mới. Bắt đầu một hành trình mới.</p>
    </main>
  </div>;
}
