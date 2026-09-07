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
      await repository.createSession({ userId: user.user_id, ...tokens });
      return { user: publicUser(user), ...tokens };
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
