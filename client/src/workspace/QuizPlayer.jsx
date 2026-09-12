import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../lib/api.js";
import { useWorkspace } from "./WorkspaceContext.jsx";
import { id } from "./data.js";
import { Badge, Button, Empty, PageHeading, Progress } from "./ui.jsx";
import { Icon } from "../components/Brand.jsx";

export default function QuizPlayer({ mode, targetId }) {
  const { data, setData, user, isTeacher, navigate, notify, confirm, reloadAssignments } =
    useWorkspace();
  const assignment =
    mode === "assignment"
      ? data.assignments.find((item) => item.id === targetId)
      : null;
  const content =
    mode === "personal"
      ? data.contents.find(
          (item) => item.id === targetId && item.type === "QUIZ",
        )
      : null;
  const [serverAttempt, setServerAttempt] = useState(null);
  const [busy, setBusy] = useState(false);
  const persisted = Boolean(content?.persisted || assignment?.persisted);
  const [saveError, setSaveError] = useState("");
  const questions = serverAttempt?.questions ?? assignment?.questions ?? content?.questions ?? [];
  const title = serverAttempt?.title ?? assignment?.title ?? content?.title;
  const questionCount = serverAttempt?.questions.length ?? assignment?.questionCount ?? questions.length;
  const key = `${mode}:${targetId}`;
  const [answers, setAnswers] = useState(
    () => data.draftAnswers?.[key] ?? Array(questions.length).fill(-1),
  );
  const [index, setIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [remaining, setRemaining] = useState(null);
  const submitted = useRef(false);
  const submitRef = useRef(null);
  const attemptCount = data.attempts.filter(
    (item) => item.assignmentId === assignment?.id,
  ).length;
  const canStart =
    Boolean(content) ||
    Boolean(
      assignment &&
      !isTeacher &&
      assignment.status === "PUBLISHED" &&
      new Date(assignment.startAt) <= new Date() &&
      new Date(assignment.dueAt) > new Date() &&
      (assignment.inProgress || (assignment.attemptsUsed ?? attemptCount) < assignment.maxAttempts) &&
      data.classes.some((cls) => cls.id === assignment.classId && cls.joined),
    );
  async function start() {
    if (busy) return;
    if (!persisted) { setStarted(true); return; }
    setBusy(true);
    try {
      const result = await apiRequest(assignment ? `/assignments/${assignment.id}/attempts` : `/quizzes/${content.id}/attempts`, { method: "POST", body: {} });
      setServerAttempt({ ...result.attempt, clockOffset: result.attempt.serverNow ? new Date(result.attempt.serverNow).getTime() - Date.now() : 0 }); setAnswers(result.attempt.answers ?? Array(result.attempt.questions.length).fill(-1)); setStarted(true);
    } catch (error) { notify(error.message); }
    finally { setBusy(false); }
  }
  async function saveAnswer(next) {
    if (!assignment?.persisted) {
      setAnswers(next);
      setData((old) => ({ ...old, draftAnswers: { ...old.draftAnswers, [key]: next } }));
      return;
    }
    if (busy) return;
    const previous = answers;
    setAnswers(next); setBusy(true); setSaveError("");
    try {
      const result = await apiRequest(`/assignments/attempts/${serverAttempt.id}/answers`, { method: "PUT", body: { answers: next, revision: serverAttempt.revision } });
      if (result.submitted) { await acceptResult(result.attempt); return; }
      setAnswers(next); setServerAttempt((old) => ({ ...old, revision: result.revision }));
    } catch (error) { setAnswers(previous); setSaveError(error.message); }
    finally { setBusy(false); }
  }
  async function acceptResult(attempt) {
    submitted.current = true; confirm(null);
    setData((old) => ({ ...old, attempts: [...old.attempts.filter((item) => item.id !== attempt.id), attempt] }));
    if (assignment?.persisted) await reloadAssignments();
    navigate(`results/attempt/${attempt.id}`);
  }
  async function submit(automatic = false) {
    if (submitted.current || busy) return;
    submitted.current = true;
    if (persisted) {
      setBusy(true);
      try {
        const result = await apiRequest(`/${assignment ? "assignments" : "quizzes"}/attempts/${serverAttempt.id}/submit`, { method: "POST", body: { answers, revision: serverAttempt.revision } });
        await acceptResult(result.attempt);
      } catch (error) { submitted.current = false; notify(error.message); }
      finally { setBusy(false); }
      return;
    }
    const correct = questions.filter(
      (question, qIndex) => question.answer === answers[qIndex],
    ).length;
    const result = {
      id: id(),
      title,
      contentId: content?.id ?? assignment.contentId,
      assignmentId: assignment?.id ?? null,
      userId: user.userId,
      name: user.fullName,
      answers,
      questions: structuredClone(questions),
      score: Math.round((correct / questions.length) * 100),
      date: new Date().toISOString(),
      showAnswers: assignment ? assignment.showAnswers : true,
    };
    setData((old) => {
      const drafts = { ...old.draftAnswers };
      delete drafts[key];
      return {
        ...old,
        attempts: [...old.attempts, result],
        draftAnswers: drafts,
      };
    });
    if (automatic) {
      confirm(null);
      notify(
        "Đã đến hạn nộp. Các câu trả lời đã được chấm trong bản xem trước.",
      );
    }
    navigate(`results/attempt/${result.id}`);
  }
  submitRef.current = submit;
  useEffect(() => {
    if (!started || !assignment) return;
    const tick = () => {
      const seconds = Math.max(
        0,
        Math.ceil((new Date(serverAttempt?.dueAt ?? assignment.dueAt) - Date.now() - (serverAttempt?.clockOffset ?? 0)) / 1000),
      );
      setRemaining(seconds);
      if (seconds === 0) submitRef.current(true);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [started, assignment]);
  if (!questionCount || (!started && !canStart))
    return (
      <Empty
        title="Chưa thể làm bài Quiz này"
        text="Kiểm tra thời gian mở bài, số lượt làm hoặc tư cách thành viên của lớp."
        action={
          <Button
            onClick={() => navigate(assignment ? "assignments" : "contents")}
          >
            Về danh sách
          </Button>
        }
      />
    );
  const answered = answers.filter((answer) => answer >= 0).length;
  if (!started)
    return (
      <>
        <PageHeading
          title={title}
          description={
            assignment
              ? "Bài Quiz được giao trong lớp học"
              : "Tự kiểm tra kiến thức với Quiz cá nhân"
          }
        />
        <section className="ws-panel ws-quiz-intro">
          <span className="ws-icon-tile green">
            <Icon name="quiz" size={35} />
          </span>
          <h2>Sẵn sàng kiểm tra kiến thức?</h2>
          <div className="ws-quiz-intro-stats">
            <span>
              <strong>{questionCount}</strong>Câu hỏi
            </span>
            <span>
              <strong>1</strong>Đáp án đúng mỗi câu
            </span>
            <span>
              <strong>
                {assignment ? assignment.maxAttempts - (assignment.attemptsUsed ?? attemptCount) + (assignment.inProgress ? 1 : 0) : "∞"}
              </strong>
              Lượt còn lại
            </span>
          </div>
          <p>
            {assignment?.persisted ? "Mỗi câu trả lời được lưu trên máy chủ. Tải lại trang và bấm Bắt đầu Quiz để tiếp tục lượt đang làm. Hết hạn sẽ chấm các lựa chọn đã lưu." : content?.persisted ? "Khi nộp bài, máy chủ chấm điểm và lưu kết quả. Câu trả lời chưa nộp chỉ giữ trong trang hiện tại; tải lại trang sẽ phải chọn lại." : "Câu trả lời được lưu trong phiên xem này. Bạn có thể quay lại các câu trước khi nộp bài."}
          </p>
          <div className="ws-actions">
            <Button
              variant="secondary"
              onClick={() =>
                navigate(
                  assignment
                    ? `assignments/${assignment.id}`
                    : `content/${content.id}`,
                )
              }
            >
              Quay lại
            </Button>
            <Button icon="arrow" disabled={busy} onClick={start}>
              Bắt đầu Quiz
            </Button>
          </div>
        </section>
      </>
    );
  const question = questions[index];
  return (
    <>
      <PageHeading
        title={title}
        description="Đọc kỹ câu hỏi và chọn một phương án phù hợp nhất."
        action={
          assignment ? (
            <Badge tone="orange">
              {remaining === null
                ? "Đang cập nhật"
                : `Còn ${Math.floor(remaining / 3600)}h ${Math.floor((remaining % 3600) / 60)}p ${remaining % 60}s`}
            </Badge>
          ) : (
            <Badge>Tự luyện · Không giới hạn thời gian</Badge>
          )
        }
      />
      <div className="ws-quiz-layout">
        <section className="ws-panel ws-quiz-question">
          <div className="ws-section-heading">
            <Badge>
              CÂU {index + 1} / {questions.length}
            </Badge>
            <span className="ws-muted">Trắc nghiệm một lựa chọn</span>
          </div>
          <h2>{question.text}</h2>
          {saveError && <p className="ws-inline-error" role="alert">Chưa lưu lựa chọn mới: {saveError}</p>}
          <fieldset className="ws-answer-options" disabled={busy}>
            <legend className="ws-sr-only">Chọn đáp án</legend>
            {question.options.map((option, optionIndex) => (
              <label
                key={optionIndex}
                className={answers[index] === optionIndex ? "selected" : ""}
              >
                <input
                  type="radio"
                  name={`question-${index}`}
                  checked={answers[index] === optionIndex}
                  onChange={() => {
                    const next = answers.map((answer, qIndex) =>
                      qIndex === index ? optionIndex : answer,
                    );
                    saveAnswer(next);
                  }}
                />
                <span>{String.fromCharCode(65 + optionIndex)}</span>
                {option}
              </label>
            ))}
          </fieldset>
          <div className="ws-form-footer">
            <Button
              variant="secondary"
              icon="back"
              disabled={index === 0}
              onClick={() => setIndex(index - 1)}
            >
              Câu trước
            </Button>
            <span>{busy ? "Đang lưu…" : `Đã lưu ${answered} câu trả lời ${assignment?.persisted ? "trên máy chủ" : "trong trang này"}`}</span>
            <Button
              icon="arrow"
              disabled={index === questions.length - 1}
              onClick={() => setIndex(index + 1)}
            >
              Câu tiếp
            </Button>
          </div>
        </section>
        <aside className="ws-panel ws-quiz-sidebar">
          <h2>Tiến độ làm bài</h2>
          <p className="ws-muted">
            Đã trả lời {answered}/{questions.length} câu
          </p>
          <Progress value={(answered / questions.length) * 100} />
          <div className="ws-question-numbers">
            {questions.map((_, qIndex) => (
              <button
                key={qIndex}
                className={`${index === qIndex ? "current" : ""} ${answers[qIndex] >= 0 ? "answered" : ""}`}
                aria-label={`Chuyển đến câu ${qIndex + 1}`}
                onClick={() => setIndex(qIndex)}
              >
                {qIndex + 1}
              </button>
            ))}
          </div>
          <div className="ws-quiz-legend">
            <i /> Đã trả lời <i /> Chưa trả lời
          </div>
          <Button
            icon="check"
            disabled={busy}
            onClick={() =>
              confirm({
                title: "Nộp bài Quiz?",
                text:
                  answered < questions.length
                    ? `Bạn còn ${questions.length - answered} câu chưa trả lời. Những câu này sẽ được tính là sai.`
                    : "Bạn đã trả lời tất cả câu hỏi. Xác nhận để xem kết quả.",
                label: "Nộp bài",
                action: () => submit(),
              })
            }
          >
            Nộp bài
          </Button>
        </aside>
      </div>
    </>
  );
}
