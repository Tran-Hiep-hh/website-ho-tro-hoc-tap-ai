import { createContext, useContext, useEffect, useState } from "react";
import { initialData } from "./data.js";
import { Button, Modal } from "./ui.jsx";

const Context = createContext(null);
export const useWorkspace = () => useContext(Context);

export function WorkspaceProvider({ user, previewRole, children }) {
  const [data, setData] = useState(initialData);
  const [toast, setToast] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const prefix = previewRole ? `/preview/${previewRole}/` : "/";
  const href = (route) => `#${prefix}${route}`;
  const navigate = (route) => {
    window.location.hash = `${prefix}${route}`;
  };
  const update = (collection, key, changes) =>
    setData((old) => ({
      ...old,
      [collection]: old[collection].map((item) =>
        item.id === key ? { ...item, ...changes } : item,
      ),
    }));
  const remove = (collection, key) =>
    setData((old) => ({
      ...old,
      [collection]: old[collection].filter((item) => item.id !== key),
    }));
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  return (
    <Context.Provider
      value={{
        data,
        setData,
        user,
        isTeacher: user.role === "TEACHER",
        isPreview: Boolean(previewRole),
        href,
        navigate,
        update,
        remove,
        notify: setToast,
        confirm: setConfirmation,
      }}
    >
      {children}
      {toast && (
        <div className="ws-toast" role="status">
          {toast}
          <button aria-label="Đóng thông báo" onClick={() => setToast("")}>
            ×
          </button>
        </div>
      )}
      {confirmation && (
        <Modal title={confirmation.title} onClose={() => setConfirmation(null)}>
          <p className="ws-modal-description">{confirmation.text}</p>
          <div className="ws-modal-actions">
            <Button variant="secondary" onClick={() => setConfirmation(null)}>
              Hủy
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                confirmation.action();
                setConfirmation(null);
              }}
            >
              {confirmation.label ?? "Xác nhận"}
            </Button>
          </div>
        </Modal>
      )}
    </Context.Provider>
  );
}
