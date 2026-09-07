import { useState } from "react";
import { Icon } from "../components/Brand.jsx";
import { useWorkspace } from "./WorkspaceContext.jsx";
import { dateLabel, id } from "./data.js";
import {
  Badge,
  Button,
  Empty,
  Field,
  IconButton,
  Modal,
  PageHeading,
  Search,
  Tabs,
} from "./ui.jsx";

export default function ClassesPage({ classId }) {
  const {
    data,
    setData,
    isTeacher,
    user,
    navigate,
    update,
    remove,
    notify,
    confirm,
  } = useWorkspace();
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState(null);
  const [tab, setTab] = useState("materials");
  const [joinMatch, setJoinMatch] = useState(null);
  const [error, setError] = useState("");
  const cls = data.classes.find(
    (item) => item.id === classId && (isTeacher || item.joined),
  );
  const requests = data.requests.filter((item) => item.classId === classId);
  function saveClass(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (!values.name.trim()) return;
    if (modal === "edit")
      update("classes", cls.id, { ...values, name: values.name.trim() });
    else {
      const newClass = {
        ...values,
        name: values.name.trim(),
        id: id(),
        code: id().slice(0, 6).toUpperCase(),
        teacher: user.fullName,
        color: "green",
        joined: true,
        materialIds: [],
      };
      setData((old) => ({ ...old, classes: [...old.classes, newClass] }));
      navigate(`classes/${newClass.id}`);
    }
    setModal(null);
    notify("Đã lưu lớp trong bản xem trước.");
  }
  function processRequest(request, approve) {
    setData((old) => ({
      ...old,
      requests: old.requests.filter((item) => item.id !== request.id),
      members: approve
        ? [...old.members, { ...request, id: id() }]
        : old.members,
    }));
    notify(
      approve ? "Đã duyệt yêu cầu tham gia mẫu." : "Đã từ chối yêu cầu mẫu.",
    );
  }
  function removeClass() {
    if (
      data.assignments.some(
        (item) =>
          item.classId === cls.id &&
          item.status === "PUBLISHED" &&
          new Date(item.startAt) <= new Date() &&
          new Date(item.dueAt) > new Date(),
      )
    ) {
      notify(
        "Lớp có Quiz đang diễn ra. Hãy chờ bài giao kết thúc trước khi xóa hoặc rời lớp.",
      );
      return;
    }
    confirm({
      title: isTeacher ? "Xóa lớp học?" : "Rời lớp học?",
      text: "Thao tác này áp dụng cho dữ liệu mẫu trong phiên xem hiện tại.",
      action: () => {
        if (isTeacher) remove("classes", cls.id);
        else update("classes", cls.id, { joined: false });
        navigate("classes");
      },
    });
  }
  const classModal = modal && (
    <Modal
      title={
        modal === "join"
          ? "Tham gia lớp học"
          : modal === "share"
            ? "Chia sẻ học liệu"
            : modal === "edit"
              ? "Cập nhật lớp học"
              : "Tạo lớp học mới"
      }
      onClose={() => {
        setModal(null);
        setJoinMatch(null);
        setError("");
      }}
    >
      {modal === "join" ? (
        <form
          className="ws-form"
          onSubmit={(event) => {
            event.preventDefault();
            const code = new FormData(event.currentTarget)
              .get("code")
              .trim()
              .toUpperCase();
            const found = data.classes.find((item) => item.code === code);
            if (!found) {
              setError("Không tìm thấy lớp. Thử mã mẫu CTDL26.");
              setJoinMatch(null);
            } else if (found.joined || found.pending) {
              setError("Bạn đã tham gia hoặc đang chờ duyệt lớp này.");
              setJoinMatch(null);
            } else {
              setJoinMatch(found);
              setError("");
            }
          }}
        >
          <p className="ws-muted">
            Nhập mã lớp do giáo viên cung cấp. Bạn có thể thử mã mẫu{" "}
            <strong>CTDL26</strong>.
          </p>
          <Field label="Mã tham gia">
            <input
              name="code"
              placeholder="Ví dụ: CTDL26"
              required
              maxLength={20}
              onChange={() => setJoinMatch(null)}
            />
          </Field>
          {error && (
            <p className="ws-inline-error" role="alert">
              {error}
            </p>
          )}
          {joinMatch && (
            <div className="ws-info-banner">
              <Icon name="users" />
              <div>
                <strong>{joinMatch.name}</strong>
                <p>Giáo viên: {joinMatch.teacher}</p>
              </div>
            </div>
          )}
          <div className="ws-modal-actions">
            <Button variant="secondary" onClick={() => setModal(null)}>
              Hủy
            </Button>
            {joinMatch ? (
              <Button
                onClick={() => {
                  update("classes", joinMatch.id, { pending: true });
                  setModal(null);
                  setJoinMatch(null);
                  notify(
                    "Đã gửi yêu cầu tham gia mẫu. Trạng thái: chờ giáo viên duyệt.",
                  );
                }}
              >
                Gửi yêu cầu tham gia
              </Button>
            ) : (
              <Button type="submit">Tìm lớp</Button>
            )}
          </div>
        </form>
      ) : modal === "share" ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const selected = new FormData(event.currentTarget).getAll(
              "material",
            );
            update("classes", cls.id, {
              materialIds: [...new Set([...cls.materialIds, ...selected])],
            });
            setModal(null);
            notify("Đã chia sẻ học liệu trong lớp mẫu.");
          }}
        >
          <p className="ws-muted">
            Chọn tài liệu, Flashcard hoặc Mindmap đã kiểm duyệt.
          </p>
          <div className="ws-checkbox-list">
            {[
              ...data.documents.filter((item) => item.status === "READY"),
              ...data.contents.filter((item) => item.type !== "QUIZ"),
            ].map((item) => (
              <label key={item.id}>
                <input
                  type="checkbox"
                  name="material"
                  value={item.id}
                  disabled={cls.materialIds.includes(item.id)}
                  defaultChecked={cls.materialIds.includes(item.id)}
                />
                <Icon name="file" size={18} />
                <span>{item.name ?? item.title}</span>
                {cls.materialIds.includes(item.id) && <Badge>Đã chia sẻ</Badge>}
              </label>
            ))}
          </div>
          <label className="ws-check-line">
            <input type="checkbox" required />
            Tôi đã kiểm tra nội dung trước khi chia sẻ.
          </label>
          <div className="ws-modal-actions">
            <Button variant="secondary" onClick={() => setModal(null)}>
              Hủy
            </Button>
            <Button type="submit">Chia sẻ học liệu</Button>
          </div>
        </form>
      ) : (
        <form className="ws-form" onSubmit={saveClass}>
          <Field label="Tên lớp học">
            <input
              name="name"
              defaultValue={modal === "edit" ? cls.name : ""}
              maxLength={100}
              required
              placeholder="Ví dụ: Cơ sở dữ liệu"
            />
          </Field>
          <Field label="Nhóm / Mã học phần">
            <input
              name="group"
              defaultValue={modal === "edit" ? cls.group : ""}
              required
              placeholder="Ví dụ: 67PM2"
            />
          </Field>
          <Field label="Mô tả lớp">
            <textarea
              name="description"
              defaultValue={modal === "edit" ? cls.description : ""}
              placeholder="Giới thiệu nội dung và mục tiêu của lớp học"
              maxLength={1000}
            />
          </Field>
          <p className="ws-muted">
            Mã tham gia được tự động tạo khi thêm lớp mới.
          </p>
          <div className="ws-modal-actions">
            <Button variant="secondary" onClick={() => setModal(null)}>
              Hủy
            </Button>
            <Button type="submit">
              {modal === "edit" ? "Lưu thay đổi" : "Tạo lớp học"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
  if (classId && !cls)
    return (
      <Empty
        title="Không tìm thấy lớp học"
        text="Lớp không tồn tại hoặc bạn chưa được duyệt tham gia."
        action={<Button onClick={() => navigate("classes")}>Về lớp học</Button>}
      />
    );
  if (cls) {
    const materials = [...data.documents, ...data.contents].filter((item) =>
      cls.materialIds.includes(item.id),
    );
    const members = data.members.filter(
      (item) =>
        item.classId === cls.id &&
        `${item.name} ${item.email}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    );
    return (
      <>
        <Button variant="ghost" icon="back" onClick={() => navigate("classes")}>
          Danh sách lớp học
        </Button>
        <div className={`ws-class-cover ${cls.color}`}>
          <div>
            <Badge tone="lime">{cls.group}</Badge>
            <h1>{cls.name}</h1>
            <p>{cls.description}</p>
            <span>
              <Icon name="users" size={16} />
              {
                data.members.filter((item) => item.classId === cls.id).length
              }{" "}
              thành viên · {isTeacher ? user.fullName : cls.teacher}
            </span>
          </div>
          <div className="ws-class-code">
            <small>MÃ THAM GIA</small>
            <strong>{cls.code}</strong>
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(cls.code);
                  notify("Đã sao chép mã lớp.");
                } catch {
                  notify(`Mã lớp: ${cls.code}`);
                }
              }}
            >
              Sao chép mã
            </Button>
          </div>
        </div>
        <div className="ws-toolbar">
          <Tabs
            items={[
              ["materials", "Học liệu"],
              ["assignments", "Bài Quiz"],
              ["members", "Thành viên"],
              ...(isTeacher
                ? [
                    ["requests", `Yêu cầu (${requests.length})`],
                    ["settings", "Cài đặt lớp"],
                  ]
                : []),
            ]}
            value={tab}
            onChange={(value) => {
              setTab(value);
              setQuery("");
            }}
          />
          {isTeacher && tab === "materials" && (
            <Button icon="plus" onClick={() => setModal("share")}>
              Chia sẻ học liệu
            </Button>
          )}
        </div>
        <section className="ws-panel">
          {tab === "materials" &&
            (materials.length ? (
              materials.map((item) => (
                <div className="ws-resource-row" key={item.id}>
                  <span className="ws-icon-tile green">
                    <Icon
                      name={
                        item.type === "FLASHCARD"
                          ? "cards"
                          : item.type === "MINDMAP"
                            ? "map"
                            : "file"
                      }
                    />
                  </span>
                  <div>
                    <strong>{item.name ?? item.title}</strong>
                    <small>{item.type}</small>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      navigate(
                        `${item.name ? "documents" : "content"}/${item.id}`,
                      )
                    }
                  >
                    Xem học liệu
                  </Button>
                  {isTeacher && (
                    <IconButton
                      icon="trash"
                      label={`Gỡ ${item.name ?? item.title}`}
                      onClick={() =>
                        confirm({
                          title: "Gỡ học liệu khỏi lớp?",
                          text: "Bản gốc vẫn được giữ trong tài liệu hoặc học liệu cá nhân.",
                          label: "Gỡ khỏi lớp",
                          action: () =>
                            update("classes", cls.id, {
                              materialIds: cls.materialIds.filter(
                                (key) => key !== item.id,
                              ),
                            }),
                        })
                      }
                    />
                  )}
                </div>
              ))
            ) : (
              <Empty title="Chưa có học liệu được chia sẻ" />
            ))}
          {tab === "assignments" && (
            <>
              <div className="ws-section-heading">
                <h2>Bài Quiz của lớp</h2>
                {isTeacher && (
                  <Button
                    icon="plus"
                    onClick={() => navigate(`assignments/new/${cls.id}`)}
                  >
                    Giao Quiz
                  </Button>
                )}
              </div>
              {data.assignments
                .filter(
                  (item) =>
                    item.classId === cls.id &&
                    (isTeacher || item.status === "PUBLISHED"),
                )
                .map((item) => (
                  <div className="ws-resource-row" key={item.id}>
                    <span className="ws-icon-tile orange">
                      <Icon name="quiz" />
                    </span>
                    <div>
                      <strong>{item.title}</strong>
                      <small>Hạn nộp: {dateLabel(item.dueAt)}</small>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => navigate(`assignments/${item.id}`)}
                    >
                      Xem bài giao
                    </Button>
                  </div>
                ))}
              {!data.assignments.some((item) => item.classId === cls.id) && (
                <Empty title="Chưa có bài Quiz" />
              )}
            </>
          )}
          {tab === "members" && (
            <>
              <Search
                value={query}
                onChange={setQuery}
                placeholder="Tìm tên hoặc email thành viên…"
              />
              <table className="ws-table">
                <thead>
                  <tr>
                    <th>Người học</th>
                    <th>Email</th>
                    <th>Vai trò</th>
                    {isTeacher && <th>Thao tác</th>}
                  </tr>
                </thead>
                <tbody>
                  {members.map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>{item.email}</td>
                      <td>
                        <Badge tone="gray">Người học</Badge>
                      </td>
                      {isTeacher && (
                        <td>
                          <IconButton
                            icon="trash"
                            label={`Xóa ${item.name} khỏi lớp`}
                            onClick={() =>
                              confirm({
                                title: "Xóa người học khỏi lớp?",
                                text: `${item.name} sẽ không còn quyền truy cập lớp mẫu này.`,
                                action: () => remove("members", item.id),
                              })
                            }
                          />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {!members.length && <Empty title="Không có thành viên phù hợp" />}
            </>
          )}
          {tab === "requests" &&
            (requests.length ? (
              requests.map((item) => (
                <div className="ws-resource-row" key={item.id}>
                  <span className="avatar">{item.name.slice(0, 1)}</span>
                  <div>
                    <strong>{item.name}</strong>
                    <small>{item.email}</small>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => processRequest(item, false)}
                  >
                    Từ chối
                  </Button>
                  <Button
                    icon="check"
                    onClick={() => processRequest(item, true)}
                  >
                    Duyệt
                  </Button>
                </div>
              ))
            ) : (
              <Empty title="Không có yêu cầu chờ duyệt" />
            ))}
          {tab === "settings" && (
            <div className="ws-form">
              <h2>Quản lý thông tin lớp</h2>
              <p className="ws-muted">
                Cập nhật mô tả lớp hoặc xóa lớp không còn sử dụng.
              </p>
              <div className="ws-actions">
                <Button
                  variant="secondary"
                  icon="edit"
                  onClick={() => setModal("edit")}
                >
                  Cập nhật lớp học
                </Button>
                <Button variant="danger" icon="trash" onClick={removeClass}>
                  Xóa lớp học
                </Button>
              </div>
            </div>
          )}
        </section>
        {!isTeacher && (
          <div className="ws-page-bottom">
            <Button variant="danger" onClick={removeClass}>
              Rời lớp học
            </Button>
          </div>
        )}
        {classModal}
      </>
    );
  }
  const classes = data.classes.filter(
    (item) =>
      (isTeacher || item.joined || item.pending) &&
      item.name.toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi")),
  );
  return (
    <>
      <PageHeading
        title="Lớp học của bạn"
        description={
          isTeacher
            ? "Tổ chức lớp học, chia sẻ kiến thức và đồng hành cùng người học."
            : "Kết nối với giáo viên và tiếp tục hành trình học tập cùng lớp."
        }
        action={
          <Button
            icon="plus"
            onClick={() => setModal(isTeacher ? "create" : "join")}
          >
            {isTeacher ? "Tạo lớp học" : "Tham gia lớp"}
          </Button>
        }
      />
      <div className="ws-toolbar">
        <Search
          value={query}
          onChange={setQuery}
          placeholder="Tìm kiếm lớp học…"
        />
        <span className="ws-muted">{classes.length} lớp học</span>
      </div>
      <div className="ws-card-grid">
        {classes.map((item) => (
          <article className="ws-class-card" key={item.id}>
            <div className={`ws-class-card-cover ${item.color}`}>
              <Badge tone="lime">{item.group}</Badge>
              <Icon name="book" size={44} />
            </div>
            <div className="ws-class-card-body">
              <h2>{item.name}</h2>
              <p>{item.description}</p>
              <div className="ws-class-meta">
                <span>
                  <Icon name="users" size={15} />
                  {
                    data.members.filter((member) => member.classId === item.id)
                      .length
                  }{" "}
                  thành viên
                </span>
                <span>{isTeacher ? item.code : item.teacher}</span>
              </div>
              <div className="ws-card-footer">
                {item.pending && !isTeacher ? (
                  <Badge tone="orange">Đang chờ duyệt</Badge>
                ) : (
                  <>
                    <Badge>Đang hoạt động</Badge>
                    <Button
                      variant="ghost"
                      icon="arrow"
                      onClick={() => navigate(`classes/${item.id}`)}
                    >
                      Vào lớp
                    </Button>
                  </>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
      {!classes.length && (
        <Empty
          title="Chưa có lớp học phù hợp"
          text={
            isTeacher
              ? "Tạo lớp đầu tiên để bắt đầu chia sẻ học liệu."
              : "Nhập mã lớp để gửi yêu cầu tham gia."
          }
        />
      )}
      {classModal}
    </>
  );
}
