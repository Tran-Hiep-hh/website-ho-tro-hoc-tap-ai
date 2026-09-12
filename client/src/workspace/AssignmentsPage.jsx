import { scoreLabel } from "./score.js";
import { useState } from "react";
import { apiRequest } from "../lib/api.js";
import { Icon } from "../components/Brand.jsx";
import { useWorkspace } from "./WorkspaceContext.jsx";
import { dateLabel, id } from "./data.js";
import {
  Badge,
  Button,
  Empty,
  Field,
  PageHeading,
  Search,
  Tabs,
} from "./ui.jsx";

export function assignmentStatus(item) {
  if (item.status === "DRAFT") return ["Bản nháp", "gray"];
  if (item.status === "CANCELLED") return ["Đã hủy", "gray"];
  if (new Date(item.startAt) > new Date()) return ["Sắp mở", "blue"];
  if (new Date(item.dueAt) < new Date()) return ["Đã kết thúc", "gray"];
  return ["Đang mở", "green"];
}
const inputDate = (value) => {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};

export default function AssignmentsPage({ segments = [] }) {
  const { data, setData, isTeacher, navigate, notify, update, confirm, isPreview, reloadAssignments } =
    useWorkspace();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [status, setStatus] = useState("PUBLISHED");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function changeStatus(value) {
    if (isPreview) { update("assignments", assignment.id, { status: value }); return; }
    setBusy(true);
    try { await apiRequest(`/assignments/${assignment.id}/status`, { method: "POST", body: { status: value } }); await reloadAssignments(); notify("Đã cập nhật bài giao."); }
    catch (err) { notify(err.message); }
    finally { setBusy(false); }
  }
  const creating = segments[0] === "new";
  const assignment = data.assignments.find((item) => item.id === segments[0]);
  const availableClasses = data.classes.filter(
    (item) => isTeacher || item.joined,
  );
  const quizzes = data.contents.filter((item) => item.type === "QUIZ");
  async function createAssignment(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (new Date(values.dueAt) <= new Date(values.startAt)) {
      setError("Hạn nộp phải sau thời gian mở bài.");
      return;
    }
    const quiz = quizzes.find((item) => item.id === values.contentId);
    if (!isPreview) {
      setBusy(true); setError("");
      try {
        const result = await apiRequest("/assignments", { method: "POST", body: { ...values, versionId: quiz.versionId, startAt: new Date(values.startAt).toISOString(), dueAt: new Date(values.dueAt).toISOString(), maxAttempts: Number(values.maxAttempts), showAnswers: values.showAnswers === "on", status } });
        await reloadAssignments(); navigate(`assignments/${result.id}`); notify("Đã lưu bài giao trên máy chủ.");
      } catch (err) { setError(err.message); }
      finally { setBusy(false); }
      return;
    }
    const next = {
      ...values,
      id: id(),
      title: values.title.trim(),
      startAt: new Date(values.startAt).toISOString(),
      dueAt: new Date(values.dueAt).toISOString(),
      maxAttempts: Number(values.maxAttempts),
      showAnswers: values.showAnswers === "on",
      status,
      questions: structuredClone(quiz.questions),
    };
    setData((old) => ({
      ...old,
      assignments: [...old.assignments, next],
      notifications:
        status === "PUBLISHED"
          ? [
              {
                id: id(),
                title: "Quiz mới đã được công bố",
                text: next.title,
                route: `assignments/${next.id}`,
                read: false,
                date: new Date().toISOString(),
                icon: "quiz",
              },
              ...old.notifications,
            ]
          : old.notifications,
    }));
    notify(
      status === "DRAFT"
        ? "Đã lưu bài giao nháp trong bản xem trước."
        : "Đã công bố Quiz trong lớp mẫu.",
    );
    navigate(`assignments/${next.id}`);
  }
  if (creating) {
    if (!isTeacher) return <Empty title="Chức năng dành cho Giáo viên" />;
    if (!quizzes.length || !availableClasses.length)
      return (
        <Empty
          title="Cần có lớp học và Quiz trước khi giao bài"
          action={
            <Button
              onClick={() => navigate(quizzes.length ? "classes" : "generate")}
            >
              {quizzes.length ? "Tạo lớp học" : "Tạo Quiz"}
            </Button>
          }
        />
      );
    return (
      <>
        <Button
          variant="ghost"
          icon="back"
          onClick={() => navigate("assignments")}
        >
          Danh sách bài giao
        </Button>
        <PageHeading
          title="Giao Quiz cho lớp"
          description="Chọn Quiz đã kiểm duyệt và thiết lập điều kiện làm bài."
        />
        <form
          className="ws-panel ws-form ws-form-medium"
          onSubmit={createAssignment}
        >
          <Field label="Tên bài giao">
            <input
              name="title"
              required
              maxLength={150}
              placeholder="Ví dụ: Ôn tập chương 2"
            />
          </Field>
          <div className="ws-form-grid">
            <Field label="Quiz sử dụng">
              <select
                name="contentId"
                defaultValue={segments[2] ?? quizzes[0].id}
              >
                {quizzes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Lớp nhận bài">
              <select
                name="classId"
                defaultValue={
                  availableClasses.some((item) => item.id === segments[1])
                    ? segments[1]
                    : availableClasses[0].id
                }
              >
                {availableClasses.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} — {item.group}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="ws-form-grid">
            <Field label="Thời gian mở bài">
              <input
                name="startAt"
                type="datetime-local"
                defaultValue={inputDate(Date.now() + 3600000)}
                required
              />
            </Field>
            <Field label="Hạn nộp">
              <input
                name="dueAt"
                type="datetime-local"
                defaultValue={inputDate(Date.now() + 3 * 86400000)}
                required
              />
            </Field>
            <Field label="Số lần được làm">
              <input
                name="maxAttempts"
                type="number"
                min={1}
                max={10}
                defaultValue={3}
                required
              />
            </Field>
            <Field label="Trạng thái">
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="PUBLISHED">Công bố cho lớp</option>
                <option value="DRAFT">Lưu bản nháp</option>
              </select>
            </Field>
          </div>
          <label className="ws-check-line">
            <input type="checkbox" name="showAnswers" defaultChecked />
            Cho phép xem đáp án và giải thích sau khi nộp
          </label>
          <label className="ws-check-line">
            <input type="checkbox" required={status === "PUBLISHED"} />
            Tôi đã kiểm duyệt nội dung Quiz trước khi giao cho lớp.
          </label>
          <div className="ws-info-banner">
            <Icon name="lock" size={18} />
            <p>Bài giao giữ nguyên phiên bản câu hỏi khi tạo, kể cả khi lưu nháp.</p>
          </div>
          {error && (
            <p className="ws-inline-error" role="alert">
              {error}
            </p>
          )}
          <div className="ws-form-footer">
            <Button variant="secondary" onClick={() => navigate("assignments")}>
              Hủy
            </Button>
            <Button type="submit" icon="check" disabled={busy}>
              {status === "DRAFT" ? "Lưu bản nháp" : "Công bố Quiz"}
            </Button>
          </div>
        </form>
      </>
    );
  }
  if (segments[0]) {
    if (
      !assignment ||
      (!isTeacher &&
        (assignment.status !== "PUBLISHED" ||
          !availableClasses.some((cls) => cls.id === assignment.classId)))
    )
      return <Empty title="Bài giao không khả dụng" />;
    const [label, tone] = assignmentStatus(assignment);
    const attempts = data.attempts.filter(
      (item) => item.assignmentId === assignment.id,
    );
    const canStart =
      label === "Đang mở" && (assignment.inProgress || (assignment.attemptsUsed ?? attempts.length) < assignment.maxAttempts);
    return (
      <>
        {!isPreview && <Button variant="secondary" onClick={reloadAssignments}>Làm mới</Button>}
        <Button
          variant="ghost"
          icon="back"
          onClick={() => navigate("assignments")}
        >
          Danh sách bài Quiz
        </Button>
        <PageHeading
          title={assignment.title}
          description={
            data.classes.find((item) => item.id === assignment.classId)?.name ??
            "Lớp học"
          }
          action={<Badge tone={tone}>{label}</Badge>}
        />
        <div className="ws-columns">
          <section className="ws-panel">
            <h2>Thông tin bài Quiz</h2>
            <dl className="ws-detail-list">
              <dt>Số câu hỏi</dt>
              <dd>{assignment.questionCount ?? assignment.questions.length} câu trắc nghiệm</dd>
              <dt>Thời gian mở</dt>
              <dd>{new Date(assignment.startAt).toLocaleString("vi-VN")}</dd>
              <dt>Hạn nộp</dt>
              <dd>{new Date(assignment.dueAt).toLocaleString("vi-VN")}</dd>
              <dt>Số lần được làm</dt>
              <dd>{assignment.maxAttempts} lượt</dd>
              <dt>Hiển thị đáp án</dt>
              <dd>
                {assignment.showAnswers ? "Sau khi nộp bài" : "Không công bố"}
              </dd>
            </dl>
            {isTeacher ? (
              <div className="ws-actions">
                <Button
                  onClick={() =>
                    navigate(`results/assignment/${assignment.id}`)
                  }
                  icon="chart"
                >
                  Xem kết quả
                </Button>
                {assignment.status === "DRAFT" && (
                  <Button
                    disabled={busy}
                    onClick={() =>
                      confirm({
                        title: "Công bố bài giao?",
                        text: "Xác nhận bạn đã kiểm duyệt Quiz và muốn công bố cho lớp.",
                        label: "Công bố",
                        action: () => changeStatus("PUBLISHED"),
                      })
                    }
                  >
                    Công bố
                  </Button>
                )}
                {assignment.status !== "CANCELLED" &&
                  (assignment.status === "DRAFT" ||
                    new Date(assignment.startAt) > new Date()) && (
                    <Button
                      variant="danger"
                      disabled={busy}
                      onClick={() =>
                        confirm({
                          title: "Hủy bài giao?",
                          text: "Người học sẽ không thể bắt đầu bài Quiz này.",
                          action: () => changeStatus("CANCELLED"),
                        })
                      }
                    >
                      Hủy bài giao
                    </Button>
                  )}
              </div>
            ) : (
              <>
                <p className="ws-muted">
                  Bạn đã sử dụng {assignment.attemptsUsed ?? attempts.length}/{assignment.maxAttempts} lượt
                  làm.
                </p>
                <div className="ws-page-bottom">
                  <Button
                    icon="quiz"
                    disabled={!canStart}
                    onClick={() => navigate(`play/assignment/${assignment.id}`)}
                  >
                    {canStart
                      ? assignment.inProgress ? "Tiếp tục làm bài" : "Bắt đầu làm bài"
                      : (assignment.attemptsUsed ?? attempts.length) >= assignment.maxAttempts
                        ? "Đã hết lượt làm"
                        : label}
                  </Button>
                </div>
              </>
            )}
          </section>
          <section className="ws-panel">
            <h2>{isTeacher ? "Lưu ý khi giao bài" : "Trước khi bắt đầu"}</h2>
            <ul className="ws-guidelines">
              <li>Mỗi câu hỏi có một đáp án đúng.</li>
              <li>{isPreview ? "Câu trả lời được giữ trong phiên xem trước." : "Mỗi lựa chọn được lưu trên máy chủ. Chờ lưu xong trước khi đóng trang."}</li>
              <li>Khi hết hạn, bài được chấm từ các câu trả lời đã lưu; không nhận thay đổi sau hạn.</li>
              <li>{isPreview ? "Kết quả ở đây là kết quả mẫu trong trình duyệt." : "Điểm được chấm trên máy chủ và hiển thị theo thang 10."}</li>
            </ul>
            <h2>Lịch sử làm bài</h2>
            {attempts.length ? (
              attempts.map((item, index) => (
                <div className="ws-resource-row" key={item.id}>
                  <div>
                    <strong>
                      Lần {index + 1} · {scoreLabel(item.score)}
                    </strong>
                    <small>{dateLabel(item.date)}</small>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => navigate(`results/attempt/${item.id}`)}
                  >
                    Chi tiết
                  </Button>
                </div>
              ))
            ) : (
              <Empty
                title="Chưa có lượt làm"
                text="Kết quả sẽ xuất hiện sau khi nộp bài."
              />
            )}
          </section>
        </div>
      </>
    );
  }
  const items = data.assignments.filter(
    (item) =>
      availableClasses.some((cls) => cls.id === item.classId) &&
      (isTeacher || item.status === "PUBLISHED") &&
      (filter === "ALL" || item.status === filter) &&
      item.title
        .toLocaleLowerCase("vi")
        .includes(query.toLocaleLowerCase("vi")),
  );
  return (
    <>
      <PageHeading
        title={
          isTeacher ? "Giao Quiz & quản lý bài giao" : "Bài Quiz được giao"
        }
        description={
          isTeacher
            ? "Theo dõi các bài giao và thiết lập hoạt động kiểm tra cho lớp."
            : "Theo dõi thời gian mở bài, hạn nộp và các lượt làm của bạn."
        }
        action={
          isTeacher && (
            <Button icon="plus" onClick={() => navigate("assignments/new")}>
              Giao Quiz mới
            </Button>
          )
        }
      />
      <section className="ws-panel">
        <div className="ws-toolbar">
          {!isPreview && <Button variant="secondary" onClick={reloadAssignments}>Làm mới</Button>}
          <Tabs
            items={[
              ["ALL", "Tất cả"],
              ["PUBLISHED", "Đã công bố"],
              ...(isTeacher
                ? [
                    ["DRAFT", "Bản nháp"],
                    ["CANCELLED", "Đã hủy"],
                  ]
                : []),
            ]}
            value={filter}
            onChange={setFilter}
          />
          <Search
            value={query}
            onChange={setQuery}
            placeholder="Tìm bài Quiz…"
          />
        </div>
        {items.length ? (
          <table className="ws-table">
            <thead>
              <tr>
                <th>Bài Quiz</th>
                <th>Lớp học</th>
                <th>Hạn nộp</th>
                <th>Trạng thái</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.title}</strong>
                    <small>
                      {item.questionCount ?? item.questions.length} câu hỏi · {item.maxAttempts} lượt
                      làm
                    </small>
                  </td>
                  <td>
                    {data.classes.find((cls) => cls.id === item.classId)?.name}
                  </td>
                  <td>{dateLabel(item.dueAt)}</td>
                  <td>
                    <Badge tone={assignmentStatus(item)[1]}>
                      {assignmentStatus(item)[0]}
                    </Badge>
                  </td>
                  <td>
                    <Button
                      variant="ghost"
                      icon="arrow"
                      onClick={() => navigate(`assignments/${item.id}`)}
                    >
                      Chi tiết
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty title="Chưa có bài giao phù hợp" />
        )}
      </section>
    </>
  );
}
