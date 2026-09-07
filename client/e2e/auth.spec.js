import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

const password = "Study-browser-123";

for (const role of ["Người học", "Giáo viên"]) {
  test(`${role}: register, sign in, reload, sign out and reject back navigation`, async ({ page, context }, testInfo) => {
    const email = `browser-${randomUUID()}@example.com`;
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto("/#/register");
    await expect(page.getByRole("heading", { name: "Tạo tài khoản của bạn" })).toBeVisible();
    await page.getByRole("radio", { name: new RegExp(role) }).check();
    await page.getByLabel("Họ và tên", { exact: true }).fill("Nguyễn Minh An");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
    await page.getByLabel("Xác nhận mật khẩu", { exact: true }).fill("does-not-match");
    await page.getByRole("button", { name: "Tạo tài khoản", exact: true }).click();
    await expect(page.getByText("Mật khẩu xác nhận không khớp.", { exact: true })).toBeVisible();
    await page.getByLabel("Xác nhận mật khẩu", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Tạo tài khoản", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Đăng nhập vào StudyAI" })).toBeVisible();
    await expect(page.getByRole("status")).toContainText("Tạo tài khoản thành công");
    await expect(page.getByLabel("Email", { exact: true })).toHaveValue(email);
    await page.getByLabel("Mật khẩu", { exact: true }).fill("wrong-password");
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Email hoặc mật khẩu không chính xác");
    await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Hiện mật khẩu", exact: true }).click();
    await expect(page.getByLabel("Mật khẩu", { exact: true })).toHaveAttribute("type", "text");
    await page.screenshot({ path: testInfo.outputPath("login-desktop.png"), fullPage: true });
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Xin chào, Nguyễn Minh An." })).toBeVisible();
    await expect(page.locator("dd").last()).toHaveText(role);
    expect(await page.evaluate(() => localStorage.length)).toBe(0);
    expect(await page.evaluate(() => document.cookie)).not.toContain("study_ai_refresh");
    expect((await context.cookies()).find((cookie) => cookie.name === "study_ai_refresh")?.httpOnly).toBe(true);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Xin chào, Nguyễn Minh An." })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("home-desktop.png"), fullPage: true });
    const secondTab = await context.newPage();
    await secondTab.goto("/");
    await expect(secondTab.getByRole("heading", { name: "Xin chào, Nguyễn Minh An." })).toBeVisible();
    await Promise.all([page.reload(), secondTab.reload()]);
    await expect(page.getByRole("heading", { name: "Xin chào, Nguyễn Minh An." })).toBeVisible();
    await expect(secondTab.getByRole("heading", { name: "Xin chào, Nguyễn Minh An." })).toBeVisible();
    await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Đăng nhập vào StudyAI" })).toBeVisible();
    await page.goto("/#/home");
    await expect(page.getByRole("heading", { name: "Đăng nhập vào StudyAI" })).toBeVisible();
    await secondTab.reload();
    await expect(secondTab.getByRole("heading", { name: "Đăng nhập vào StudyAI" })).toBeVisible();
    expect(pageErrors).toEqual([]);
  });
}

test("desktop registration fits a laptop screen and shows duplicate email errors", async ({ page }, testInfo) => {
  const email = `desktop-${randomUUID()}@example.com`;
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto("/#/register");
  await expect(page.getByRole("heading", { name: "Tạo tài khoản của bạn" })).toBeVisible();
  const fields = { fullName: "Trần Hà", email, password, confirmPassword: password };
  for (const [name, value] of Object.entries(fields)) await page.locator(`#${name}`).fill(value);
  await page.screenshot({ path: testInfo.outputPath("register-desktop.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Tạo tài khoản", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Đăng nhập vào StudyAI" })).toBeVisible();
  await page.getByRole("link", { name: "Tạo tài khoản" }).click();
  for (const [name, value] of Object.entries(fields)) await page.locator(`#${name}`).fill(value);
  await page.getByRole("button", { name: "Tạo tài khoản", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Email này đã được sử dụng");
  await expect(page.locator("#email")).toHaveAttribute("aria-invalid", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
