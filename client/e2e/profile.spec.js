import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("Profile name persists; password change signs out all sessions and accepts only the new password", async ({ page, browser, request }) => {
  const email = `profile-${randomUUID()}@example.com`, password = "Profile-browser-123", next = "Profile-browser-456";
  expect((await request.post("http://127.0.0.1:4015/api/auth/register", { data: { fullName: "Tên ban đầu", email, password, confirmPassword: password, role: "STUDENT" } })).status()).toBe(201);
  const otherContext = await browser.newContext(); const other = await otherContext.newPage();
  try {
    for (const target of [page, other]) {
      await target.goto("http://localhost:5175/#/login");
      await target.getByLabel("Email", { exact: true }).fill(email);
      await target.getByLabel("Mật khẩu", { exact: true }).fill(password);
      await target.getByRole("button", { name: "Đăng nhập", exact: true }).click();
      await expect(target.getByRole("heading", { name: "Xin chào, Tên ban đầu." })).toBeVisible();
    }
    await page.getByRole("link", { name: "Mở hồ sơ cá nhân", exact: true }).click();
    await expect(page.getByLabel("Địa chỉ email")).toHaveAttribute("readonly", "");
    await page.getByLabel("Họ và tên", { exact: true }).fill("Trần Minh Anh");
    await page.getByRole("button", { name: "Lưu thông tin", exact: true }).click();
    await expect(page.locator(".ws-sidebar-user")).toContainText("Trần Minh Anh");
    await page.reload();
    await expect(page.getByLabel("Họ và tên", { exact: true })).toHaveValue("Trần Minh Anh");
    await page.getByRole("button", { name: "Đổi mật khẩu", exact: true }).click();
    await page.getByLabel("Mật khẩu hiện tại", { exact: true }).fill("incorrect-password");
    await page.getByLabel("Mật khẩu mới", { exact: true }).fill(next);
    await page.getByLabel("Xác nhận mật khẩu mới", { exact: true }).fill(next);
    await page.locator('button[type="submit"]').click();
    await expect(page.getByRole("alert")).toContainText("Mật khẩu hiện tại không chính xác");
    await page.getByLabel("Mật khẩu hiện tại", { exact: true }).fill(password);
    await page.locator('button[type="submit"]').click();
    await expect(page.getByRole("heading", { name: "Đăng nhập vào StudyAI" })).toBeVisible();
    await expect(page.getByRole("status")).toContainText("Đã đổi mật khẩu");
    await other.reload();
    await expect(other.getByRole("heading", { name: "Đăng nhập vào StudyAI" })).toBeVisible();
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Email hoặc mật khẩu không chính xác");
    await page.getByLabel("Mật khẩu", { exact: true }).fill(next);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Xin chào, Trần Minh Anh." })).toBeVisible();
  } finally { await otherContext.close(); }
});
