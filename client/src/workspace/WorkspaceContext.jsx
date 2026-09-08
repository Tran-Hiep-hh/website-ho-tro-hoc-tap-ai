import { createContext, useContext, useEffect, useState } from "react";
import { initialData } from "./data.js";
import { Button, Modal } from "./ui.jsx";
import { apiRequest } from "../lib/api.js";

const Context = createContext(null);
export const useWorkspace = () => useContext(Context);

export function WorkspaceProvider({ user, previewRole, children }) {
  const [data, setData] = useState(() => {
    const initial = initialData(user);
    return previewRole ? initial : { ...initial, documents: [], contents: initial.contents.filter((item) => item.type !== "QUIZ") };
  });
  const [quizzesLoading, setQuizzesLoading] = useState(!previewRole);
  const [quizzesError, setQuizzesError] = useState("");
  async function reloadQuizzes() {
    if (previewRole) return;
    setQuizzesLoading(true); setQuizzesError("");
    try {
      const [library, history] = await Promise.all([apiRequest("/quizzes"), apiRequest("/quizzes/attempts")]);
      setData((old) => ({ ...old, contents: [...library.contents, ...old.contents.filter((item) => item.type !== "QUIZ")], attempts: history.attempts }));
    } catch (error) { setQuizzesError(error.message); }
    finally { setQuizzesLoading(false); }
  }
  useEffect(() => { reloadQuizzes(); }, [user.userId, previewRole]);
  const [documentsLoading, setDocumentsLoading] = useState(!previewRole);
  const [documentsError, setDocumentsError] = useState("");
  async function reloadDocuments() {
    if (previewRole) return;
    setDocumentsLoading(true);
    setDocumentsError("");
    try {
      const result = await apiRequest("/documents");
      setData((old) => ({ ...old, documents: result.documents }));
    } catch (error) { setDocumentsError(error.message); }
    finally { setDocumentsLoading(false); }
  }
  useEffect(() => { reloadDocuments(); }, [user.userId, previewRole]);
  const ownerId = String(user.userId ?? user.id ?? "preview-user");
  const personalDocuments = data.documents.filter((item) => item.ownerId === ownerId);
  const sharedClasses = data.classes.filter((cls) => user.role === "TEACHER" || cls.joined);
  const classDocuments = data.documents.filter((item) => sharedClasses.some((cls) => cls.materialIds.includes(item.id)));
  const accessibleDocuments = data.documents.filter((item) => item.ownerId === ownerId || classDocuments.includes(item));
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
        quizzesLoading,
        quizzesError,
        reloadQuizzes,
        documentsLoading,
        documentsError,
        reloadDocuments,
        ownerId,
        personalDocuments,
        classDocuments,
        accessibleDocuments,
        sharedClasses,
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
