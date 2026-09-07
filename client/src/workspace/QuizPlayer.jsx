import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "./WorkspaceContext.jsx";
import { id } from "./data.js";
import { Badge, Button, Empty, PageHeading, Progress } from "./ui.jsx";
import { Icon } from "../components/Brand.jsx";

export default function QuizPlayer({ mode, targetId }) {
  const { data, setData, user, isTeacher, navigate, notify, confirm } =
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
  const questions = assignment?.questions ?? content?.questions ?? [];
  const title = assignment?.title ?? content?.title;
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
      attemptCount < assignment.maxAttempts &&
      data.classes.some((cls) => cls.id === assignment.classId && cls.joined),
    );
  function submit(automatic = false) {
    if (submitted.current) return;
    submitted.current = true;
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
        Math.ceil((new Date(assignment.dueAt) - Date.now()) / 1000),
      );
      setRemaining(seconds);
      if (seconds === 0) submitRef.current(true);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [started, assignment]);
  if (!questions.length || (!started && !canStart))
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
              <strong>{questions.length}</strong>Câu hỏi
            </span>
            <span>
              <strong>1</strong>Đáp án đúng mỗi câu
            </span>
            <span>
              <strong>
                {assignment ? assignment.maxAttempts - attemptCount : "∞"}
              </strong>
              Lượt còn lại
            </span>
          </div>
          <p>
            Câu trả lời được lưu trong phiên xem này. Bạn có thể quay lại các
            câu trước khi nộp bài.
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
            <Button icon="arrow" onClick={() => setStarted(true)}>
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
          <fieldset className="ws-answer-options">
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
                    setAnswers(next);
                    setData((old) => ({
                      ...old,
                      draftAnswers: { ...old.draftAnswers, [key]: next },
                    }));
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
            <span>Đã lưu {answered} câu trả lời trong phiên xem</span>
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
