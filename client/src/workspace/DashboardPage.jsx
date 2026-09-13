import { scoreLabel } from "./score.js";
import { useEffect, useState } from "react";
import { dashboardData } from "./dashboard.js";
import { Icon } from "../components/Brand.jsx";
import { useWorkspace } from "./WorkspaceContext.jsx";
import { Badge, Button, Empty, PageHeading, Progress } from "./ui.jsx";
import { dateLabel, typeIcons, typeLabels } from "./data.js";

export default function DashboardPage() {
  const { data, user, isTeacher, isPreview, href, navigate, personalDocuments, documentsLoading, documentsError, reloadDocuments, quizzesLoading, quizzesError, reloadQuizzes, classesLoading, classesError, reloadClasses, assignmentsLoading, assignmentsError, reloadAssignments } = useWorkspace();
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(timer); }, []);
  async function refresh() {
    setRefreshing(true);
    try { await Promise.all([reloadDocuments(), reloadQuizzes(), reloadClasses(), reloadAssignments()]); setNow(new Date()); }
    finally { setRefreshing(false); }
  }
  const summary = dashboardData(data, isTeacher, personalDocuments, now);
  const { classes, average, activity } = summary;
  const loading = refreshing || documentsLoading || quizzesLoading || classesLoading || assignmentsLoading;
  const error = [documentsError, quizzesError, classesError, assignmentsError].filter(Boolean).join(" ");
  if (loading || error) return <><PageHeading title={`Xin chào, ${user.fullName}.`} /><Empty title={loading ? "Đang tải số liệu tổng quan…" : "Không tải được số liệu tổng quan"} text={loading ? "Đang lấy tài liệu, lớp học và kết quả của bạn." : error} action={!loading && <Button onClick={refresh}>Thử lại</Button>} /></>;
  return (
    <>
      <PageHeading
        title={`Xin chào, ${user.fullName}.`}
        description={
          isTeacher
            ? "Một ngày mới để chia sẻ kiến thức và kết nối với lớp học."
            : "Mỗi bước nhỏ hôm nay sẽ đưa bạn gần hơn đến mục tiêu."
        }
        eyebrow={isTeacher ? "KHÔNG GIAN GIẢNG DẠY" : "KHÔNG GIAN HỌC TẬP"}
        action={!isPreview && <Button variant="secondary" icon="refresh" onClick={refresh}>Làm mới số liệu</Button>}
      />
      <section className="ws-hero">
        <div>
          <Badge tone="lime">HỌC TẬP CÙNG AI</Badge>
          <h2>
            Tài liệu của bạn.
            <br />
            Vô vàn cách để học.
          </h2>
          <p>
            Tạo Quiz, Flashcard và Mindmap từ nguồn kiến thức của riêng bạn.
          </p>
          <Button icon="spark" onClick={() => navigate("generate")}>
            Tạo học liệu mới
          </Button>
        </div>
        <div className="ws-hero-visual" aria-hidden="true">
          <div className="hero-source">
            <Icon name="file" size={26} />
            <span>Tài liệu học tập</span>
            <Icon name="check" size={17} />
          </div>
          <div className="hero-branches">
            <span>
              <Icon name="quiz" />
              Quiz
            </span>
            <span>
              <Icon name="cards" />
              Flashcard
            </span>
            <span>
              <Icon name="map" />
              Mindmap
            </span>
          </div>
          <span className="hero-caption">
            Kết nối kiến thức, khơi mở ý tưởng
          </span>
        </div>
      </section>
      <div className="ws-stats-grid">
        {(isTeacher ? [
          ["users", "Lớp đang quản lý", classes.length, "Các lớp đang hoạt động", "orange", "classes"],
          ["users", "Học sinh trong các lớp", summary.studentCount, "Mỗi học sinh chỉ tính một lần", "green", "classes"],
          ["clock", "Yêu cầu chờ duyệt", summary.requests.length, "Xem danh sách yêu cầu bên dưới", "purple", summary.requests.length ? `classes/${summary.requests[0].classId}/requests` : "classes"],
          ["quiz", "Quiz đã công bố", summary.publishedCount, "Bao gồm bài sắp mở, đang mở và đã kết thúc", "blue", "assignments"],
        ] : [
          [
            "file",
            "Tài liệu của tôi",
            personalDocuments.length,
            "Nguồn kiến thức của bạn",
            "green",
            "documents",
          ],
          [
            "spark",
            "Học liệu đã tạo",
            data.contents.length,
            "Quiz, Flashcard và Mindmap",
            "purple",
            "contents",
          ],
          [
            "users",
            isTeacher ? "Lớp đang quản lý" : "Lớp đã tham gia",
            classes.length,
            "Cùng nhau học tốt hơn",
            "orange",
            "classes",
          ],
          [
            "trophy",
            "Điểm Quiz trung bình",
            average === null ? "—" : scoreLabel(average),
            `${summary.attemptCount} lượt đã nộp, gồm tự luyện và bài giao`,
            "blue",
            "results",
          ],
        ]).map(([icon, label, value, note, tone, route]) => (
          <a className="ws-stat ws-stat-link" key={label} href={href(route)}>
            <span className={`ws-icon-tile ${tone}`}>
              <Icon name={icon} />
            </span>
            <span className="ws-muted">{label}</span>
            <strong>{value}</strong>
            <small>{note}</small>
          </a>
        ))}
      </div>
      <div className="ws-columns">
        <section className="ws-panel">
          <div className="ws-section-heading">
            <div>
              <h2>Học liệu gần đây</h2>
              <p>Tiếp tục từ nơi bạn đã dừng lại</p>
            </div>
            <a href={href("contents")}>
              Xem tất cả <Icon name="arrow" size={15} />
            </a>
          </div>
          {summary.recentContents
            .map((item) => (
              <a
                href={href(`content/${item.id}`)}
                className="ws-resource-row"
                key={item.id}
              >
                <span
                  className={`ws-icon-tile ${item.type === "QUIZ" ? "green" : item.type === "FLASHCARD" ? "orange" : "purple"}`}
                >
                  <Icon name={typeIcons[item.type]} />
                </span>
                <div>
                  <strong>{item.title}</strong>
                  <small>
                    {typeLabels[item.type]} · {dateLabel(item.createdAt)}
                  </small>
                </div>
                <Icon name="chevron" size={17} />
              </a>
            ))}
          {!data.contents.length && <Empty title="Chưa có học liệu" />}
        </section>
        <section className="ws-panel">
          <div className="ws-section-heading">
            <div>
              <h2>Hoạt động 7 ngày</h2>
              <p>{isTeacher ? "Tài liệu, học liệu của bạn và bài nộp trong lớp" : "Tài liệu, học liệu và lượt làm Quiz của bạn"}</p>
            </div>
            <Badge>
              {activity.reduce((sum, day) => sum + day.count, 0)} hoạt động
            </Badge>
          </div>
          <div className="ws-bar-chart">
            {activity.map((day) => (
              <div key={day.label}>
                <span>{day.count}</span>
                <div>
                  <i
                    style={{
                      height: `${day.count ? Math.max(8, (day.count / Math.max(1, ...activity.map((item) => item.count))) * 100) : 2}%`,
                    }}
                  />
                </div>
                <small>{day.label}</small>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="ws-columns">
        <section className="ws-panel">
          <div className="ws-section-heading">
            <div>
              <h2>{isTeacher ? "Lớp học của bạn" : "Lớp đang tham gia"}</h2>
              <p>Kết nối việc tự học với lớp học</p>
            </div>
            <a href={href("classes")}>
              Xem tất cả <Icon name="arrow" size={15} />
            </a>
          </div>
          {classes.slice(0, 2).map((item) => (
            <a
              key={item.id}
              className="ws-resource-row"
              href={href(`classes/${item.id}`)}
            >
              <span className={`ws-icon-tile ${item.color}`}>
                <Icon name="users" />
              </span>
              <div>
                <strong>{item.name}</strong>
                <small>
                  {item.group} ·{" "}
                  {isTeacher
                    ? `${data.members.filter((member) => member.classId === item.id).length} người học`
                    : item.teacher}
                </small>
              </div>
              <Icon name="chevron" size={17} />
            </a>
          ))}
          {!classes.length && <Empty title={isTeacher ? "Chưa có lớp đang quản lý" : "Bạn chưa tham gia lớp nào"} action={<Button onClick={() => navigate("classes")}>{isTeacher ? "Tạo lớp học" : "Tham gia lớp"}</Button>} />}
        </section>
        <section className="ws-panel">
          <div className="ws-section-heading">
            <div>
              <h2>Quiz sắp đến hạn</h2>
              <p>Sắp xếp thời gian cho bài học tiếp theo</p>
            </div>
            <a href={href("assignments")}>
              Xem tất cả <Icon name="arrow" size={15} />
            </a>
          </div>
          {summary.upcoming.slice(0, 3)
            .map((item) => (
              <a
                className="ws-resource-row"
                key={item.id}
                href={href(`assignments/${item.id}`)}
              >
                <span className="ws-icon-tile orange">
                  <Icon name="clock" />
                </span>
                <div>
                  <strong>{item.title}</strong>
                  <small>Hạn nộp: {dateLabel(item.dueAt)}</small>
                  <small>{new Date(item.startAt) > now ? "Chưa đến giờ mở bài" : item.inProgress ? "Bạn đang làm bài này" : "Đang mở"}</small>
                </div>
                <Icon name="chevron" size={17} />
              </a>
            ))}
          {!summary.upcoming.length && <Empty title="Không có Quiz sắp đến hạn" text="Bài mới sẽ xuất hiện ở đây khi được công bố. Bài hết hạn hoặc hết lượt làm không được hiển thị." />}
        </section>
      </div>
      <div className="ws-columns">
        <section className="ws-panel">
          <div className="ws-section-heading"><h2>{isTeacher ? "Bài nộp gần đây" : "Kết quả gần đây"}</h2><a href={href(isTeacher && summary.recentResults.length ? `results/assignment/${summary.recentResults[0].assignmentId}` : "results")}>{isTeacher && summary.recentResults.length ? "Thống kê bài giao gần nhất" : "Xem tất cả"}</a></div>
          {summary.recentResults.map((item) => <a className="ws-resource-row" key={item.id} href={href(`results/attempt/${item.id}`)}><span className="ws-icon-tile blue"><Icon name="quiz" /></span><div><strong>{item.title}</strong><small>{isTeacher ? `${item.name} · ` : ""}{dateLabel(item.date)}</small></div><Badge>{scoreLabel(item.score)}</Badge></a>)}
          {!summary.recentResults.length && <Empty title={isTeacher ? "Chưa có bài nộp" : "Bạn chưa có kết quả Quiz"} />}
        </section>
        <section className="ws-panel">
          {isTeacher ? <>
            <div className="ws-section-heading"><h2>Yêu cầu tham gia cần duyệt</h2><Badge>{summary.requests.length} yêu cầu</Badge></div>
            {summary.requests.slice(0, 5).map((item) => <a className="ws-resource-row" key={item.id} href={href(`classes/${item.classId}/requests`)}><span className="ws-icon-tile orange"><Icon name="users" /></span><div><strong>{item.name}</strong><small>{classes.find((cls) => cls.id === item.classId)?.name}</small></div><Icon name="chevron" size={17} /></a>)}
            {!summary.requests.length && <Empty title="Không có yêu cầu chờ duyệt" />}
          </> : <>
            <div className="ws-section-heading"><h2>Tiến độ Flashcard</h2><Badge>{summary.remembered}/{summary.totalCards} thẻ đã nhớ</Badge></div>
            <Progress value={summary.totalCards ? summary.remembered / summary.totalCards * 100 : 0} />
            {summary.cards.slice(0, 3).map((item) => <a className="ws-resource-row" key={item.id} href={href(`content/${item.id}`)}><span className="ws-icon-tile purple"><Icon name="cards" /></span><div><strong>{item.title}</strong><small>{item.remembered}/{item.total} thẻ đã nhớ · {item.total - item.remembered} thẻ cần ôn</small></div><Icon name="chevron" size={17} /></a>)}
            {!summary.cards.length && <Empty title="Chưa có bộ Flashcard" action={<Button onClick={() => navigate("generate")}>Tạo Flashcard</Button>} />}
          </>}
        </section>
      </div>
      <section className="ws-account-summary">
        <span>{isPreview ? "Tài khoản mẫu" : "Đã đăng nhập thành công"}</span>
        <dl>
          <div>
            <dt>Họ và tên</dt>
            <dd>{user.fullName}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Vai trò</dt>
            <dd>{isTeacher ? "Giáo viên" : "Người học"}</dd>
          </div>
        </dl>
      </section>
    </>
  );
}
