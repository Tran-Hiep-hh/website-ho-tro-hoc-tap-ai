import { useState } from "react";
import { apiRequest } from "../lib/api.js";
import { useWorkspace } from "./WorkspaceContext.jsx";
import { Button, Field, PageHeading } from "./ui.jsx";

const localDate = (value) => {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export default function AssignmentDraftEditor({ assignment }) {
  const { isPreview, update, reloadAssignments, navigate, notify } = useWorkspace();
  const [draft, setDraft] = useState(() => structuredClone(assignment));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const back = () => navigate(`assignments/${assignment.id}/details`);
  const changeQuestion = (index, patch) => setDraft((old) => ({ ...old, questions: old.questions.map((q, i) => i === index ? { ...q, ...patch } : q) }));
  async function save(event) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const fields = Object.fromEntries(new FormData(event.currentTarget));
      const payload = { ...draft, title: fields.title.trim(), startAt: new Date(fields.startAt).toISOString(), dueAt: new Date(fields.dueAt).toISOString(), maxAttempts: Number(fields.maxAttempts), durationMinutes: fields.durationMinutes === "" ? null : Number(fields.durationMinutes), showAnswers: fields.showAnswers === "on" };
      if (new Date(payload.dueAt) <= new Date(payload.startAt)) throw new Error("Hạn nộp phải sau thời gian mở bài.");
      if (isPreview) update("assignments", assignment.id, { ...payload, questionCount: payload.questions.length });
      else { await apiRequest(`/assignments/${assignment.id}`, { method: "PUT", body: payload }); await reloadAssignments(); }
      notify("Đã lưu thay đổi bản nháp."); back();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <>
    <Button variant="ghost" icon="back" onClick={back}>Quay lại bài giao</Button>
    <PageHeading title="Chỉnh sửa bản nháp" description="Thay đổi chỉ áp dụng cho bài giao này. Khi công bố, đề sẽ được cố định." />
    <form className="ws-panel ws-form" onSubmit={save}>
      <fieldset disabled={busy} style={{ border: 0, padding: 0, minWidth: 0 }}>
        <Field label="Tên bài giao"><input name="title" required maxLength={150} defaultValue={draft.title} /></Field>
        <div className="ws-form-grid">
          <Field label="Thời gian mở bài"><input name="startAt" type="datetime-local" required defaultValue={localDate(draft.startAt)} /></Field>
          <Field label="Hạn nộp"><input name="dueAt" type="datetime-local" required defaultValue={localDate(draft.dueAt)} /></Field>
          <Field label="Số lần được làm"><input name="maxAttempts" type="number" min={1} max={10} required defaultValue={draft.maxAttempts} /></Field>
          <Field label="Thời gian làm bài (phút)"><input name="durationMinutes" type="number" min={1} max={1440} defaultValue={draft.durationMinutes ?? ""} placeholder="Theo hạn nộp của lớp" /></Field>
        </div>
        <label className="ws-check-line"><input type="checkbox" name="showAnswers" defaultChecked={draft.showAnswers} />Cho phép xem đáp án và giải thích sau khi nộp</label>
        <h2>{draft.questions.length} câu hỏi</h2>
        {draft.questions.map((q, index) => <section className="ws-question-edit" key={index}>
          <h3>Câu {index + 1}</h3>
          <Field label={`Nội dung câu ${index + 1}`}><textarea required maxLength={4000} value={q.text} onChange={(e) => changeQuestion(index, { text: e.target.value })} /></Field>
          {q.options.map((option, i) => <Field key={i} label={`Câu ${index + 1}: lựa chọn ${String.fromCharCode(65 + i)}`}><input required maxLength={2000} value={option} onChange={(e) => changeQuestion(index, { options: q.options.map((o, key) => key === i ? e.target.value : o) })} /></Field>)}
          <Field label={`Đáp án đúng câu ${index + 1}`}><select value={q.answer} onChange={(e) => changeQuestion(index, { answer: Number(e.target.value) })}>{q.options.map((_, i) => <option key={i} value={i}>{String.fromCharCode(65 + i)}</option>)}</select></Field>
          <Field label={`Giải thích câu ${index + 1}`}><textarea required maxLength={4000} value={q.explanation} onChange={(e) => changeQuestion(index, { explanation: e.target.value })} /></Field>
          <Button variant="danger" disabled={draft.questions.length <= 1} onClick={() => setDraft({ ...draft, questions: draft.questions.filter((_, i) => i !== index) })}>Xóa câu {index + 1}</Button>
        </section>)}
        <Button variant="secondary" disabled={draft.questions.length >= 50} onClick={() => setDraft({ ...draft, questions: [...draft.questions, { text: "", options: ["", "", "", ""], answer: 0, explanation: "", source: "Bổ sung thủ công" }] })}>Thêm câu hỏi</Button>
        {error && <p className="ws-inline-error" role="alert">{error}</p>}
        <div className="ws-form-footer"><Button variant="secondary" onClick={back}>Hủy chỉnh sửa</Button><Button type="submit">{busy ? "Đang lưu…" : "Lưu bản nháp"}</Button></div>
      </fieldset>
    </form>
  </>;
}
