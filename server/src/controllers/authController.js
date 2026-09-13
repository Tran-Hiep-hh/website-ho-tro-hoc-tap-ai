import { env } from "../config/env.js";
import { bearerToken } from "../middlewares/auth.js";

const cookieName = "study_ai_refresh";
const cookieOptions = { httpOnly: true, secure: env.nodeEnv === "production", sameSite: "lax", path: "/api/auth" };

function getRefreshCookie(request) {
  const value = (request.headers.cookie ?? "").split(";")
    .map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`));
  try { return value ? decodeURIComponent(value.slice(cookieName.length + 1)) : undefined; }
  catch { return undefined; }
}

function sendSession(response, session) {
  response.cookie(cookieName, session.refreshToken, { ...cookieOptions, expires: session.expiresAt });
  response.json({ success: true, user: session.user, accessToken: session.accessToken });
}

export function createAuthController(service) {
  return {
    async register(request, response) {
      const user = await service.register(request.body);
      response.status(201).json({ success: true, message: "Đăng ký thành công. Bạn có thể đăng nhập.", user });
    },
    async login(request, response) {
      sendSession(response, await service.login(request.body));
    },
    async refresh(request, response) {
      sendSession(response, await service.refresh(getRefreshCookie(request)));
    },
    async logout(request, response) {
      await service.logout(getRefreshCookie(request), bearerToken(request));
      response.clearCookie(cookieName, cookieOptions);
      response.json({ success: true, message: "Đã đăng xuất." });
    },
    me(request, response) {
      response.json({ success: true, user: request.user });
    },
    async updateProfile(request, response) {
      response.json({ success: true, user: await service.updateProfile(request.user.userId, request.body) });
    },
    async changePassword(request, response) {
      await service.changePassword(request.user.userId, request.body);
      response.clearCookie(cookieName, cookieOptions);
      response.json({ success: true, message: "Đã đổi mật khẩu. Vui lòng đăng nhập lại trên các thiết bị." });
    },
  };
}
