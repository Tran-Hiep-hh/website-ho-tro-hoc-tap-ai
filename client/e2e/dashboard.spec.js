import { test, expect } from "@playwright/test";

async function setup(page, role, state = {}) {
  const at = (hours) => new Date(Date.now() + hours * 3600000).toISOString();
  const user = { userId: "1", fullName: "Người dùng tổng quan", email: "overview@example.com", role };
  const classes = [
    { id: "11", name: "Lớp thứ nhất", group: "A", color: "green", joined: true, teacher: "Giáo viên", materialIds: ["90"] },
    { id: "12", name: "Lớp thứ hai", group: "B", color: "green", joined: role === "TEACHER", pending: role !== "TEACHER", teacher: "Giáo viên", materialIds: [] },
  ];
  const assignment = (id, title, hours, status = "PUBLISHED", attemptsUsed = 0) => ({ id, title, classId: "11", dueAt: at(hours), startAt: at(-4), status, maxAttempts: 1, attemptsUsed, questions: [] });
  const attempt = (id, title, score, hours, assignmentId = null) => ({ id, title, score, date: at(hours), assignmentId, status: "SUBMITTED", name: "Học sinh", questions: [], answers: [], showAnswers: true });
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/documents" && state.failDocuments) { await route.fulfill({ status: 500, json: { message: "Không thể tải tài liệu thử nghiệm" } }); return; }
    const result = {
      "/api/auth/refresh": { user, accessToken: "dashboard-test-token" },
      "/api/documents": { documents: [{ id: "1", ownerId: "1", name: "Tài liệu của tôi", date: at(-1), type: "TXT", status: "READY" }] },
      "/api/quizzes": { contents: [
        { id: "20", title: "Quiz mới nhất", type: "QUIZ", createdAt: at(-1), questions: [], sources: [] },
        { id: "21", title: "Quiz cũ", type: "QUIZ", createdAt: at(-72), questions: [], sources: [] },
      ] },
      "/api/study-materials": { contents: [{ id: "22", title: "Thẻ ôn tập", type: "FLASHCARD", createdAt: at(-24), cards: [{ front: "A", back: "a" }, { front: "B", back: "b" }, { front: "C", back: "c" }], learned: [0], sources: [] }] },
      "/api/quizzes/attempts": { attempts: [attempt("31", "Kết quả cũ", 60, -4)] },
      "/api/classes": { classes, members: [{ id: "41", userId: "2", classId: "11", name: "An" }, { id: "42", userId: "2", classId: "12", name: "An" }, { id: "43", userId: "3", classId: "11", name: "Bình" }], requests: role === "TEACHER" ? [{ id: "51", classId: "12", name: "Học sinh xin vào lớp" }] : [], documents: [{ id: "90", ownerId: "99", name: "Tài liệu giáo viên", type: "TXT" }] },
      "/api/assignments": { assignments: [assignment("61", "Hạn xa", 3), assignment("62", "Đã hết hạn", -1), assignment("63", "Bài nháp", 1, "DRAFT"), assignment("64", "Hạn gần", 1), assignment("65", "Bài đã hủy", 1, "CANCELLED"), assignment("66", "Bài hết lượt", 0.5, "PUBLISHED", 1)], attempts: [attempt("32", "Kết quả mới", 80, 0, "66")], classAttempts: [attempt("33", "Bài nộp cũ", 50, -2, "61"), attempt("34", "Bài nộp mới", 90, 0, "64")] },
      "/api/notifications": { notifications: [] },
    }[path];
    await route.fulfill({ status: result ? 200 : 404, json: { success: Boolean(result), ...result } });
  });
  await page.goto("/#/home");
}
const panel = (page, title) => page.locator("section.ws-panel").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
const stat = (page, title) => page.locator(".ws-stat-link").filter({ has: page.getByText(title, { exact: true }) }).locator("strong");

test("Student overview derives counts, averages, deadlines and Flashcard progress from API data", async ({ page }) => {
  await setup(page, "STUDENT");
  await expect(stat(page, "Tài liệu của tôi")).toHaveText("1");
  await expect(stat(page, "Học liệu đã tạo")).toHaveText("3");
  await expect(stat(page, "Lớp đã tham gia")).toHaveText("1");
  await expect(stat(page, "Điểm Quiz trung bình")).toHaveText("7/10");
  await expect(panel(page, "Học liệu gần đây").locator("strong")).toHaveText(["Quiz mới nhất", "Thẻ ôn tập", "Quiz cũ"]);
  await expect(panel(page, "Quiz sắp đến hạn").locator("strong")).toHaveText(["Hạn gần", "Hạn xa"]);
  await expect(panel(page, "Kết quả gần đây").locator("strong")).toHaveText(["Kết quả mới", "Kết quả cũ"]);
  await expect(panel(page, "Tiến độ Flashcard")).toContainText("1/3 thẻ đã nhớ");
  await expect(panel(page, "Tiến độ Flashcard").getByRole("link")).toHaveAttribute("href", "#/content/22");
  await expect(panel(page, "Quiz sắp đến hạn").getByRole("link").filter({ hasText: "Hạn gần" })).toHaveAttribute("href", "#/assignments/64");
});
test("Teacher overview counts unique students and displays pending requests and recent submissions", async ({ page }) => {
  await setup(page, "TEACHER");
  await expect(stat(page, "Lớp đang quản lý")).toHaveText("2");
  await expect(stat(page, "Học sinh trong các lớp")).toHaveText("2");
  await expect(stat(page, "Yêu cầu chờ duyệt")).toHaveText("1");
  await expect(stat(page, "Quiz đã công bố")).toHaveText("4");
  await expect(panel(page, "Bài nộp gần đây").locator("strong")).toHaveText(["Bài nộp mới", "Bài nộp cũ"]);
  await expect(panel(page, "Yêu cầu tham gia cần duyệt").getByRole("link")).toHaveAttribute("href", "#/classes/12/requests");
  await panel(page, "Yêu cầu tham gia cần duyệt").getByRole("link").click();
  await expect(page.getByRole("button", { name: "Yêu cầu (1)", exact: true })).toHaveAttribute("aria-pressed", "true");
});
test("Failed overview fetch shows an error instead of misleading zero statistics and supports retry", async ({ page }) => {
  const state = { failDocuments: true };
  await setup(page, "STUDENT", state);
  await expect(page.getByRole("heading", { name: "Không tải được số liệu tổng quan" })).toBeVisible();
  await expect(page.locator(".ws-stat-link")).toHaveCount(0);
  state.failDocuments = false;
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(stat(page, "Tài liệu của tôi")).toHaveText("1");
  await page.getByRole("button", { name: "Làm mới số liệu", exact: true }).click();
  await expect(stat(page, "Điểm Quiz trung bình")).toHaveText("7/10");
});
