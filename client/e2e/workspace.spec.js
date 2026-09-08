import { test, expect } from "@playwright/test";

test("student documents stay personal and class files remain read-only", async ({ page }) => {
  await page.goto("/#/preview/student/documents");
  await expect(page.getByRole("button", { name: "Xem Ghi chú ôn tập SQL.txt", exact: true })).toBeVisible();
  await expect(page.getByText("Cơ sở dữ liệu — Chương 2.pdf", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Thêm tài liệu", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "ban-ca-nhan.txt", mimeType: "text/plain", buffer: Buffer.from("Ghi chú cá nhân") });
  await page.getByRole("button", { name: "Thêm vào bản xem trước" }).click();
  await page.getByRole("button", { name: "Xóa ban-ca-nhan.txt", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Xóa tài liệu", exact: true }).click();
  await expect(page.getByRole("button", { name: "Xem ban-ca-nhan.txt", exact: true })).toHaveCount(0);
  await page.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("link", { name: "Học liệu", exact: true }).click();
  await page.getByRole("button", { name: "Tài liệu lớp học", exact: true }).click();
  const shared = page.locator("article").filter({ has: page.getByRole("heading", { name: "Cơ sở dữ liệu — Chương 2.pdf", exact: true }) });
  await shared.getByRole("button", { name: "Xem tài liệu" }).click();
  await expect(page.getByRole("button", { name: "Xóa tài liệu", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Tải văn bản xem trước" })).toBeVisible();
  await page.getByRole("link", { name: "Mở hồ sơ cá nhân", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Hồ sơ cá nhân", exact: true })).toBeVisible();
  await page.goto("/#/preview/student/documents/doc-4");
  await expect(page.getByRole("heading", { name: "Bài giảng cấu trúc dữ liệu.pdf", exact: true })).toHaveCount(0);
});

test("real-account navigation uses the auth API contract and protects signed-out pages", async ({ page }) => {
  let signedIn = false;
  await page.route("**/api/documents", (route) => route.fulfill({ json: { success: true, documents: [] } }));
  const user = { userId: "123", fullName: "Nguyễn Minh An", email: "an@example.com", role: "TEACHER" };
  await page.route("**/api/auth/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/login")) {
      expect(route.request().postDataJSON()).toEqual({ email: user.email, password: "Study-test-123" });
      signedIn = true;
    }
    if (path.endsWith("/logout")) signedIn = false;
    const allowed = signedIn || path.endsWith("/logout");
    await route.fulfill({ status: allowed ? 200 : 401, contentType: "application/json", body: JSON.stringify(allowed ? { success: true, user, accessToken: "ui-contract-test-token" } : { success: false, message: "Phiên đăng nhập hết hạn." }) });
  });
  await page.goto("/#/login");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill("Study-test-123");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/#\/home$/);
  await expect(page.getByRole("heading", { name: `Xin chào, ${user.fullName}.` })).toBeVisible();
  await page.getByRole("link", { name: "Hồ sơ cá nhân", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Hồ sơ cá nhân", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Hồ sơ cá nhân", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Đăng nhập vào StudyAI" })).toBeVisible();
  await page.goto("/#/home");
  await expect(page.getByRole("heading", { name: "Đăng nhập vào StudyAI" })).toBeVisible();
});

for (const role of ["teacher", "student"]) {
  test(`${role}: all desktop screens render without a backend`, async ({ page }, testInfo) => {
    const errors = [];
    const apiCalls = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => { if (request.url().includes("/api/")) apiCalls.push(request.url()); });
    const routes = ["home", "documents", "documents/doc-1", "contents", "generate", "content/quiz-1", "content/flash-1", "content/map-1", "classes", "classes/class-1", "assignments", "assignments/assignment-1", "results", "profile", "notifications"];
    for (const route of routes) {
      await page.goto(`/#/preview/${role}/${route}`);
      await expect(page.locator("main h1").first()).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Điều hướng chính" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), route).toBe(true);
      if (["home", "classes", "contents", "results", "content/map-1"].includes(route)) await page.screenshot({ path: testInfo.outputPath(`${route.replaceAll("/", "-")}.png`), fullPage: true });
    }
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(`/#/preview/${role}/home`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(errors).toEqual([]);
    expect(apiCalls).toEqual([]);
  });
}

test("document selection, sample generation and editing form a connected flow", async ({ page }) => {
  await page.goto("/#/preview/teacher/documents");
  await page.getByRole("button", { name: "Thêm tài liệu", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "tai-lieu-thu.txt", mimeType: "text/plain", buffer: Buffer.from("Nội dung học tập thử nghiệm.") });
  await page.getByRole("button", { name: "Thêm vào bản xem trước" }).click();
  await page.getByRole("button", { name: "Tạo học liệu từ tai-lieu-thu.txt", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Tạo học liệu mới" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /tai-lieu-thu/ })).toBeChecked();
  await page.getByLabel("Tên học liệu / Chủ đề").fill("Quiz của tôi");
  await page.getByRole("button", { name: "Xem kết quả mẫu" }).click();
  await page.getByRole("button", { name: "Lưu vào thư viện" }).click();
  await expect(page.getByRole("heading", { name: "Quiz của tôi", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Chỉnh sửa", exact: true }).click();
  await page.getByLabel("Tên học liệu", { exact: true }).fill("Quiz đã chỉnh sửa");
  await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Quiz đã chỉnh sửa" })).toBeVisible();
});

test("teacher can create a class, publish an assignment and review requests", async ({ page }) => {
  await page.goto("/#/preview/teacher/classes");
  await page.getByRole("button", { name: "Tạo lớp học", exact: true }).click();
  await page.getByLabel("Tên lớp học", { exact: true }).fill("Lớp thử giao diện");
  await page.getByLabel("Nhóm / Mã học phần").fill("67PM3");
  await page.getByRole("dialog").getByRole("button", { name: "Tạo lớp học", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Lớp thử giao diện" })).toBeVisible();
  await page.getByRole("button", { name: "Bài Quiz", exact: true }).click();
  await page.getByRole("button", { name: "Giao Quiz", exact: true }).click();
  await page.getByLabel("Tên bài giao").fill("Bài giao thử");
  await page.getByRole("checkbox", { name: /Tôi đã kiểm duyệt/ }).check();
  await page.getByRole("button", { name: "Công bố Quiz" }).click();
  await expect(page.getByRole("heading", { name: "Bài giao thử", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Lớp học", exact: false }).first().click();
  await page.locator(".ws-class-card").filter({ has: page.getByRole("heading", { name: "Cơ sở dữ liệu", exact: true }) }).getByRole("button", { name: "Vào lớp" }).click();
  await page.getByRole("button", { name: "Yêu cầu (1)" }).click();
  await page.getByRole("button", { name: "Duyệt", exact: true }).click();
  await page.getByRole("button", { name: "Thành viên", exact: true }).click();
  await expect(page.getByRole("cell", { name: "Phạm Gia Huy", exact: true })).toBeVisible();
});

test("student requests membership and completes an assigned Quiz", async ({ page }) => {
  await page.goto("/#/preview/student/classes");
  await page.getByRole("button", { name: "Tham gia lớp", exact: true }).click();
  await page.getByLabel("Mã tham gia").fill("CTDL26");
  await page.getByRole("button", { name: "Tìm lớp", exact: true }).click();
  await page.getByRole("button", { name: "Gửi yêu cầu tham gia" }).click();
  await expect(page.getByText("Đang chờ duyệt", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Bài Quiz được giao", exact: true }).click();
  await page.locator("tr").filter({ hasText: "Ôn tập chương 2: Mô hình quan hệ" }).getByRole("button", { name: "Chi tiết" }).click();
  await page.getByRole("button", { name: "Bắt đầu làm bài" }).click();
  await page.getByRole("button", { name: "Bắt đầu Quiz" }).click();
  for (const [index, answer] of [1, 2, 0, 3, 1].entries()) {
    await page.getByRole("radio").nth(answer).check();
    if (index < 4) await page.getByRole("button", { name: "Câu tiếp" }).click();
  }
  await page.getByRole("button", { name: "Nộp bài", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Nộp bài", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Kết quả bài Quiz" })).toBeVisible();
  await expect(page.locator(".ws-score-ring strong")).toHaveText("10/10");
  await page.getByRole("button", { name: "Xem lịch sử", exact: true }).click();
  await expect(page.getByRole("cell", { name: "10/10", exact: true })).toBeVisible();
});

test("flashcards record progress, mindmap edits export a PNG and notifications update", async ({ page }) => {
  await page.goto("/#/preview/student/content/flash-1");
  await page.getByRole("button", { name: "Bắt đầu ôn tập" }).click();
  await page.getByRole("button", { name: "Lật thẻ ghi nhớ" }).click();
  await page.getByRole("button", { name: "Đã nhớ", exact: true }).click();
  await expect(page.getByText("1/6 thẻ đã nhớ", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Học liệu", exact: true }).click();
  await page.locator(".ws-learning-card").filter({ has: page.getByRole("heading", { name: "Tổng quan cơ sở dữ liệu" }) }).getByRole("button", { name: "Mở học liệu" }).click();
  await page.getByRole("button", { name: "Thêm nhánh con", exact: true }).click();
  await page.getByLabel("Nội dung nút").fill("Nhánh kiến thức mới");
  await page.getByRole("button", { name: "Lưu Mindmap" }).click();
  await expect(page.getByRole("button", { name: "Nút Nhánh kiến thức mới", exact: true })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Xuất PNG", exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/\.png$/);
  await page.getByRole("link", { name: /Thông báo, \d chưa đọc/ }).click();
  await page.getByRole("button", { name: "Đánh dấu tất cả đã đọc" }).click();
  await page.getByRole("button", { name: "Chưa đọc (0)", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Bạn đã xem hết thông báo" })).toBeVisible();
});
