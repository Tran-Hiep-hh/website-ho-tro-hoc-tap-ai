import { scoreLabel } from "./score.js";
import { Icon } from "../components/Brand.jsx";
import { useWorkspace } from "./WorkspaceContext.jsx";
import { Badge, Button, Empty, PageHeading } from "./ui.jsx";
import { dateLabel, typeIcons, typeLabels } from "./data.js";

export default function DashboardPage() {
  const { data, user, isTeacher, isPreview, href, navigate } = useWorkspace();
  const classes = data.classes.filter((item) => isTeacher || item.joined);
  const average = data.attempts.length
    ? Math.round(
        data.attempts.reduce((sum, item) => sum + item.score, 0) /
          data.attempts.length,
      )
    : null;
  const activity = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - 6 + index);
    const count = [
      ...data.documents.map((item) => item.date),
      ...data.contents.map((item) => item.createdAt),
      ...data.attempts.map((item) => item.date),
    ].filter(
      (value) => new Date(value).toDateString() === date.toDateString(),
    ).length;
    return {
      label: date.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
      }),
      count,
    };
  });
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
        {[
          [
            "file",
            "Tài liệu cá nhân",
            data.documents.length,
            "Nguồn kiến thức của bạn",
            "green",
          ],
          [
            "spark",
            "Học liệu đã tạo",
            data.contents.length,
            "Quiz, Flashcard và Mindmap",
            "purple",
          ],
          [
            "users",
            isTeacher ? "Lớp đang quản lý" : "Lớp đã tham gia",
            classes.length,
            "Cùng nhau học tốt hơn",
            "orange",
          ],
          [
            "trophy",
            "Điểm Quiz trung bình",
            average === null ? "—" : scoreLabel(average),
            `${data.attempts.length} lượt làm cá nhân`,
            "blue",
          ],
        ].map(([icon, label, value, note, tone]) => (
          <section className="ws-stat" key={label}>
            <span className={`ws-icon-tile ${tone}`}>
              <Icon name={icon} />
            </span>
            <span className="ws-muted">{label}</span>
            <strong>{value}</strong>
            <small>{note}</small>
          </section>
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
          {data.contents
            .slice(-3)
            .reverse()
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
              <p>Tài liệu, học liệu và lượt làm Quiz</p>
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
          {data.assignments
            .filter(
              (item) =>
                item.status === "PUBLISHED" &&
                new Date(item.dueAt) > new Date() &&
                classes.some((cls) => cls.id === item.classId),
            )
            .slice(0, 2)
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
                </div>
                <Icon name="chevron" size={17} />
              </a>
            ))}
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
