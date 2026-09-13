import { test, expect } from "@playwright/test";

test("assignment availability changes with time and separates exhausted from resumable attempts", async ({ page }) => {
  const now = new Date("2026-09-13T08:00:00+07:00");
  await page.clock.install({ time: now });
  const base = { classId: "1", status: "PUBLISHED", maxAttempts: 1, questionCount: 2, questions: [], startAt: new Date(+now - 60000).toISOString(), dueAt: new Date(+now + 3600000).toISOString() };
  const assignments = [
    { ...base, id: "1", title: "Bài sắp mở", startAt: new Date(+now + 10000).toISOString(), dueAt: new Date(+now + 20000).toISOString() },
    { ...base, id: "2", title: "Bài hết lượt", attemptsUsed: 1 },
    { ...base, id: "3", title: "Bài đang làm", attemptsUsed: 1, inProgress: true },
  ];
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = {
      "/api/auth/refresh": { user: { userId: "2", fullName: "Học sinh", role: "STUDENT" }, accessToken: "ui-test" },
      "/api/documents": { documents: [] }, "/api/quizzes": { contents: [] },
      "/api/study-materials": { contents: [] }, "/api/quizzes/attempts": { attempts: [] },
      "/api/classes": { classes: [{ id: "1", name: "Lớp kiểm tra", joined: true, materialIds: [] }], members: [], requests: [], documents: [] },
      "/api/assignments": { assignments, attempts: [], classAttempts: [] },
      "/api/notifications": { notifications: [] },
    }[path];
    await route.fulfill({ status: body ? 200 : 404, json: { success: Boolean(body), ...body } });
  });
  await page.goto("/#/assignments");
  const row = (title) => page.getByRole("row").filter({ hasText: title });
  await expect(row("Bài sắp mở")).toContainText("Sắp mở");
  await expect(row("Bài hết lượt")).toContainText("Đã hết lượt làm");
  await expect(row("Bài đang làm")).toContainText("Đang làm");
  await page.getByRole("button", { name: "Hết lượt", exact: true }).click();
  await expect(row("Bài hết lượt")).toBeVisible();
  await expect(row("Bài đang làm")).toHaveCount(0);
  await page.getByRole("button", { name: "Tất cả", exact: true }).click();
  await row("Bài sắp mở").getByRole("button", { name: "Chi tiết" }).click();
  await expect(page.getByRole("button", { name: "Sắp mở", exact: true })).toBeDisabled();
  await page.clock.fastForward(10000);
  await expect(page.getByRole("button", { name: "Bắt đầu làm bài", exact: true })).toBeEnabled();
  await page.clock.fastForward(10000);
  await expect(page.getByRole("button", { name: "Đã kết thúc", exact: true })).toBeDisabled();
});
