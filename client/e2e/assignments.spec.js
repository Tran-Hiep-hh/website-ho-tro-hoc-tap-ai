import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("teacher assigns a frozen Quiz; student resumes, submits and teacher reviews real results", async ({ page, browser, request }) => {
  const base = "http://127.0.0.1:4015/api", password = "Assignment-browser-123";
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const student = await context.newPage();
  let source, teacherHeaders;
  try {
    const accounts = [];
    for (const [i, role] of ["TEACHER", "STUDENT", "STUDENT"].entries()) {
      const email = `${role}-${randomUUID()}@example.com`;
      const fullName = ["Giáo viên giao bài", "Học sinh làm Quiz", "Học sinh chưa làm"][i];
      expect((await request.post(`${base}/auth/register`, { data: { fullName, email, password, confirmPassword: password, role } })).status()).toBe(201);
      const login = await request.post(`${base}/auth/login`, { data: { email, password } });
      const result = await login.json();
      accounts.push({ email, headers: { Authorization: `Bearer ${result.accessToken}` }, user: result.user });
    }
    teacherHeaders = accounts[0].headers;
    const uploaded = await request.post(`${base}/documents`, { headers: teacherHeaders, multipart: { file: { name: "nguon-bai-giao.txt", mimeType: "text/plain", buffer: Buffer.from("Tài liệu cơ sở dữ liệu.") } } });
    source = (await uploaded.json()).document;
    const generated = await request.post(`${base}/quizzes/generate`, { headers: teacherHeaders, data: { title: "Quiz cho lớp", difficulty: "Dễ", sources: [source.id], quantity: 2 } });
    const saved = await request.post(`${base}/quizzes`, { headers: teacherHeaders, data: (await generated.json()).content });
    const quiz = (await saved.json()).content;
    const created = await request.post(`${base}/classes`, { headers: teacherHeaders, data: { name: "Lớp giao Quiz", group: "67PM2" } });
    const classId = (await created.json()).id;
    const cls = (await (await request.get(`${base}/classes`, { headers: teacherHeaders })).json()).classes.find((item) => item.id === classId);
    for (const account of accounts.slice(1)) {
      expect((await request.post(`${base}/classes/${classId}/join`, { headers: account.headers, data: { code: cls.code } })).status()).toBe(201);
      const req = (await (await request.get(`${base}/classes`, { headers: teacherHeaders })).json()).requests.find((item) => item.userId === String(account.user.userId));
      expect((await request.post(`${base}/classes/${classId}/requests/${req.id}`, { headers: teacherHeaders, data: { approve: true } })).status()).toBe(200);
    }
    for (const [target, account] of [[page, accounts[0]], [student, accounts[1]]]) {
      await target.goto("http://localhost:5175/#/login");
      await target.getByLabel("Email", { exact: true }).fill(account.email);
      await target.getByLabel("Mật khẩu", { exact: true }).fill(password);
      await target.getByRole("button", { name: "Đăng nhập", exact: true }).click();
      await expect(target.getByRole("link", { name: "Tài liệu của tôi", exact: true })).toBeVisible();
    }
    await page.goto("http://localhost:5175/#/assignments/new");
    await page.getByLabel("Tên bài giao").fill("Kiểm tra chương 1");
    const start = new Date(Date.now() - 60_000);
    await page.getByLabel("Thời gian mở bài").fill(new Date(start.getTime() - start.getTimezoneOffset() * 60_000).toISOString().slice(0, 16));
    await page.getByLabel("Số lần được làm").fill("1");
    await page.getByLabel("Thời gian làm bài (phút)", { exact: true }).fill("15");
    await page.getByLabel("Cho phép xem đáp án và giải thích sau khi nộp").uncheck();
    await page.getByLabel("Tôi đã kiểm duyệt nội dung Quiz trước khi giao cho lớp.").check();
    await page.getByRole("button", { name: "Công bố Quiz", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Kiểm tra chương 1", exact: true })).toBeVisible();
    const assignmentUrl = page.url();
    await expect(page.getByText("15 phút", { exact: true })).toBeVisible();
    // Subsequent edits must not alter the already assigned question set.
    expect((await request.put(`${base}/quizzes/${quiz.id}`, { headers: teacherHeaders, data: { ...quiz, title: "Quiz đã sửa", questions: quiz.questions.map((q) => ({ ...q, text: `Nội dung mới ${q.text}` })) } })).status()).toBe(200);
    await student.goto(assignmentUrl);
    await student.reload();
    await student.getByRole("button", { name: "Bắt đầu làm bài", exact: true }).click();
    await student.getByRole("button", { name: "Bắt đầu Quiz", exact: true }).click();
    await expect(student.getByText(/Còn 0h 1[45]p/)).toBeVisible();
    await expect(student.getByRole("heading", { name: "Khóa chính có vai trò nào trong bảng dữ liệu?", exact: true })).toBeVisible();
    await student.route("**/api/assignments/attempts/*/answers", (route) => route.abort(), { times: 1 });
    await student.getByRole("radio").nth(0).check();
    await expect(student.getByRole("alert")).toContainText("Chưa lưu lựa chọn mới");
    await expect(student.getByRole("button", { name: "Nộp bài", exact: true })).toBeDisabled();
    await student.getByRole("button", { name: "Thử lưu lại", exact: true }).click();
    await expect(student.getByText("Đã lưu 1 câu trả lời trên máy chủ", { exact: true })).toBeVisible();
    await student.reload();
    await student.getByRole("button", { name: "Tiếp tục Quiz", exact: true }).click();
    await expect(student.getByText(/Còn 0h 1[45]p/)).toBeVisible();
    await expect(student.getByRole("radio").nth(0)).toBeChecked();
    await student.getByRole("button", { name: "Nộp bài", exact: true }).click();
    await student.getByRole("dialog").getByRole("button", { name: "Nộp bài", exact: true }).click();
    await expect(student.locator(".ws-score-ring strong")).toHaveText("5/10");
    await expect(student.getByText("Giáo viên chưa cho phép xem đáp án và giải thích của bài giao này.")).toBeVisible();
    await student.reload();
    await expect(student.locator(".ws-score-ring strong")).toHaveText("5/10");
    await student.getByRole("button", { name: "Về bài Quiz", exact: true }).click();
    await expect(student.getByRole("button", { name: "Đã hết lượt làm", exact: true })).toBeDisabled();
    await page.reload();
    await page.getByRole("button", { name: "Xem kết quả", exact: true }).click();
    const submitted = page.getByRole("row").filter({ hasText: "Học sinh làm Quiz" });
    await expect(submitted).toContainText("Đã hoàn thành");
    await expect(submitted).toContainText("5/10");
    await expect(page.getByRole("row").filter({ hasText: "Học sinh chưa làm" })).toContainText("Chưa làm");
    await submitted.getByRole("button", { name: "Xem bài làm", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Chi tiết câu trả lời", exact: true })).toBeVisible();
    await expect(page.locator(".ws-score-ring strong")).toHaveText("5/10");
    await page.goto("http://localhost:5175/#/home");
    await expect(page.locator(".ws-stat-link").filter({ hasText: "Học sinh trong các lớp" }).locator("strong")).toHaveText("2");
    await expect(page.locator(".ws-stat-link").filter({ hasText: "Quiz đã công bố" }).locator("strong")).toHaveText("1");
    const recent = page.locator("section.ws-panel").filter({ has: page.getByRole("heading", { name: "Bài nộp gần đây", exact: true }) });
    await expect(recent).toContainText("Kiểm tra chương 1");
    await expect(recent).toContainText("5/10");
    await student.goto("http://localhost:5175/#/home");
    await expect(student.locator(".ws-stat-link").filter({ hasText: "Điểm Quiz trung bình" }).locator("strong")).toHaveText("5/10");
    await expect(student.locator("section.ws-panel").filter({ has: student.getByRole("heading", { name: "Quiz sắp đến hạn", exact: true }) })).not.toContainText("Kiểm tra chương 1");
  } finally {
    if (source) await request.delete(`${base}/documents/${source.id}`, { headers: teacherHeaders }).catch(() => {});
    await context.close();
  }
});
