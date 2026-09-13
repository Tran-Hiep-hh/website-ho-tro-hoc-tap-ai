import bcrypt from "bcrypt";
import { httpError } from "../utils/httpError.js";
import { validateCredentials } from "../validators/authValidator.js";
import { createTokens, hashToken, verifyToken } from "./tokenService.js";

export function publicUser(user) {
  return { userId: user.user_id, fullName: user.full_name, email: user.email, role: user.role };
}

export function createAuthService(repository) {
  // Keep password verification work for unknown emails similar to existing users.
  const dummyHash = bcrypt.hash("unusable-account-password", 12);
  return {
    async register(body) {
      const input = validateCredentials(body, true);
      const passwordHash = await bcrypt.hash(input.password, 12);
      try {
        return publicUser(await repository.createUser({ ...input, passwordHash }));
      } catch (error) {
        if (error.code === "23505") {
          throw httpError(409, "Email này đã được sử dụng.", { email: "Vui lòng sử dụng email khác." });
        }
        throw error;
      }
    },
    async login(body) {
      const { email, password } = validateCredentials(body);
      const user = await repository.findUserByEmail(email);
      const matches = await bcrypt.compare(password, user?.password_hash ?? await dummyHash);
      if (!user || !matches) throw httpError(401, "Email hoặc mật khẩu không chính xác.");
      if (user.status !== "ACTIVE") throw httpError(403, "Tài khoản đã bị khóa hoặc ngừng hoạt động.");
      const tokens = createTokens(user.user_id);
      if (!await repository.createSession({ userId: user.user_id, passwordHash: user.password_hash, ...tokens })) throw httpError(401, "Thông tin đăng nhập đã thay đổi. Vui lòng đăng nhập lại.");
      return { user: publicUser(user), ...tokens };
    },
    async updateProfile(userId, body) {
      const fullName = typeof body?.fullName === "string" ? body.fullName.trim().replace(/\s+/g, " ") : "";
      if (fullName.length < 2 || fullName.length > 100 || /[\x00-\x1f\x7f]/.test(fullName)) throw httpError(400, "Họ tên cần từ 2 đến 100 ký tự hợp lệ.");
      if (Object.keys(body ?? {}).some((key) => key !== "fullName")) throw httpError(400, "Chỉ được cập nhật họ tên. Email và vai trò không thể thay đổi.");
      const user = await repository.updateProfile(userId, fullName);
      if (!user) throw httpError(403, "Tài khoản không còn hoạt động.");
      return publicUser(user);
    },
    async changePassword(userId, body) {
      const { currentPassword, newPassword, confirmPassword } = body ?? {};
      if (typeof currentPassword !== "string" || !currentPassword || Buffer.byteLength(currentPassword, "utf8") > 72) throw httpError(400, "Vui lòng nhập mật khẩu hiện tại hợp lệ.");
      if (typeof newPassword !== "string" || newPassword.length < 8 || Buffer.byteLength(newPassword, "utf8") > 72) throw httpError(400, "Mật khẩu mới cần ít nhất 8 ký tự và tối đa 72 byte.");
      if (newPassword !== confirmPassword) throw httpError(400, "Mật khẩu xác nhận không khớp.");
      if (newPassword === currentPassword) throw httpError(400, "Mật khẩu mới cần khác mật khẩu hiện tại.");
      const user = await repository.findUserById(userId);
      if (!user || user.status !== "ACTIVE") throw httpError(403, "Tài khoản không còn hoạt động.");
      if (!await bcrypt.compare(currentPassword, user.password_hash)) throw httpError(400, "Mật khẩu hiện tại không chính xác.");
      const newHash = await bcrypt.hash(newPassword, 12);
      if (!await repository.changePassword(userId, user.password_hash, newHash)) throw httpError(409, "Mật khẩu hoặc tài khoản đã thay đổi. Vui lòng đăng nhập lại.");
    },
    async refresh(refreshToken) {
      const payload = verifyToken(refreshToken, "refresh");
      const tokens = createTokens(payload.sub, payload.sid);
      const user = await repository.rotateSession({
        userId: payload.sub, oldHash: hashToken(refreshToken), ...tokens,
      });
      if (!user) throw httpError(401, "Phiên đăng nhập không còn hiệu lực. Vui lòng đăng nhập lại.");
      return { user: publicUser(user), ...tokens };
    },
    async authenticate(accessToken) {
      const payload = verifyToken(accessToken, "access");
      const user = await repository.findSessionUser(payload.sub, payload.sid);
      if (!user) throw httpError(401, "Phiên đăng nhập không còn hiệu lực.");
      if (user.status !== "ACTIVE") throw httpError(403, "Tài khoản đã bị khóa hoặc ngừng hoạt động.");
      return publicUser(user);
    },
    async logout(refreshToken, accessToken) {
      // Expired signed tokens can still identify the session to revoke.
      for (const [token, type] of [[refreshToken, "refresh"], [accessToken, "access"]]) {
        if (!token) continue;
        let payload;
        try { payload = verifyToken(token, type, true); } catch { continue; }
        await repository.revokeSession(payload.sub, payload.sid);
      }
    },
  };
}
