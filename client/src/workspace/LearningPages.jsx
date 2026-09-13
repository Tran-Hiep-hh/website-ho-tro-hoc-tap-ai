import { useState } from "react";
import { apiRequest } from "../lib/api.js";
import { clickable } from "./clickable.js";
import MindmapEditor from "./MindmapEditor.jsx";
import { Icon } from "../components/Brand.jsx";
import { useWorkspace } from "./WorkspaceContext.jsx";
import { dateLabel, sampleContent, typeIcons, typeLabels } from "./data.js";
import {
  Badge,
  Button,
  Empty,
  Field,
  PageHeading,
  Search,
  Tabs,
} from "./ui.jsx";

export function LibraryPage() {
  const { data, navigate, confirm, remove, notify, isPreview, isTeacher, reloadQuizzes, href } = useWorkspace();
  const [type, setType] = useState("ALL");
  const [query, setQuery] = useState("");
  const items = data.contents.filter(
    (item) =>
      (type === "ALL" || item.type === type) &&
      item.title
        .toLocaleLowerCase("vi")
        .includes(query.toLocaleLowerCase("vi")),
  );
  function deleteContent(item) {
    if (
      (isPreview && data.classes.some((cls) => cls.materialIds.includes(item.id))) ||
      data.assignments.some(
        (assignment) =>
          assignment.contentId === item.id && assignment.status !== "CANCELLED",
      )
    ) {
      notify(
        "Học liệu đang được chia sẻ hoặc giao cho lớp. Hãy gỡ liên kết trước khi xóa.",
      );
      return;
    }
    confirm({
      title: "Xóa học liệu?",
      text: item.persisted ? `Xóa “${item.title}” khỏi thư viện? Lịch sử làm bài vẫn được giữ lại.` : `Xóa “${item.title}” khỏi thư viện mẫu?`,
      label: "Xóa học liệu",
      action: async () => {
        if (item.persisted) {
          try { await apiRequest(`/${item.type === "QUIZ" ? "quizzes" : "study-materials"}/${item.id}`, { method: "DELETE", body: {} }); }
          catch (error) { notify(error.message); return; }
        }
        remove("contents", item.id);
      },
    });
  }
  return (
    <>
      <PageHeading
        title="Học liệu của tôi"
        eyebrow="KHÔNG GIAN CÁ NHÂN"
        description="Quiz, Flashcard và Mindmap do bạn tạo. Đây là nơi ôn tập và chỉnh sửa bản gốc."
        action={
          <Button icon="plus" onClick={() => navigate("generate")}>
            Tạo học liệu
          </Button>
        }
      />
      <div className="ws-scope-banner personal"><Icon name="spark" /><div><strong>Học liệu do bạn tạo</strong><p>{isTeacher ? "Giao Quiz cho lớp sẽ tạo một bài giao riêng. Bạn quản lý lịch và kết quả tại mục Giao Quiz." : "Quiz ở đây dùng để tự luyện, không có hạn nộp. Bài giáo viên giao nằm ở mục Bài Quiz được giao."}</p></div><a href={href("assignments")}>{isTeacher ? "Quản lý bài giao" : "Xem Quiz được giao"} →</a></div>
      <div className="ws-toolbar">
        {!isPreview && <Button variant="secondary" onClick={reloadQuizzes}>Làm mới</Button>}
        <Tabs
          items={[
            ["ALL", "Tất cả học liệu"],
            ["QUIZ", "Quiz"],
            ["FLASHCARD", "Flashcard"],
            ["MINDMAP", "Mindmap"],
          ]}
          value={type}
          onChange={setType}
        />
        <Search
          value={query}
          onChange={setQuery}
          placeholder="Tìm tên học liệu…"
        />
      </div>
      <div className="ws-card-grid">
        {items.map((item) => (
          <article className="ws-learning-card ws-clickable" key={item.id} {...clickable(() => navigate(`content/${item.id}`), `Mở học liệu ${item.title}`)}>
            <div className={`ws-learning-art ${item.type.toLowerCase()}`}>
              <Icon name={typeIcons[item.type]} size={47} />
              <span>{typeLabels[item.type]}</span>
              <i />
              <i />
            </div>
            <div className="ws-class-card-body">
              <div className="ws-card-labels">
                <Badge tone="blue">{item.type === "QUIZ" ? isTeacher ? "Bản gốc · Tự luyện" : "Quiz tự luyện" : "Ôn tập cá nhân"}</Badge>
                {item.generationMode === "MOCK" && <Badge tone="orange">AI giả lập · Đã lưu</Badge>}
                <Badge
                  tone={
                    item.type === "QUIZ"
                      ? "green"
                      : item.type === "FLASHCARD"
                        ? "orange"
                        : "purple"
                  }
                >
                  {typeLabels[item.type]}
                </Badge>
                <span>{item.difficulty}</span>
              </div>
              <h2>{item.title}</h2>
              <p>
                {item.type === "QUIZ"
                  ? `${item.questions.length} câu hỏi trắc nghiệm`
                  : item.type === "FLASHCARD"
                    ? `${item.cards.length} thẻ ghi nhớ`
                    : `${item.nodes.length} nút kiến thức`}{" "}
                · {dateLabel(item.createdAt)}
              </p>
              <div className="ws-card-footer">
                <Button
                  variant="ghost"
                  onClick={() => deleteContent(item)}
                  icon="trash"
                >
                  Xóa
                </Button>
                <Button
                  variant="secondary"
                  icon="arrow"
                  onClick={() => navigate(`content/${item.id}`)}
                >
                  Mở học liệu
                </Button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {!items.length && (
        <Empty
          title="Chưa có học liệu phù hợp"
          text="Thử từ khóa khác hoặc tạo nội dung mới từ tài liệu của bạn."
          action={
            <Button icon="spark" onClick={() => navigate("generate")}>
              Tạo học liệu
            </Button>
          }
        />
      )}
    </>
  );
}

export function GeneratePage({ sourceId }) {
  const { accessibleDocuments: allDocuments, personalDocuments, setData, navigate, notify, isPreview } = useWorkspace();
  const accessibleDocuments = isPreview ? allDocuments : personalDocuments;
  const [type, setType] = useState("QUIZ");
  const [sources, setSources] = useState(accessibleDocuments.some((item) => item.id === sourceId && item.status === "READY") ? [sourceId] : []);
  const [preview, setPreview] = useState(null);
  const [editingPreview, setEditingPreview] = useState(false);
  const [formValues, setFormValues] = useState({});
  const [contentRequest, setContentRequest] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function generate(event) {
    event.preventDefault();
    setError("");
    if (!sources.length) {
      setError("Chọn ít nhất một tài liệu sẵn sàng để tiếp tục.");
      return;
    }
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setFormValues(values);
    setEditingPreview(false);
    if (!isPreview) {
      setBusy(true);
      try {
        const result = await apiRequest(`/${type === "QUIZ" ? "quizzes" : "study-materials"}/generate`, { method: "POST", body: { type, title: values.title.trim(), difficulty: values.difficulty, sources, contentRequest, quantity: Number(values.quantity ?? 6), detail: values.detail ?? "detailed" } });
        setPreview(result.content);
      } catch (error) { setError(error.message); }
      finally { setBusy(false); }
      return;
    }
    const next = sampleContent(
      type,
      values.title.trim() || "Ôn tập cơ sở dữ liệu",
    );
    next.sources = sources;
    next.contentRequest = contentRequest.trim();
    next.difficulty = values.difficulty;
    if (type === "QUIZ")
      next.questions = next.questions.slice(0, Number(values.quantity));
    if (type === "FLASHCARD")
      next.cards = next.cards.slice(0, Number(values.quantity));
    if (type === "MINDMAP" && values.detail === "overview")
      next.nodes = next.nodes.filter(
        (node) => !node.parent || node.parent === "root",
      );
    setPreview(next);
  }
  async function savePreview() {
    if (busy) return;
    if (preview.type === "FLASHCARD" && (!preview.cards.length || preview.cards.some((card) => !card.front.trim() || !card.back.trim()))) {
      setError("Mỗi Flashcard cần có nội dung ở cả mặt trước và mặt sau."); return;
    }
    if (preview.type === "MINDMAP" && preview.nodes.some((node) => !node.label.trim())) {
      setError("Mỗi nút Mindmap cần có nội dung."); return;
    }
    setBusy(true); setError("");
    try {
      const saved = !isPreview
        ? (await apiRequest(`/${preview.type === "QUIZ" ? "quizzes" : "study-materials"}`, { method: "POST", body: preview })).content : preview;
      setData((old) => ({ ...old, contents: [...old.contents, saved] }));
      notify(saved.persisted ? "Đã lưu học liệu vào database." : "Đã lưu học liệu mẫu trong phiên xem.");
      navigate(`content/${saved.id}`);
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  if (preview)
    return (
      <>
        <PageHeading
          title="Xem trước học liệu"
          description="Kiểm tra và chỉnh sửa nội dung trước khi lưu vào thư viện. Bạn cũng có thể chỉnh sửa sau khi lưu."
          action={
            <>
              <Button
                variant="secondary"
                icon="back"
                onClick={() => setPreview(null)}
              >
                Điều chỉnh thiết lập
              </Button>
              <Button
                icon="check"
                disabled={busy}
                onClick={savePreview}
              >
                Lưu vào thư viện
              </Button>
              <Button variant="secondary" icon="edit" disabled={busy} onClick={() => setEditingPreview(!editingPreview)}>
                {preview.type === "QUIZ" ? (editingPreview ? "Xem lại câu hỏi" : "Chỉnh sửa câu hỏi") : preview.type === "FLASHCARD" ? (editingPreview ? "Xem lại thẻ" : "Chỉnh sửa Flashcard") : (editingPreview ? "Xem lại sơ đồ" : "Chỉnh sửa Mindmap")}
              </Button>
            </>
          }
        />
        <div className="ws-info-banner">
          <Icon name="spark" />
          <p>
            {preview.type === "QUIZ" ? "AI giả lập: câu hỏi minh họa cố định về cơ sở dữ liệu, chưa phân tích tài liệu hoặc áp dụng yêu cầu bổ sung. Quiz luôn có 4 lựa chọn và 1 đáp án đúng. Khi lưu Quiz bằng tài khoản thật, nội dung được lưu vào database." : `AI giả lập: nội dung minh họa cố định, chưa phân tích tài liệu hoặc áp dụng yêu cầu bổ sung. ${isPreview ? "Bản xem trước chỉ lưu trong phiên xem." : "Flashcard, Mindmap và tiến độ được lưu trên máy chủ."}`}
          </p>
        </div>
        {error && <p className="ws-inline-error" role="alert">{error}</p>}
        <section className="ws-panel">
          {preview.contentRequest && (
            <div className="ws-info-banner">
              <div>
                <strong>Nội dung muốn tạo</strong>
                <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{preview.contentRequest}</p>
              </div>
            </div>
          )}
          <div className="ws-section-heading">
            <h2>{preview.title}</h2>
            <Badge>{typeLabels[preview.type]}</Badge>
          </div>
          {preview.type === "QUIZ" ? (
            preview.questions.map((question, index) => editingPreview ? (
              <section className="ws-question-edit" key={index}>
                <Badge>Câu {index + 1}</Badge>
                <Field label={`Nội dung câu ${index + 1}`}><textarea maxLength={4000} value={question.text} onChange={(event) => setPreview({ ...preview, questions: preview.questions.map((q, i) => i === index ? { ...q, text: event.target.value } : q) })} /></Field>
                {question.options.map((option, key) => <Field key={key} label={`Câu ${index + 1}: lựa chọn ${String.fromCharCode(65 + key)}`}><input maxLength={2000} value={option} onChange={(event) => setPreview({ ...preview, questions: preview.questions.map((q, i) => i === index ? { ...q, options: q.options.map((o, k) => k === key ? event.target.value : o) } : q) })} /></Field>)}
                <Field label={`Đáp án đúng câu ${index + 1}`}><select value={question.answer} onChange={(event) => setPreview({ ...preview, questions: preview.questions.map((q, i) => i === index ? { ...q, answer: Number(event.target.value) } : q) })}>{question.options.map((_, key) => <option value={key} key={key}>{String.fromCharCode(65 + key)}</option>)}</select></Field>
                <Field label={`Giải thích câu ${index + 1}`}><textarea maxLength={4000} value={question.explanation} onChange={(event) => setPreview({ ...preview, questions: preview.questions.map((q, i) => i === index ? { ...q, explanation: event.target.value } : q) })} /></Field>
              </section>
            ) : (
              <div className="ws-question-preview" key={index}>
                <strong>
                  {index + 1}. {question.text}
                </strong>
                {question.options.map((option, key) => (
                  <p
                    key={key}
                    className={key === question.answer ? "correct" : ""}
                  >
                    {String.fromCharCode(65 + key)}. {option}
                    {key === question.answer && <Icon name="check" size={15} />}
                  </p>
                ))}
                <small>{question.explanation}</small>
              </div>
            ))
          ) : preview.type === "FLASHCARD" ? (
            <div className="ws-card-grid">
              {preview.cards.map((card, index) => editingPreview ? (
                <div className="ws-mini-card" key={index}>
                  <Badge tone="orange">Thẻ {index + 1}</Badge>
                  {[ ["front", "Mặt trước"], ["back", "Mặt sau"] ].map(([field, label]) => (
                    <Field key={field} label={`Thẻ ${index + 1}: ${label}`}>
                      <textarea aria-label={`Thẻ ${index + 1}: ${label}`} rows={4} maxLength={4000} value={card[field]} onChange={(event) => setPreview({ ...preview, cards: preview.cards.map((entry, key) => key === index ? { ...entry, [field]: event.target.value } : entry) })} />
                    </Field>
                  ))}
                  <Button variant="ghost" disabled={preview.cards.length <= 1} onClick={() => setPreview({ ...preview, cards: preview.cards.filter((_, key) => key !== index) })}>Xóa thẻ {index + 1}</Button>
                </div>
              ) : (
                <div className="ws-mini-card" key={index}>
                  <Badge tone="orange">Thẻ {index + 1}</Badge>
                  <h3>{card.front}</h3>
                  <p>{card.back}</p>
                </div>
              ))}
              {editingPreview && <Button variant="secondary" icon="plus" disabled={preview.cards.length >= 50} onClick={() => setPreview({ ...preview, cards: [...preview.cards, { front: "", back: "", keyword: "" }] })}>Thêm thẻ</Button>}
            </div>
          ) : editingPreview ? (
            <MindmapEditor item={preview} onChange={(nodes) => setPreview((old) => ({ ...old, nodes }))} />
          ) : (
            <ul className="ws-tree-list">
              {preview.nodes.map((node) => (
                <li key={node.id} style={{ marginLeft: node.parent ? 24 : 0 }}>
                  {node.label}
                </li>
              ))}
            </ul>
          )}
        </section>
      </>
    );
  return (
    <>
      <PageHeading
        title="Tạo học liệu mới"
        description="Chọn nguồn kiến thức, chọn cách học và khám phá nội dung phù hợp với bạn."
      />
      <div className="ws-generation-layout">
        <form onSubmit={generate} className="ws-panel ws-form">
          <div className="ws-step-title">
            <span>1</span>
            <h2>Chọn loại học liệu</h2>
          </div>
          <div className="ws-type-picker">
            {Object.entries(typeLabels).map(([key, label]) => (
              <button
                type="button"
                key={key}
                className={type === key ? "selected" : ""}
                aria-pressed={type === key}
                onClick={() => setType(key)}
              >
                <Icon name={typeIcons[key]} size={25} />
                <strong>{label}</strong>
                <small>
                  {key === "QUIZ"
                    ? "Kiểm tra kiến thức"
                    : key === "FLASHCARD"
                      ? "Ghi nhớ chủ động"
                      : "Kết nối ý tưởng"}
                </small>
              </button>
            ))}
          </div>
          <div className="ws-step-title">
            <span>2</span>
            <h2>Chọn tài liệu nguồn</h2>
            <small>{sources.length} đã chọn</small>
          </div>
          <div className="ws-checkbox-list">
            {accessibleDocuments.map((item) => (
              <label key={item.id}>
                <input
                  type="checkbox"
                  checked={sources.includes(item.id)}
                  disabled={item.status !== "READY"}
                  onChange={(event) =>
                    setSources(
                      event.target.checked
                        ? [...sources, item.id]
                        : sources.filter((key) => key !== item.id),
                    )
                  }
                />
                <Icon name="file" size={19} />
                <span>{item.name}</span>
                <Badge tone={item.status === "READY" ? "gray" : "orange"}>
                  {item.status === "READY" ? item.type : "Chờ xử lý"}
                </Badge>
              </label>
            ))}
          </div>
          <div className="ws-step-title">
            <span>3</span>
            <h2>Thiết lập nội dung</h2>
          </div>
          <Field label="Tên học liệu / Chủ đề">
            <input
              name="title"
              defaultValue={formValues.title ?? ""}
              placeholder="Ví dụ: Ôn tập cơ sở dữ liệu — Chương 2"
              maxLength={150}
              required
            />
          </Field>
          <Field
            label="Nội dung muốn tạo (không bắt buộc)"
            hint={type === "QUIZ" ? "Mặc định: 4 lựa chọn và 1 đáp án đúng mỗi câu. Chỉ nhập nếu có yêu cầu bổ sung; chế độ giả lập lưu yêu cầu nhưng chưa áp dụng." : "Mô tả yêu cầu bổ sung nếu có. Có thể để trống."}
          >
            <textarea
              name="contentRequest"
              rows={5}
              maxLength={3000}
              value={contentRequest}
              onChange={(event) => setContentRequest(event.target.value)}
              placeholder="Ví dụ: Tập trung vào khóa chính và khóa ngoại. Câu hỏi ngắn gọn, mỗi câu có 4 lựa chọn và 1 đáp án đúng. Đáp án cần giải thích lý do kèm ví dụ dễ hiểu."
            />
          </Field>
          <div className="ws-form-grid">
            <Field label="Độ khó">
              <select name="difficulty" defaultValue={formValues.difficulty ?? "Trung bình"}>
                <option>Dễ</option>
                <option>Trung bình</option>
                <option>Khó</option>
              </select>
            </Field>
            {type === "MINDMAP" ? (
              <Field label="Mức độ chi tiết">
                <select name="detail" defaultValue={formValues.detail ?? "detailed"}>
                  <option value="detailed">Chi tiết — 3 cấp</option>
                  <option value="overview">Tổng quan — 2 cấp</option>
                </select>
              </Field>
            ) : (
              <Field label={type === "QUIZ" ? "Số câu hỏi mẫu" : "Số thẻ mẫu"}>
                <input
                  key={type}
                  type="number"
                  name="quantity"
                  min={1}
                  max={isPreview ? (type === "QUIZ" ? 5 : 6) : 20}
                  defaultValue={formValues.quantity ?? (type === "QUIZ" ? 5 : 6)}
                  required
                />
              </Field>
            )}
          </div>
          {error && (
            <p className="ws-inline-error" role="alert">
              {error}
            </p>
          )}
          <div className="ws-form-footer">
            <span>{type === "QUIZ" ? "AI giả lập dùng 5 câu hỏi minh họa; số lượng lớn hơn sẽ lặp lại." : type === "FLASHCARD" ? "AI giả lập dùng 6 thẻ minh họa; số lượng lớn hơn sẽ lặp lại." : "AI giả lập dùng sơ đồ minh họa về cơ sở dữ liệu."} Không cần API key.</span>
            <Button type="submit" icon="spark" disabled={busy}>
              {busy ? "Đang tạo…" : "Xem kết quả mẫu"}
            </Button>
          </div>
        </form>
        <aside className="ws-generation-aside">
          <span className="ws-icon-tile purple">
            <Icon name="spark" size={27} />
          </span>
          <h2>
            Học theo cách
            <br />
            phù hợp với bạn.
          </h2>
          <p>
            Mỗi loại học liệu giúp bạn tiếp cận kiến thức từ một góc nhìn khác.
          </p>
          <div>
            <Icon name="quiz" />
            <section>
              <strong>Quiz</strong>
              <p>Tự kiểm tra và hiểu vì sao một đáp án đúng.</p>
            </section>
          </div>
          <div>
            <Icon name="cards" />
            <section>
              <strong>Flashcard</strong>
              <p>Ôn tập những khái niệm cần ghi nhớ.</p>
            </section>
          </div>
          <div>
            <Icon name="map" />
            <section>
              <strong>Mindmap</strong>
              <p>Nhìn toàn cảnh và kết nối các ý chính.</p>
            </section>
          </div>
          <small>
            Kết quả AI cần được kiểm tra trước khi sử dụng hoặc chia sẻ cho lớp.
          </small>
        </aside>
      </div>
    </>
  );
}
