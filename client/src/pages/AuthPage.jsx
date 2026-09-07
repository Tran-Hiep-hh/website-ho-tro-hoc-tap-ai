import { useState } from "react";
import { Brand, Icon } from "../components/Brand.jsx";
import { login, register } from "../lib/api.js";

function Field({ label, name, error, hint, password = false, ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <div className="input-wrap">
        <input
          id={name}
          name={name}
          className={password ? "password-input" : ""}
          type={password ? (visible ? "text" : "password") : "text"}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error ? `${name}-error` : hint ? `${name}-hint` : undefined
          }
          {...props}
        />
        {password && (
          <button
            type="button"
            className="password-toggle"
            onClick={() => setVisible(!visible)}
            aria-label={`${visible ? "Ẩn" : "Hiện"} ${label.toLowerCase()}`}
            aria-pressed={visible}
          >
            <Icon name={visible ? "hidden" : "eye"} size={19} />
          </button>
        )}
      </div>
      {error ? (
        <p className="field-error" id={`${name}-error`}>
          {error}
        </p>
      ) : (
        hint && (
          <p className="field-hint" id={`${name}-hint`}>
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export default function AuthPage({
  mode,
  onLogin,
  onRegistered,
  initialEmail = "",
  notice,
}) {
  const registering = mode === "register";
  const [role, setRole] = useState("STUDENT");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({});

  async function submit(event) {
    event.preventDefault();
    if (pending) return;
    const input = Object.fromEntries(new FormData(event.currentTarget));
    setError("");
    setErrors({});
    if (registering && input.password !== input.confirmPassword) {
      setErrors({ confirmPassword: "Mật khẩu xác nhận không khớp." });
      event.currentTarget.elements.confirmPassword.focus();
      return;
    }
    setPending(true);
    try {
      if (registering) {
        const result = await register({ ...input, role });
        onRegistered(result.user.email);
      } else onLogin(await login(input));
    } catch (failure) {
      setError(failure.message);
      setErrors(failure.errors ?? {});
      const first = Object.keys(failure.errors ?? {})[0];
      if (first) document.getElementById(first)?.focus();
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="auth-layout">
      <aside className="auth-story">
        <Brand light />
        <div className="story-content">
          <span className="eyebrow">
            <span className="live-dot" /> KHÔNG GIAN HỌC TẬP CỦA BẠN
          </span>
          <h1>
            Hiểu sâu hơn.
            <br />
            Ghi nhớ lâu hơn.
            <br />
            <span>Học theo cách của bạn.</span>
          </h1>
          <p>
            Biến tài liệu thành Quiz, Flashcard và Mindmap. Kết nối việc tự học
            với lớp học trong cùng một không gian.
          </p>
          <div className="study-preview" aria-hidden="true">
            <div className="preview-top">
              <span className="preview-icon">
                <Icon name="spark" />
              </span>
              <div>
                <strong>Từ tài liệu đến kiến thức</strong>
                <small>Mỗi ngày, thêm một điều mới.</small>
              </div>
              <span className="preview-dots">···</span>
            </div>
            <div className="preview-source">
              <Icon name="book" size={18} />
              <span>Tài liệu học tập của bạn</span>
              <Icon name="check" size={16} />
            </div>
            <div className="preview-connect" />
            <div className="preview-tools">
              <span>
                <b>?</b>Quiz
              </span>
              <span>
                <b>↔</b>Flashcard
              </span>
              <span>
                <b>✧</b>Mindmap
              </span>
            </div>
          </div>
          <div className="story-note">
            <span className="note-check">
              <Icon name="check" size={14} />
            </span>
            Dành cho cả Giáo viên và Người học
          </div>
        </div>
        <p className="story-footer">
          Một nơi để dạy, học và phát triển mỗi ngày.
        </p>
      </aside>
      <section className="auth-panel" aria-labelledby="form-title">
        <div className="auth-switch">
          <span>{registering ? "Đã có tài khoản?" : "Chưa có tài khoản?"}</span>
          <a href={registering ? "#/login" : "#/register"}>
            {registering ? "Đăng nhập" : "Tạo tài khoản"}
            <Icon name="arrow" size={16} />
          </a>
        </div>
        <div className="form-container">
          <span className="form-eyebrow">
            {registering ? "BẮT ĐẦU HÀNH TRÌNH" : "CHÀO MỪNG TRỞ LẠI"}
          </span>
          <h2 id="form-title">
            {registering ? "Tạo tài khoản của bạn" : "Đăng nhập vào StudyAI"}
          </h2>
          <p className="form-intro">
            {registering
              ? "Chọn vai trò và cùng bắt đầu một cách học mới."
              : "Tiếp tục hành trình học tập từ nơi bạn đã dừng lại."}
          </p>
          {!registering && notice && (
            <div className="notice notice-success" role="status">
              <Icon name="check" size={18} />
              <span>{notice}</span>
            </div>
          )}
          {error && (
            <div className="notice notice-error" role="alert">
              {error}
            </div>
          )}
          <form onSubmit={submit} aria-busy={pending}>
            <fieldset disabled={pending} className="form-fields">
              {registering && (
                <fieldset className="role-picker">
                  <legend>Bạn sử dụng StudyAI với vai trò</legend>
                  <div className="role-options">
                    {[
                      ["STUDENT", "Người học", "Tự học & tham gia lớp"],
                      ["TEACHER", "Giáo viên", "Giảng dạy & quản lý lớp"],
                    ].map(([value, title, description]) => (
                      <label
                        key={value}
                        className={`role-option ${role === value ? "selected" : ""}`}
                      >
                        <input
                          type="radio"
                          name="role"
                          value={value}
                          checked={role === value}
                          onChange={() => setRole(value)}
                        />
                        <span>
                          <strong>{title}</strong>
                          <small>{description}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                  {errors.role && <p className="field-error">{errors.role}</p>}
                </fieldset>
              )}
              {registering && (
                <Field
                  label="Họ và tên"
                  name="fullName"
                  autoComplete="name"
                  placeholder="Nhập họ tên của bạn"
                  minLength={2}
                  maxLength={100}
                  required
                  error={errors.fullName}
                />
              )}
              <Field
                label="Email"
                name="email"
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="ban@example.com"
                maxLength={255}
                defaultValue={initialEmail}
                required
                error={errors.email}
              />
              <Field
                label="Mật khẩu"
                name="password"
                password
                autoComplete={registering ? "new-password" : "current-password"}
                placeholder={
                  registering ? "Tạo mật khẩu của bạn" : "Nhập mật khẩu"
                }
                minLength={registering ? 8 : undefined}
                required
                error={errors.password}
                hint={
                  registering
                    ? "Sử dụng ít nhất 8 ký tự cho mật khẩu của bạn."
                    : undefined
                }
              />
              {registering && (
                <Field
                  label="Xác nhận mật khẩu"
                  name="confirmPassword"
                  password
                  autoComplete="new-password"
                  placeholder="Nhập lại mật khẩu"
                  required
                  error={errors.confirmPassword}
                />
              )}
              <button type="submit" className="primary-button">
                {pending ? (
                  <>
                    <span className="spinner" />
                    {registering ? "Đang tạo tài khoản…" : "Đang đăng nhập…"}
                  </>
                ) : (
                  <>
                    {registering ? "Tạo tài khoản" : "Đăng nhập"}
                    <Icon name="arrow" size={18} />
                  </>
                )}
              </button>
            </fieldset>
          </form>
          <p className="auth-security">
            <Icon name="lock" size={15} />
            Thông tin của bạn được bảo vệ trong mỗi phiên học.
          </p>
          <div
            style={{
              marginTop: 22,
              fontSize: 11,
              textAlign: "center",
              color: "#7a8c70",
            }}
          >
            Xem giao diện mẫu:{" "}
            <a
              style={{ textDecoration: "underline", marginLeft: 5 }}
              href="#/preview/teacher/home"
            >
              Giáo viên
            </a>
            <span> · </span>
            <a
              style={{ textDecoration: "underline" }}
              href="#/preview/student/home"
            >
              Người học
            </a>
          </div>
        </div>
        <footer className="panel-footer">
          StudyAI <span>·</span> Website hỗ trợ dạy và học ứng dụng AI
        </footer>
      </section>
    </main>
  );
}
