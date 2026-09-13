import { useState } from "react";
import { apiRequest } from "../lib/api.js";
import { Icon } from "../components/Brand.jsx";
import { useWorkspace } from "./WorkspaceContext.jsx";
import { typeLabels } from "./data.js";
import { Badge, Button, Empty, Field, PageHeading, Progress } from "./ui.jsx";
import MindmapEditor from "./MindmapEditor.jsx";

export default function ContentPage({ contentId }) {
  const { data, setData, update, navigate, isTeacher, notify } = useWorkspace();
  const item = data.contents.find((content) => content.id === contentId);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(() =>
    item ? structuredClone(item) : null,
  );
  const [studying, setStudying] = useState(false);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [complete, setComplete] = useState(false);
  if (!item)
    return (
      <Empty
        title="Không tìm thấy học liệu"
        action={
          <Button onClick={() => navigate("contents")}>Về thư viện</Button>
        }
      />
    );
  const known = data.learned[item.id] ?? [];
  async function save(event) {
    event.preventDefault();
    if (!draft.title.trim()) return;
    if (item.persisted) {
      if (saving) return;
      setSaving(true);
      try {
        const result = await apiRequest(`/${item.type === "QUIZ" ? "quizzes" : "study-materials"}/${item.id}`, { method: "PUT", body: draft });
        update("contents", item.id, result.content);
        if (item.type === "FLASHCARD") setData((old) => ({ ...old, learned: { ...old.learned, [item.id]: result.content.learned } }));
        setStudying(false); setIndex(0); setComplete(false);
        setEditing(false); notify(item.type === "QUIZ" ? "Đã lưu phiên bản Quiz mới. Kết quả các lượt làm cũ được giữ nguyên." : "Đã lưu bộ thẻ. Tiến độ của thẻ bị sửa nội dung được đặt lại.");
      } catch (error) { notify(error.message); }
      finally { setSaving(false); }
      return;
    }
    if (
      item.type === "QUIZ" &&
      data.assignments.some(
        (assignment) =>
          assignment.contentId === item.id && assignment.status === "PUBLISHED",
      )
    ) {
      notify(
        "Bản Quiz cá nhân đã được cập nhật; phiên bản trong bài giao cũ được giữ nguyên.",
      );
    } else notify("Đã lưu thay đổi vào học liệu mẫu.");
    update("contents", item.id, draft);
    if (item.type === "FLASHCARD")
      setData((old) => ({
        ...old,
        learned: { ...old.learned, [item.id]: [] },
      }));
    setEditing(false);
    setStudying(false); setIndex(0); setComplete(false);
  }
  async function mark(remembered) {
    if (saving) return;
    if (item.persisted) {
      setSaving(true);
      try {
        const result = await apiRequest(`/study-materials/${item.id}/progress`, { method: "PUT", body: { cardId: item.cards[index].id, revision: item.revision, remembered } });
        setData((old) => ({ ...old, learned: { ...old.learned, [item.id]: result.content.learned } }));
      } catch (error) { notify(error.message); return; }
      finally { setSaving(false); }
    } else {
    setData((old) => ({
      ...old,
      learned: {
        ...old.learned,
        [item.id]: remembered
          ? [...new Set([...(old.learned[item.id] ?? []), index])]
          : (old.learned[item.id] ?? []).filter((key) => key !== index),
      },
    }));
    }
    setFlipped(false);
    if (index === item.cards.length - 1) setComplete(true);
    else setIndex(index + 1);
  }
  if (editing)
    return (
      <>
        <PageHeading
          title="Chỉnh sửa học liệu"
          description="Kiểm tra và điều chỉnh nội dung trước khi sử dụng."
        />
        <form onSubmit={save} className="ws-panel ws-form">
          <Field label="Tên học liệu">
            <input
              value={draft.title}
              onChange={(event) =>
                setDraft({ ...draft, title: event.target.value })
              }
              required
              maxLength={150}
            />
          </Field>
          {item.type === "QUIZ" &&
            draft.questions.map((question, questionIndex) => (
              <section className="ws-question-edit" key={questionIndex}>
                <div className="ws-section-heading">
                  <Badge>Câu {questionIndex + 1}</Badge>
                  <Button
                    variant="ghost"
                    disabled={draft.questions.length <= 1}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        questions: draft.questions.filter(
                          (_, key) => key !== questionIndex,
                        ),
                      })
                    }
                  >
                    Xóa câu hỏi
                  </Button>
                </div>
                <Field label="Nội dung câu hỏi">
                  <textarea
                    required
                    value={question.text}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        questions: draft.questions.map((q, key) =>
                          key === questionIndex
                            ? { ...q, text: event.target.value }
                            : q,
                        ),
                      })
                    }
                  />
                </Field>
                <div className="ws-options-edit">
                  {question.options.map((option, optionIndex) => (
                    <label key={optionIndex}>
                      <input
                        type="radio"
                        aria-label={`Câu ${questionIndex + 1}: đáp án đúng ${String.fromCharCode(65 + optionIndex)}`}
                        checked={question.answer === optionIndex}
                        onChange={() =>
                          setDraft({
                            ...draft,
                            questions: draft.questions.map((q, key) =>
                              key === questionIndex
                                ? { ...q, answer: optionIndex }
                                : q,
                            ),
                          })
                        }
                      />
                      <input
                        aria-label={`Câu ${questionIndex + 1}: phương án ${String.fromCharCode(65 + optionIndex)}`}
                        required
                        value={option}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            questions: draft.questions.map((q, key) =>
                              key === questionIndex
                                ? {
                                    ...q,
                                    options: q.options.map((o, oKey) =>
                                      oKey === optionIndex
                                        ? event.target.value
                                        : o,
                                    ),
                                  }
                                : q,
                            ),
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
                <Field label="Giải thích">
                  <textarea
                    required
                    value={question.explanation}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        questions: draft.questions.map((q, key) =>
                          key === questionIndex
                            ? { ...q, explanation: event.target.value }
                            : q,
                        ),
                      })
                    }
                  />
                </Field>
              </section>
            ))}
          {item.type === "FLASHCARD" &&
            draft.cards.map((card, cardIndex) => (
              <section className="ws-question-edit" key={cardIndex}>
                <div className="ws-section-heading">
                  <Badge tone="orange">Thẻ {cardIndex + 1}</Badge>
                  <Button
                    variant="ghost"
                    disabled={draft.cards.length <= 1}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        cards: draft.cards.filter(
                          (_, key) => key !== cardIndex,
                        ),
                      })
                    }
                  >
                    Xóa thẻ
                  </Button>
                </div>
                <div className="ws-form-grid">
                  {[
                    ["front", "Mặt trước"],
                    ["back", "Mặt sau"],
                  ].map(([field, label]) => (
                    <Field key={field} label={label}>
                      <textarea
                        required
                        value={card[field]}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            cards: draft.cards.map((c, key) =>
                              key === cardIndex
                                ? { ...c, [field]: event.target.value }
                                : c,
                            ),
                          })
                        }
                      />
                    </Field>
                  ))}
                </div>
              </section>
            ))}
          <div>
            <Button
              variant="secondary"
              icon="plus"
              onClick={() =>
                setDraft(
                  item.type === "QUIZ"
                    ? {
                        ...draft,
                        questions: [
                          ...draft.questions,
                          {
                            text: "",
                            options: ["", "", "", ""],
                            answer: 0,
                            explanation: "",
                            source: "Bổ sung thủ công",
                          },
                        ],
                      }
                    : {
                        ...draft,
                        cards: [
                          ...draft.cards,
                          { front: "", back: "", keyword: "" },
                        ],
                      },
                )
              }
            >
              {item.type === "QUIZ" ? "Thêm câu hỏi" : "Thêm thẻ"}
            </Button>
          </div>
          <div className="ws-form-footer">
            <Button variant="secondary" onClick={() => setEditing(false)}>
              Hủy chỉnh sửa
            </Button>
            <Button type="submit" icon="check" disabled={saving}>
              Lưu thay đổi
            </Button>
          </div>
        </form>
      </>
    );
  return (
    <>
      <Button variant="ghost" icon="back" onClick={() => navigate("contents")}>
        Học liệu của tôi
      </Button>
      <PageHeading
        title={item.title}
        eyebrow={item.type === "QUIZ" ? "QUIZ CÁ NHÂN · TỰ LUYỆN" : "ÔN TẬP CÁ NHÂN"}
        description={`${typeLabels[item.type]} · ${item.difficulty} · ${item.sources.length} tài liệu nguồn`}
        action={
          item.type !== "MINDMAP" && (
            <>
              <Button
                variant="secondary"
                icon="edit"
                onClick={() => {
                  setDraft(structuredClone(item));
                  setEditing(true);
                }}
              >
                Chỉnh sửa
              </Button>
              {item.type === "QUIZ" ? (
                <>
                  {isTeacher && (
                    <Button
                      variant="secondary"
                      icon="users"
                      onClick={() => navigate(`assignments/new/any/${item.id}`)}
                    >
                      Giao cho lớp
                    </Button>
                  )}
                  <Button
                    icon="quiz"
                    onClick={() => navigate(`play/personal/${item.id}`)}
                  >
                    Làm Quiz
                  </Button>
                </>
              ) : (
                <Button
                  icon="cards"
                  onClick={() => {
                    setStudying(true);
                    setIndex(0);
                    setFlipped(false);
                    setComplete(false);
                  }}
                >
                  Bắt đầu ôn tập
                </Button>
              )}
            </>
          )
        }
      />
      {item.type !== "QUIZ" && item.generationMode === "MOCK" && (
        <div className="ws-info-banner"><div><strong>AI giả lập · Đã lưu trên máy chủ</strong><p>Nội dung minh họa chưa được AI tạo từ tài liệu của bạn.</p>{item.contentRequest && <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>Yêu cầu bổ sung: {item.contentRequest}</p>}</div></div>
      )}
      {item.type === "QUIZ" && (
        <section className="ws-panel">
          {item.generationMode === "MOCK" && <div className="ws-info-banner"><p>AI giả lập · Quiz đã lưu trên máy chủ. Câu hỏi minh họa không được tạo từ tài liệu của bạn; có thể chỉnh sửa trước khi sử dụng.</p></div>}
          {item.contentRequest && <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>Yêu cầu bổ sung: {item.contentRequest}</p>}
          <div className="ws-section-heading">
            <h2>{item.questions.length} câu hỏi</h2>
            <Badge>Có đáp án và giải thích</Badge>
          </div>
          {item.questions.map((question, qIndex) => (
            <div className="ws-question-preview" key={qIndex}>
              <strong>
                {qIndex + 1}. {question.text}
              </strong>
              {question.options.map((option, key) => (
                <p
                  className={key === question.answer ? "correct" : ""}
                  key={key}
                >
                  {String.fromCharCode(65 + key)}. {option}
                  {key === question.answer && <Icon name="check" size={15} />}
                </p>
              ))}
              <small>
                <b>Giải thích:</b> {question.explanation}
              </small>
              <small>Nguồn: {question.source}</small>
            </div>
          ))}
        </section>
      )}
      {item.type === "FLASHCARD" && (
        <>
          <div className="ws-flash-progress">
            <div>
              <strong>Tiến độ ghi nhớ</strong>
              <span>
                {known.length}/{item.cards.length} thẻ đã nhớ
              </span>
            </div>
            <Progress value={(known.length / item.cards.length) * 100} />
          </div>
          {studying ? (
            complete ? (
              <section className="ws-panel ws-study-complete">
                <span className="ws-icon-tile green">
                  <Icon name="trophy" size={30} />
                </span>
                <h2>Bạn đã hoàn thành lượt ôn tập!</h2>
                <p>
                  Đã nhớ {known.length}/{item.cards.length} thẻ. Tiếp tục luyện
                  tập để củng cố kiến thức.
                </p>
                <div className="ws-actions">
                  <Button
                    variant="secondary"
                    onClick={() => setStudying(false)}
                  >
                    Xem bộ thẻ
                  </Button>
                  <Button
                    onClick={() => {
                      setComplete(false);
                      setIndex(0);
                      setFlipped(false);
                    }}
                  >
                    Ôn lại từ đầu
                  </Button>
                </div>
              </section>
            ) : (
              <section className="ws-study-area">
                <div className="ws-study-counter">
                  THẺ {index + 1} / {item.cards.length}
                  <Badge tone="orange">
                    {item.cards[index].keyword || "Ghi nhớ"}
                  </Badge>
                </div>
                <button
                  className={`ws-flashcard ${flipped ? "flipped" : ""}`}
                  disabled={saving}
                  onClick={() => setFlipped(!flipped)}
                  aria-label="Lật thẻ ghi nhớ"
                >
                  <small>
                    {flipped ? "MẶT SAU · GIẢI THÍCH" : "MẶT TRƯỚC · KHÁI NIỆM"}
                  </small>
                  <strong>
                    {flipped ? item.cards[index].back : item.cards[index].front}
                  </strong>
                  <span>
                    <Icon name="refresh" size={15} />
                    Nhấn vào thẻ để lật
                  </span>
                </button>
                <div className="ws-study-controls">
                  <Button variant="secondary" disabled={saving} onClick={() => mark(false)}>
                    Cần ôn lại
                  </Button>
                  <Button icon="check" disabled={saving} onClick={() => mark(true)}>
                    Đã nhớ
                  </Button>
                </div>
                <div className="ws-study-controls">
                  <Button
                    variant="ghost"
                    icon="back"
                    disabled={saving || index === 0}
                    onClick={() => {
                      setIndex(index - 1);
                      setFlipped(false);
                    }}
                  >
                    Thẻ trước
                  </Button>
                  <Button variant="ghost" disabled={saving} onClick={() => setStudying(false)}>
                    Kết thúc ôn tập
                  </Button>
                  <Button
                    variant="ghost"
                    icon="arrow"
                    disabled={saving || index === item.cards.length - 1}
                    onClick={() => {
                      setIndex(index + 1);
                      setFlipped(false);
                    }}
                  >
                    Thẻ sau
                  </Button>
                </div>
              </section>
            )
          ) : (
            <div className="ws-card-grid">
              {item.cards.map((card, key) => (
                <article className="ws-mini-card" key={key}>
                  <div className="ws-section-heading">
                    <Badge tone="orange">Thẻ {key + 1}</Badge>
                    {known.includes(key) && <Badge>Đã nhớ</Badge>}
                  </div>
                  <h3>{card.front}</h3>
                  <p>{card.back}</p>
                  <small>{card.keyword}</small>
                </article>
              ))}
            </div>
          )}
        </>
      )}
      {item.type === "MINDMAP" && <MindmapEditor key={`${item.id}:${item.revision ?? 0}`} item={item} />}
    </>
  );
}
