import { useState } from "react";
import { apiRequest } from "../lib/api.js";
import { viewDocument } from "../lib/documentViewer.js";
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

export default function ClassesPage({ classId, initialTab }) {
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
    personalDocuments,
    accessibleDocuments, isPreview, reloadClasses, classesLoading, classesError, reloadAssignments,
  } = useWorkspace();
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState(null);
  const [tab, setTab] = useState(initialTab === "requests" && isTeacher ? "requests" : "materials");
  const [joinMatch, setJoinMatch] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  function cancelJoin(item) {
    confirm({
      title: "Hủy yêu cầu tham gia?",
      text: `Hủy yêu cầu vào lớp “${item.name}”? Bạn vẫn có thể gửi yêu cầu lại bằng mã lớp.`,
      label: "Hủy yêu cầu",
      action: async () => {
        if (isPreview) { update("classes", item.id, { pending: false }); notify("Đã hủy yêu cầu tham gia."); return; }
        setBusy(true);
        try {
          await apiRequest(`/classes/${item.id}/requests/${item.pendingRequestId}`, { method: "DELETE", body: {} });
          notify("Đã hủy yêu cầu tham gia. Bạn có thể gửi lại khi cần.");
        } catch (err) { notify(err.message); }
        finally { await reloadClasses(); setBusy(false); }
      },
    });
  }
  async function mutate(method, path, body = {}) {
    setBusy(true); setError("");
    try {
      const result = await apiRequest(`/classes${path}`, { method, body });
      await reloadClasses();
      notify("Đã cập nhật lớp học.");
      return result;
    } catch (err) { setError(err.message); notify(err.message); return null; }
    finally { setBusy(false); }
  }
  const cls = data.classes.find(
    (item) => item.id === classId && (isTeacher || item.joined),
  );
  const requests = data.requests.filter((item) => item.classId === classId);
  async function saveClass(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (!values.name.trim()) return;
    if (!isPreview) {
      const result = await mutate(modal === "edit" ? "PUT" : "POST", modal === "edit" ? `/${cls.id}` : "", values);
      if (result) { setModal(null); if (result.id) navigate(`classes/${result.id}`); }
      return;
    }
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
    if (!isPreview) return mutate("POST", `/${cls.id}/requests/${request.id}`, { approve });
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
      text: isTeacher ? "Thành viên sẽ không còn truy cập được lớp. Tài liệu gốc của bạn vẫn được giữ lại." : "Bạn sẽ mất quyền xem tài liệu lớp và cần xin tham gia lại nếu muốn quay lại.",
      action: async () => {
        if (!isPreview) {
          if (await mutate(isTeacher ? "DELETE" : "POST", `/${cls.id}${isTeacher ? "" : "/leave"}`)) navigate("classes");
          return;
        }
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
      {error && modal !== "join" && <p className="ws-inline-error" role="alert">{error}</p>}
      {modal === "join" ? (
        <form
          className="ws-form"
          onSubmit={async (event) => {
            event.preventDefault();
            const code = new FormData(event.currentTarget)
              .get("code")
              .trim()
              .toUpperCase();
            if (!isPreview) {
              setBusy(true); setError(""); setJoinMatch(null);
              try {
                const result = await apiRequest("/classes/lookup", { method: "POST", body: { code } });
                const existing = data.classes.find((item) => item.id === result.classroom.id);
                if (existing?.joined || existing?.pending) setError("Bạn đã tham gia hoặc đang chờ duyệt lớp này.");
                else setJoinMatch(result.classroom);
              } catch (err) { setError(err.message); }
              finally { setBusy(false); }
              return;
            }
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
            Nhập mã lớp do giáo viên cung cấp. {isPreview && <>Bạn có thể thử mã mẫu <strong>CTDL26</strong>.</>}
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
                disabled={busy}
                onClick={async () => {
                  if (!isPreview) {
                    if (await mutate("POST", `/${joinMatch.id}/join`, { code: joinMatch.code })) { setModal(null); setJoinMatch(null); }
                    return;
                  }
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
              <Button type="submit" disabled={busy}>Tìm lớp</Button>
            )}
          </div>
        </form>
      ) : modal === "share" ? (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const selected = new FormData(event.currentTarget).getAll(
              "material",
            );
            if (!selected.length) { setError("Chọn ít nhất một tài liệu chưa được chia sẻ."); return; }
            if (!isPreview) {
              if (await mutate("POST", `/${cls.id}/materials`, { documentIds: selected })) setModal(null);
              return;
            }
            update("classes", cls.id, {
              materialIds: [...new Set([...cls.materialIds, ...selected])],
            });
            setModal(null);
            notify("Đã chia sẻ học liệu trong lớp mẫu.");
          }}
        >
          <p className="ws-muted">
            Chọn tài liệu PDF, DOCX hoặc TXT của bạn để chia sẻ cho lớp.
          </p>
          <div className="ws-checkbox-list">
            {[
              ...personalDocuments.filter((item) => ["READY", "FAILED"].includes(item.status)),
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
            <Button type="submit" disabled={busy}>Chia sẻ học liệu</Button>
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
              maxLength={100}
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
            <Button type="submit" disabled={busy}>
              {modal === "edit" ? "Lưu thay đổi" : "Tạo lớp học"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
  if (classesLoading) return <Empty title="Đang tải lớp học…" />;
  if (classesError) return <Empty title="Không tải được lớp học" text={classesError} action={<Button onClick={reloadClasses}>Thử lại</Button>} />;
  if (classId && !cls)
    return (
      <Empty
        title="Không tìm thấy lớp học"
        text="Lớp không tồn tại hoặc bạn chưa được duyệt tham gia."
        action={<Button onClick={() => navigate("classes")}>Về lớp học</Button>}
      />
    );
  if (cls) {
    const materials = accessibleDocuments.filter((item) =>
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
          {!isPreview && <Button variant="secondary" disabled={busy} onClick={() => { reloadClasses(); reloadAssignments(); }}>Làm mới</Button>}
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
                    onClick={() => viewDocument(item, { isPreview, navigate, notify })}
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
                          action: () => !isPreview ? mutate("DELETE", `/${cls.id}/materials/${item.id}`) :
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
                                text: `${item.name} sẽ không còn quyền truy cập lớp này.`,
                                action: () => !isPreview ? mutate("DELETE", `/${cls.id}/members/${item.id}`) : remove("members", item.id),
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
                    disabled={busy}
                  >
                    Từ chối
                  </Button>
                  <Button
                    icon="check"
                    onClick={() => processRequest(item, true)}
                    disabled={busy}
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
        {!isPreview && <Button variant="secondary" onClick={reloadClasses}>Làm mới</Button>}
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
                  <>
                    <Badge tone="orange">Đang chờ duyệt</Badge>
                    <Button variant="secondary" disabled={busy} onClick={() => cancelJoin(item)}>Hủy yêu cầu</Button>
                  </>
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
