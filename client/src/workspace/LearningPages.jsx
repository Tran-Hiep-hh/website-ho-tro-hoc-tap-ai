import { useState } from "react";
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
  const { data, navigate, confirm, remove, notify } = useWorkspace();
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
      data.classes.some((cls) => cls.materialIds.includes(item.id)) ||
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
      text: `Xóa “${item.title}” khỏi thư viện mẫu?`,
      label: "Xóa học liệu",
      action: () => remove("contents", item.id),
    });
  }
  return (
    <>
      <PageHeading
        title="Học liệu AI"
        description="Thư viện kiến thức của bạn, được tổ chức theo cách bạn muốn học."
        action={
          <Button icon="plus" onClick={() => navigate("generate")}>
            Tạo học liệu
          </Button>
        }
      />
      <div className="ws-toolbar">
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
          <article className="ws-learning-card" key={item.id}>
            <div className={`ws-learning-art ${item.type.toLowerCase()}`}>
              <Icon name={typeIcons[item.type]} size={47} />
              <span>{typeLabels[item.type]}</span>
              <i />
              <i />
            </div>
            <div className="ws-class-card-body">
              <div className="ws-card-labels">
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
  const { data, setData, navigate, notify } = useWorkspace();
  const [type, setType] = useState("QUIZ");
  const [sources, setSources] = useState(sourceId ? [sourceId] : []);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  function generate(event) {
    event.preventDefault();
    setError("");
    if (!sources.length) {
      setError("Chọn ít nhất một tài liệu sẵn sàng để tiếp tục.");
      return;
    }
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const next = sampleContent(
      type,
      values.title.trim() || "Ôn tập cơ sở dữ liệu",
    );
    next.sources = sources;
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
  if (preview)
    return (
      <>
        <PageHeading
          title="Xem trước học liệu"
          description="Kiểm tra kết quả mẫu trước khi lưu vào thư viện. Bạn có thể chỉnh sửa sau khi lưu."
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
                onClick={() => {
                  setData((old) => ({
                    ...old,
                    contents: [...old.contents, preview],
                  }));
                  notify("Đã lưu học liệu mẫu vào thư viện của phiên xem.");
                  navigate(`content/${preview.id}`);
                }}
              >
                Lưu vào thư viện
              </Button>
            </>
          }
        />
        <div className="ws-info-banner">
          <Icon name="spark" />
          <p>
            Đây là nội dung minh họa cố định về cơ sở dữ liệu, chưa phải kết quả
            phân tích tài liệu bằng AI.
          </p>
        </div>
        <section className="ws-panel">
          <div className="ws-section-heading">
            <h2>{preview.title}</h2>
            <Badge>{typeLabels[preview.type]}</Badge>
          </div>
          {preview.type === "QUIZ" ? (
            preview.questions.map((question, index) => (
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
              {preview.cards.map((card, index) => (
                <div className="ws-mini-card" key={index}>
                  <Badge tone="orange">Thẻ {index + 1}</Badge>
                  <h3>{card.front}</h3>
                  <p>{card.back}</p>
                </div>
              ))}
            </div>
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
            {data.documents.map((item) => (
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
              placeholder="Ví dụ: Ôn tập cơ sở dữ liệu — Chương 2"
              maxLength={150}
              required
            />
          </Field>
          <div className="ws-form-grid">
            <Field label="Độ khó">
              <select name="difficulty" defaultValue="Trung bình">
                <option>Dễ</option>
                <option>Trung bình</option>
                <option>Khó</option>
              </select>
            </Field>
            {type === "MINDMAP" ? (
              <Field label="Mức độ chi tiết">
                <select name="detail">
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
                  max={type === "QUIZ" ? 5 : 6}
                  defaultValue={type === "QUIZ" ? 5 : 6}
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
            <span>Nội dung mẫu giúp bạn xem trước luồng tạo học liệu.</span>
            <Button type="submit" icon="spark">
              Xem kết quả mẫu
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
