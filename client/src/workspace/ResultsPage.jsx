import { scoreLabel, scoreOnTen } from "./score.js";
import { useState } from "react";
import { Icon } from "../components/Brand.jsx";
import { useWorkspace } from "./WorkspaceContext.jsx";
import { dateLabel } from "./data.js";
import {
  Badge,
  Button,
  Empty,
  Field,
  PageHeading,
  Progress,
  Tabs,
  downloadText,
} from "./ui.jsx";

export default function ResultsPage({ segments = [] }) {
  const { data, isTeacher, navigate } = useWorkspace();
  const [tab, setTab] = useState(isTeacher ? "class" : "personal");
  const initialAssignment = data.assignments.find(
    (item) => item.id === segments[1],
  );
  const [classId, setClassId] = useState(
    initialAssignment?.classId ?? data.classes[0]?.id ?? "",
  );
  const [assignmentId, setAssignmentId] = useState(
    initialAssignment?.id ??
      data.assignments.find((item) => item.classId === classId)?.id ??
      "",
  );
  const [student, setStudent] = useState("ALL");
  const [personalFilter, setPersonalFilter] = useState("ALL");
  if (segments[0] === "attempt") {
    const result = [
      ...data.attempts,
      ...(isTeacher ? data.classAttempts : []),
    ].find((item) => item.id === segments[1]);
    if (!result)
      return (
        <Empty
          title="Kết quả không tồn tại trong phiên xem"
          action={
            <Button onClick={() => navigate("results")}>
              Về kết quả học tập
            </Button>
          }
        />
      );
    const correct = result.questions.filter(
      (question, index) => question.answer === result.answers[index],
    ).length;
    return (
      <>
        <Button variant="ghost" icon="back" onClick={() => navigate("results")}>
          Kết quả học tập
        </Button>
        <PageHeading
          title="Kết quả bài Quiz"
          description={`${result.title} · ${result.name} · ${dateLabel(result.date)}`}
        />
        <section className="ws-result-summary">
          <div
            className="ws-score-ring"
            style={{ "--score": `${result.score}%` }}
          >
            <span>
              <strong>
                {scoreOnTen(result.score).toLocaleString("vi-VN")}
                <small>/10</small>
              </strong>
              <small>ĐIỂM SỐ</small>
            </span>
          </div>
          <div>
            <Badge>Đã nộp bài</Badge>
            <h2>
              {result.score >= 80
                ? "Bạn đã làm rất tốt!"
                : "Mỗi lần luyện tập là một bước tiến."}
            </h2>
            <p>
              Trả lời đúng {correct}/{result.questions.length} câu.{" "}
              {result.score < 100
                ? "Xem lại kiến thức để chuẩn bị tốt hơn cho lần tiếp theo."
                : "Tiếp tục duy trì tinh thần học tập này nhé."}
            </p>
            <div className="ws-actions">
              <Button
                variant="secondary"
                onClick={() =>
                  navigate(
                    result.assignmentId
                      ? `assignments/${result.assignmentId}`
                      : `content/${result.contentId}`,
                  )
                }
              >
                Về bài Quiz
              </Button>
              <Button onClick={() => navigate("results")}>Xem lịch sử</Button>
            </div>
          </div>
        </section>
        {result.showAnswers || isTeacher ? (
          <section className="ws-panel">
            <h2>Chi tiết câu trả lời</h2>
            {result.questions.map((question, index) => (
              <div className="ws-question-preview" key={index}>
                <div className="ws-section-heading">
                  <strong>
                    {index + 1}. {question.text}
                  </strong>
                  <Badge
                    tone={
                      result.answers[index] === question.answer
                        ? "green"
                        : "red"
                    }
                  >
                    {result.answers[index] === question.answer
                      ? "Đúng"
                      : result.answers[index] < 0
                        ? "Chưa trả lời"
                        : "Sai"}
                  </Badge>
                </div>
                {question.options.map((option, key) => (
                  <p
                    className={key === question.answer ? "correct" : ""}
                    key={key}
                  >
                    {String.fromCharCode(65 + key)}. {option}
                    {result.answers[index] === key && <span>Đã chọn</span>}
                  </p>
                ))}
                <small>{question.explanation}</small>
                <small>Nguồn: {question.source}</small>
              </div>
            ))}
          </section>
        ) : (
          <div className="ws-info-banner">
            <Icon name="lock" />
            <p>
              Giáo viên chưa cho phép xem đáp án và giải thích của bài giao này.
            </p>
          </div>
        )}
      </>
    );
  }
  const cls = data.classes.find((item) => item.id === classId);
  const assignment = data.assignments.find(
    (item) => item.id === assignmentId && item.classId === classId,
  );
  const members = data.members.filter((item) => item.classId === classId);
  const attempts = data.classAttempts.filter(
    (item) =>
      item.assignmentId === assignmentId &&
      members.some((member) => member.id === item.userId),
  );
  const rows = members.map((member) => {
    const entries = attempts.filter((item) => item.userId === member.id);
    return {
      ...member,
      entries,
      best: entries.reduce(
        (best, entry) => (!best || entry.score > best.score ? entry : best),
        null,
      ),
    };
  });
  const completed = rows.filter((row) => row.best);
  const average = completed.length
    ? Math.round(
        completed.reduce((sum, row) => sum + row.best.score, 0) /
          completed.length,
      )
    : null;
  const wrong = (assignment?.questions ?? []).map((question, index) => ({
    text: question.text,
    count: completed.filter(
      (row) => row.best.answers[index] !== question.answer,
    ).length,
  }));
  const personal = data.attempts.filter(
    (item) =>
      personalFilter === "ALL" ||
      (personalFilter === "CLASS" ? item.assignmentId : !item.assignmentId),
  );
  function exportCsv() {
    const escape = (value) =>
      `"${(/^[\s]*[=+@-]/.test(String(value)) ? "'" : "") + String(value).replaceAll('"', '""')}"`;
    const entries = [
      ["Họ tên", "Email", "Điểm cao nhất (thang 10)", "Số lần làm"],
      ...rows.map((row) => [
        row.name,
        row.email,
        row.best ? scoreOnTen(row.best.score) : "Chưa làm",
        row.entries.length,
      ]),
    ];
    downloadText(
      `\uFEFF${entries.map((row) => row.map(escape).join(",")).join("\r\n")}`,
      "ket-qua-lop-mau.csv",
      "text/csv;charset=utf-8",
    );
  }
  return (
    <>
      <PageHeading
        title="Kết quả học tập"
        description={
          isTeacher
            ? "Hiểu tiến độ của lớp và nhận diện kiến thức cần củng cố."
            : "Nhìn lại các lượt làm Quiz và theo dõi tiến bộ của bạn."
        }
        action={
          isTeacher &&
          tab === "class" && (
            <Button variant="secondary" icon="download" onClick={exportCsv}>
              Xuất CSV mẫu
            </Button>
          )
        }
      />
      {isTeacher && (
        <Tabs
          items={[
            ["class", "Thống kê lớp học"],
            ["personal", "Kết quả cá nhân"],
          ]}
          value={tab}
          onChange={setTab}
        />
      )}
      {tab === "class" && isTeacher ? (
        <>
          <div className="ws-filter-panel">
            <Field label="Lớp học">
              <select
                value={classId}
                onChange={(event) => {
                  setClassId(event.target.value);
                  setAssignmentId(
                    data.assignments.find(
                      (item) => item.classId === event.target.value,
                    )?.id ?? "",
                  );
                  setStudent("ALL");
                }}
              >
                {data.classes.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Bài Quiz">
              <select
                value={assignmentId}
                onChange={(event) => setAssignmentId(event.target.value)}
              >
                <option value="">Chọn bài giao</option>
                {data.assignments
                  .filter((item) => item.classId === classId)
                  .map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.title}
                    </option>
                  ))}
              </select>
            </Field>
            <span>Thống kê theo điểm cao nhất của mỗi người học.</span>
          </div>
          {!assignment ? (
            <Empty title="Chọn bài Quiz để xem thống kê" />
          ) : (
            <>
              <div className="ws-stats-grid">
                {[
                  ["Người học trong lớp", members.length],
                  ["Đã hoàn thành", `${completed.length}/${members.length}`],
                  [
                    "Tỷ lệ hoàn thành",
                    `${members.length ? Math.round((completed.length / members.length) * 100) : 0}%`,
                  ],
                  ["Điểm trung bình", average === null ? "—" : scoreLabel(average)],
                ].map(([label, value]) => (
                  <div className="ws-stat" key={label}>
                    <span className="ws-muted">{label}</span>
                    <strong>{value}</strong>
                    <small>{cls?.name}</small>
                  </div>
                ))}
              </div>
              <div className="ws-columns">
                <section className="ws-panel">
                  <div className="ws-section-heading">
                    <h2>Phân bố điểm</h2>
                    <Badge tone="gray">Điểm cao nhất</Badge>
                  </div>
                  <div className="ws-distribution">
                    {[0, 20, 40, 60, 80].map((start) => {
                      const count = completed.filter(
                        (row) =>
                          row.best.score >= start &&
                          (start === 80
                            ? row.best.score <= 100
                            : row.best.score < start + 20),
                      ).length;
                      return (
                        <div key={start}>
                          <span>
                            {start / 10}–{start === 80 ? "10" : `<${(start + 20) / 10}`} điểm
                          </span>
                          <Progress
                            value={
                              completed.length
                                ? (count / completed.length) * 100
                                : 0
                            }
                          />
                          <strong>{count}</strong>
                        </div>
                      );
                    })}
                  </div>
                </section>
                <section className="ws-panel">
                  <div className="ws-section-heading">
                    <h2>Câu hỏi có tỷ lệ sai cao</h2>
                    <Badge tone="orange">{completed.length} kết quả</Badge>
                  </div>
                  {completed.length ? (
                    wrong
                      .sort((a, b) => b.count - a.count)
                      .slice(0, 3)
                      .map((question, index) => (
                        <div className="ws-wrong-question" key={question.text}>
                          <span>{index + 1}</span>
                          <p>{question.text}</p>
                          <Badge tone="orange">
                            {Math.round(
                              (question.count / completed.length) * 100,
                            )}
                            %
                          </Badge>
                        </div>
                      ))
                  ) : (
                    <Empty title="Chưa có bài nộp để phân tích" />
                  )}
                </section>
              </div>
              <section className="ws-panel">
                <div className="ws-section-heading">
                  <h2>Kết quả từng người học</h2>
                  <select
                    className="ws-select ws-student-filter"
                    aria-label="Lọc người học"
                    value={student}
                    onChange={(event) => setStudent(event.target.value)}
                  >
                    <option value="ALL">Tất cả người học</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </div>
                <table className="ws-table">
                  <thead>
                    <tr>
                      <th>Người học</th>
                      <th>Trạng thái</th>
                      <th>Điểm cao nhất</th>
                      <th>Số lần làm</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows
                      .filter((row) => student === "ALL" || row.id === student)
                      .map((row) => (
                        <tr key={row.id}>
                          <td>
                            <strong>{row.name}</strong>
                            <small>{row.email}</small>
                          </td>
                          <td>
                            <Badge tone={row.best ? "green" : "gray"}>
                              {row.best ? "Đã hoàn thành" : "Chưa làm"}
                            </Badge>
                          </td>
                          <td>{row.best ? scoreLabel(row.best.score) : "—"}</td>
                          <td>{row.entries.length}</td>
                          <td>
                            {row.best && (
                              <Button
                                variant="ghost"
                                onClick={() =>
                                  navigate(`results/attempt/${row.best.id}`)
                                }
                              >
                                Xem bài làm
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {!rows.length && <Empty title="Lớp chưa có người học" />}
              </section>
            </>
          )}
        </>
      ) : (
        <>
          <div className="ws-stats-grid">
            {[
              ["Lượt làm Quiz", data.attempts.length],
              [
                "Điểm cao nhất",
                data.attempts.length
                  ? scoreLabel(Math.max(...data.attempts.map((item) => item.score)))
                  : "—",
              ],
              [
                "Bài được giao đã làm",
                new Set(
                  data.attempts
                    .filter((item) => item.assignmentId)
                    .map((item) => item.assignmentId),
                ).size,
              ],
              [
                "Flashcard đã nhớ",
                Object.values(data.learned).reduce(
                  (sum, cards) => sum + cards.length,
                  0,
                ),
              ],
            ].map(([label, value]) => (
              <div className="ws-stat" key={label}>
                <span className="ws-muted">{label}</span>
                <strong>{value}</strong>
                <small>Trong phiên xem hiện tại</small>
              </div>
            ))}
          </div>
          <section className="ws-panel">
            <Tabs
              items={[
                ["ALL", "Tất cả lượt làm"],
                ["PERSONAL", "Quiz cá nhân"],
                ["CLASS", "Quiz được giao"],
              ]}
              value={personalFilter}
              onChange={setPersonalFilter}
            />
            {personal.length ? (
              <table className="ws-table">
                <thead>
                  <tr>
                    <th>Bài Quiz</th>
                    <th>Loại</th>
                    <th>Điểm</th>
                    <th>Ngày nộp</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {[...personal].reverse().map((item) => (
                    <tr key={item.id}>
                      <td>{item.title}</td>
                      <td>
                        <Badge tone="gray">
                          {item.assignmentId ? "Được giao" : "Cá nhân"}
                        </Badge>
                      </td>
                      <td>
                        <strong>{scoreLabel(item.score)}</strong>
                      </td>
                      <td>{dateLabel(item.date)}</td>
                      <td>
                        <Button
                          variant="ghost"
                          icon="arrow"
                          onClick={() => navigate(`results/attempt/${item.id}`)}
                        >
                          Chi tiết
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty
                title="Chưa có lịch sử làm Quiz"
                text="Hoàn thành một bài Quiz để bắt đầu theo dõi kết quả của bạn."
                action={
                  <Button onClick={() => navigate("contents")}>
                    Khám phá học liệu
                  </Button>
                }
              />
            )}
          </section>
        </>
      )}
    </>
  );
}
