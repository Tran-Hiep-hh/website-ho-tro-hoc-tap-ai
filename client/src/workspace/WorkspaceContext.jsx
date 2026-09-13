import { createContext, useContext, useEffect, useState, useRef } from "react";
import { initialData } from "./data.js";
import { Button, Modal } from "./ui.jsx";
import { apiRequest } from "../lib/api.js";

const Context = createContext(null);
export const useWorkspace = () => useContext(Context);

export function WorkspaceProvider({ user, previewRole, children, onUserChange }) {
  const [data, setData] = useState(() => {
    const initial = initialData(user);
    return previewRole ? initial : { ...initial, notifications: [], documents: [], contents: [], classes: [], members: [], requests: [], assignments: [], classAttempts: [], sharedDocuments: [] };
  });
  const [quizzesLoading, setQuizzesLoading] = useState(!previewRole);
  const [quizzesError, setQuizzesError] = useState("");
  async function reloadQuizzes() {
    if (previewRole) return;
    setQuizzesLoading(true); setQuizzesError("");
    try {
      const [library, history, study] = await Promise.all([apiRequest("/quizzes"), apiRequest("/quizzes/attempts"), apiRequest("/study-materials")]);
      setData((old) => ({ ...old, contents: [...library.contents, ...study.contents], learned: Object.fromEntries(study.contents.filter((item) => item.type === "FLASHCARD").map((item) => [item.id, item.learned])), attempts: [...history.attempts, ...old.attempts.filter((item) => item.assignmentId)] }));
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
  const [classesLoading, setClassesLoading] = useState(!previewRole);
  const [classesError, setClassesError] = useState("");
  async function reloadClasses() {
    if (previewRole) return;
    setClassesError("");
    try {
      const result = await apiRequest("/classes");
      setData((old) => ({ ...old, classes: result.classes, members: result.members, requests: result.requests, sharedDocuments: result.documents }));
    } catch (error) { setClassesError(error.message); }
    finally { setClassesLoading(false); }
  }
  useEffect(() => { reloadClasses(); }, [user.userId, previewRole]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(!previewRole);
  const [assignmentsError, setAssignmentsError] = useState("");
  async function reloadAssignments() {
    if (previewRole) return;
    setAssignmentsError("");
    try {
      const result = await apiRequest("/assignments");
      setData((old) => ({ ...old, assignments: result.assignments, classAttempts: result.classAttempts, attempts: [...old.attempts.filter((item) => !item.assignmentId), ...result.attempts] }));
    } catch (error) { setAssignmentsError(error.message); }
    finally { setAssignmentsLoading(false); }
  }
  useEffect(() => { reloadAssignments(); }, [user.userId, previewRole]);
  const [notificationsLoading, setNotificationsLoading] = useState(!previewRole);
  const [notificationsError, setNotificationsError] = useState("");
  const notificationSequence = useRef(0);
  async function reloadNotifications() {
    if (previewRole) return;
    const sequence = ++notificationSequence.current;
    try {
      const result = await apiRequest("/notifications");
      if (sequence !== notificationSequence.current) return;
      setData((old) => ({ ...old, notifications: result.notifications }));
      setNotificationsError("");
    } catch (error) { if (sequence === notificationSequence.current) setNotificationsError(error.message); }
    finally { if (sequence === notificationSequence.current) setNotificationsLoading(false); }
  }
  useEffect(() => {
    if (previewRole) return;
    reloadNotifications();
    const refresh = () => { if (document.visibilityState === "visible") reloadNotifications(); };
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); ++notificationSequence.current; };
  }, [user.userId, previewRole]);
  const ownerId = String(user.userId ?? user.id ?? "preview-user");
  const personalDocuments = data.documents.filter((item) => item.ownerId === ownerId);
  const sharedClasses = data.classes.filter((cls) => user.role === "TEACHER" || cls.joined);
  const classDocuments = previewRole ? data.documents.filter((item) => sharedClasses.some((cls) => cls.materialIds.includes(item.id))) : data.sharedDocuments;
  const accessibleDocuments = [...new Map([...personalDocuments, ...classDocuments].map((item) => [item.id, item])).values()];
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
      ...(collection === "contents" ? { learned: Object.fromEntries(Object.entries(old.learned).filter(([id]) => id !== key)) } : {}),
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
        notificationsLoading, notificationsError, reloadNotifications,
        assignmentsLoading, assignmentsError, reloadAssignments,
        classesLoading,
        classesError,
        reloadClasses,
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
        onUserChange,
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
