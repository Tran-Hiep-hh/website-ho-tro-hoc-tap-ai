import { useEffect, useId, useRef } from "react";
import { Icon } from "../components/Brand.jsx";

export function Button({
  children,
  icon,
  variant = "primary",
  className = "",
  ...props
}) {
  return (
    <button
      className={`ws-button ${variant} ${className}`}
      type="button"
      {...props}
    >
      {icon && <Icon name={icon} size={17} />}
      {children}
    </button>
  );
}
export function IconButton({ icon, label, ...props }) {
  return (
    <button
      type="button"
      className="ws-icon-button"
      aria-label={label}
      title={label}
      {...props}
    >
      <Icon name={icon} size={17} />
    </button>
  );
}
export function Badge({ children, tone = "green" }) {
  return <span className={`ws-badge ${tone}`}>{children}</span>;
}
export function PageHeading({ title, description, action, eyebrow }) {
  return (
    <div className="ws-page-heading">
      <div>
        {eyebrow && <span className="ws-eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action && <div className="ws-actions">{action}</div>}
    </div>
  );
}
export function Search({ value, onChange, placeholder = "Tìm kiếm…" }) {
  return (
    <label className="ws-search">
      <Icon name="search" size={18} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
export function Empty({
  title = "Chưa có nội dung",
  text = "Nội dung sẽ xuất hiện tại đây khi bạn thêm mới.",
  action,
}) {
  return (
    <div className="ws-empty">
      <span>
        <Icon name="folder" size={32} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function Tabs({ items, value, onChange }) {
  return (
    <div className="ws-tabs">
      {items.map(([key, label]) => (
        <button
          type="button"
          key={key}
          className={key === value ? "active" : ""}
          aria-pressed={key === value}
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
export function Field({ label, children, hint }) {
  return (
    <label className="ws-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Modal({ title, children, onClose, wide = false }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={`ws-dialog ${wide ? "wide" : ""}`}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="ws-dialog-inner">
        <header>
          <h2 id={titleId}>{title}</h2>
          <IconButton icon="close" label="Đóng" onClick={onClose} />
        </header>
        {children}
      </div>
    </dialog>
  );
}
export function Progress({ value }) {
  return (
    <div
      className="ws-progress"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Tiến độ"
    >
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
export function downloadText(text, name, mime = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
