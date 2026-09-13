import { useState } from "react";
import { apiRequest, changePassword } from "../lib/api.js";
import { useWorkspace } from "./WorkspaceContext.jsx";
import { Badge, Button, Field, PageHeading, Tabs } from "./ui.jsx";
import { Icon } from "../components/Brand.jsx";

export default function ProfilePage() {
  const { user, data, setData, isTeacher, notify, isPreview, onUserChange } = useWorkspace();
  const [tab, setTab] = useState("profile");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const profile = isPreview ? data.profile ?? user : user;
  async function saveProfile(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (values.fullName.trim().length < 2) {
      setError("Họ tên cần ít nhất 2 ký tự.");
      return;
    }
    if (!isPreview) {
      setBusy(true); setError("");
      try {
        const result = await apiRequest("/auth/profile", { method: "PUT", body: { fullName: values.fullName } });
        onUserChange(result.user); notify("Đã lưu thông tin cá nhân.");
      } catch (err) { setError(err.message); }
      finally { setBusy(false); }
      return;
    }
    setData((old) => ({
      ...old,
      profile: { ...user, ...values, fullName: values.fullName.trim() },
    }));
    setError("");
    notify("Đã lưu hồ sơ trong bản xem trước. Tài khoản thật chưa thay đổi.");
  }
  async function passwordPreview(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (values.newPassword !== values.confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }
    if (values.newPassword === values.currentPassword) {
      setError("Mật khẩu mới cần khác mật khẩu hiện tại.");
      return;
    }
    if (!isPreview) {
      setBusy(true); setError("");
      try { await changePassword(values); }
      catch (err) { setError(err.message); }
      finally { setBusy(false); }
      return;
    }
    setError("");
    event.currentTarget.reset();
    notify(
      "Biểu mẫu hợp lệ. Đổi mật khẩu thật sẽ được kết nối ở bước triển khai API hồ sơ.",
    );
  }
  return (
    <>
      <PageHeading
        title="Hồ sơ cá nhân"
        description="Quản lý thông tin và bảo mật tài khoản của bạn."
      />
      <div className="ws-profile-layout">
        <aside className="ws-panel ws-profile-card">
          <div className="ws-large-avatar">
            {profile.fullName.split(" ").at(-1).slice(0, 1)}
          </div>
          <h2>{profile.fullName}</h2>
          <p>{profile.email}</p>
          <Badge>{isTeacher ? "Giáo viên" : "Người học"}</Badge>
          <hr />
          <div className="ws-profile-note">
            <Icon name="lock" />
            <p>
              Vai trò tài khoản được xác định khi đăng ký và không thể tự thay
              đổi.
            </p>
          </div>
        </aside>
        <section className="ws-panel">
          <Tabs
            items={[
              ["profile", "Thông tin cá nhân"],
              ["security", "Đổi mật khẩu"],
            ]}
            value={tab}
            onChange={(value) => {
              if (busy) return;
              setTab(value);
              setError("");
            }}
          />
          {error && (
            <p className="ws-inline-error" role="alert">
              {error}
            </p>
          )}
          {tab === "profile" ? (
            <form onSubmit={saveProfile} className="ws-form" key="profile">
              <h2>Thông tin của bạn</h2>
              <p className="ws-muted">
                Thông tin giúp giáo viên và người học nhận ra bạn trong lớp.
              </p>
              <Field label="Họ và tên">
                <input
                  name="fullName"
                  defaultValue={profile.fullName}
                  minLength={2}
                  maxLength={100}
                  required
                />
              </Field>
              <Field label="Địa chỉ email">
                <input
                  name="email"
                  readOnly={!isPreview}
                  type="email"
                  defaultValue={profile.email}
                  maxLength={255}
                  required
                />
              </Field>
              <Field label="Vai trò">
                <input readOnly value={isTeacher ? "Giáo viên" : "Người học"} />
              </Field>
              <div className="ws-form-footer">
                <span>{isPreview ? "Các thay đổi chỉ áp dụng trong bản xem trước." : "Email và vai trò không thể tự thay đổi."}</span>
                <Button type="submit" icon="check" disabled={busy}>
                  Lưu thông tin
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={passwordPreview} className="ws-form" key="security">
              <h2>Đổi mật khẩu</h2>
              <p className="ws-muted">
                Thiết lập mật khẩu mới với ít nhất 8 ký tự, tối đa 72 byte.
              </p>
              <Field label="Mật khẩu hiện tại">
                <input
                  type="password"
                  name="currentPassword"
                  autoComplete="current-password"
                  required
                />
              </Field>
              <Field label="Mật khẩu mới">
                <input
                  type="password"
                  name="newPassword"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </Field>
              <Field label="Xác nhận mật khẩu mới">
                <input
                  type="password"
                  name="confirmPassword"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </Field>
              <div className="ws-form-footer">
                <span>{isPreview ? "Kiểm tra biểu mẫu; chưa đổi mật khẩu thật." : "Sau khi đổi, tất cả phiên đăng nhập sẽ bị thu hồi. Bạn cần đăng nhập lại."}</span>
                <Button type="submit" icon="lock" disabled={busy}>
                  {busy ? "Đang lưu…" : isPreview ? "Kiểm tra biểu mẫu" : "Đổi mật khẩu"}
                </Button>
              </div>
            </form>
          )}
        </section>
      </div>
    </>
  );
}
