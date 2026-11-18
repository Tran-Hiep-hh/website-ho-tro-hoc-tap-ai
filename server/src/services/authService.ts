import bcrypt from "bcrypt";
import type { IAuthService } from "../interfaces/serviceInterfaces.js";
import { httpError } from "../utils/httpError.js";
import { validateCredentials } from "../validators/authValidator.js";
import { createTokens, hashToken, verifyToken } from "./tokenService.js";

export function publicUser(user: any) {
  return { userId: user.user_id, fullName: user.full_name, email: user.email, role: user.role };
}

export class AuthService implements IAuthService {
  private readonly dummyHash = bcrypt.hash("unusable-account-password", 12);

  constructor(private readonly repository: any) {}

  async register(body: any) {
    const input = validateCredentials(body, true);
    const passwordHash = await bcrypt.hash(input.password, 12);
    try { return publicUser(await this.repository.createUser({ ...input, passwordHash })); }
    catch (error: any) {
      if (error.code === "23505") throw httpError(409, "Email nÃ y Ä‘Ã£ Ä‘Æ°á»£c sá»­ dá»¥ng.", { email: "Vui lÃ²ng sá»­ dá»¥ng email khÃ¡c." });
      throw error;
    }
  }

  async login(body: any) {
    const { email, password } = validateCredentials(body);
    const user = await this.repository.findUserByEmail(email);
    const matches = await bcrypt.compare(password, user?.password_hash ?? await this.dummyHash);
    if (!user || !matches) throw httpError(401, "Email hoáº·c máº­t kháº©u khÃ´ng chÃ­nh xÃ¡c.");
    if (user.status !== "ACTIVE") throw httpError(403, "TÃ i khoáº£n Ä‘Ã£ bá»‹ khÃ³a hoáº·c ngá»«ng hoáº¡t Ä‘á»™ng.");
    const tokens = createTokens(user.user_id);
    if (!await this.repository.createSession({ userId: user.user_id, passwordHash: user.password_hash, ...tokens })) throw httpError(401, "ThÃ´ng tin Ä‘Äƒng nháº­p Ä‘Ã£ thay Ä‘á»•i. Vui lÃ²ng Ä‘Äƒng nháº­p láº¡i.");
    return { user: publicUser(user), ...tokens };
  }

  async updateProfile(userId: string, body: any) {
    const fullName = typeof body?.fullName === "string" ? body.fullName.trim().replace(/\s+/g, " ") : "";
    if (fullName.length < 2 || fullName.length > 100 || /[\x00-\x1f\x7f]/.test(fullName)) throw httpError(400, "Há» tÃªn cáº§n tá»« 2 Ä‘áº¿n 100 kÃ½ tá»± há»£p lá»‡.");
    if (Object.keys(body ?? {}).some((key) => key !== "fullName")) throw httpError(400, "Chá»‰ Ä‘Æ°á»£c cáº­p nháº­t há» tÃªn. Email vÃ  vai trÃ² khÃ´ng thá»ƒ Ä‘á»•i má»›i.");
    const user = await this.repository.updateProfile(userId, fullName);
    if (!user) throw httpError(403, "TÃ i khoáº£n khÃ´ng cÃ²n hoáº¡t Ä‘á»™ng.");
    return publicUser(user);
  }

  async changePassword(userId: string, body: any) {
    const { currentPassword, newPassword, confirmPassword } = body ?? {};
    if (typeof currentPassword !== "string" || !currentPassword || Buffer.byteLength(currentPassword, "utf8") > 72) throw httpError(400, "Vui lÃ²ng nháº­p máº­t kháº©u hiá»‡n táº¡i há»£p lá»‡.");
    if (typeof newPassword !== "string" || newPassword.length < 8 || Buffer.byteLength(newPassword, "utf8") > 72) throw httpError(400, "Máº­t kháº©u má»›i cáº§n Ã­t nháº¥t 8 kÃ½ tá»± vÃ  tá»‘i Ä‘a 72 byte.");
    if (newPassword !== confirmPassword) throw httpError(400, "Máº­t kháº©u xÃ¡c nháº­n khÃ´ng khá»›p.");
    if (newPassword === currentPassword) throw httpError(400, "Máº­t kháº©u má»›i cáº§n khÃ¡c máº­t kháº©u hiá»‡n táº¡i.");
    const user = await this.repository.findUserById(userId);
    if (!user || user.status !== "ACTIVE") throw httpError(403, "TÃ i khoáº£n khÃ´ng cÃ²n hoáº¡t Ä‘á»™ng.");
    if (!await bcrypt.compare(currentPassword, user.password_hash)) throw httpError(400, "Máº­t kháº©u hiá»‡n táº¡i khÃ´ng chÃ­nh xÃ¡c.");
    if (!await this.repository.changePassword(userId, user.password_hash, await bcrypt.hash(newPassword, 12))) throw httpError(409, "Máº­t kháº©u hoáº·c tÃ i khoáº£n Ä‘Ã£ thay Ä‘á»•i. Vui lÃ²ng Ä‘Äƒng nháº­p láº¡i.");
  }

  async refresh(refreshToken: string) {
    const payload = verifyToken(refreshToken, "refresh"), tokens = createTokens(payload.sub, payload.sid);
    const user = await this.repository.rotateSession({ userId: payload.sub, oldHash: hashToken(refreshToken), ...tokens });
    if (!user) throw httpError(401, "PhiÃªn Ä‘Äƒng nháº­p khÃ´ng cÃ²n hiá»‡u lá»±c. Vui lÃ²ng Ä‘Äƒng nháº­p láº¡i.");
    return { user: publicUser(user), ...tokens };
  }

  async authenticate(accessToken: string) {
    const payload = verifyToken(accessToken, "access"), user = await this.repository.findSessionUser(payload.sub, payload.sid);
    if (!user) throw httpError(401, "PhiÃªn Ä‘Äƒng nháº­p khÃ´ng cÃ²n hiá»‡u lá»±c.");
    if (user.status !== "ACTIVE") throw httpError(403, "TÃ i khoáº£n Ä‘Ã£ bá»‹ khÃ³a hoáº·c ngá»«ng hoáº¡t Ä‘á»™ng.");
    return publicUser(user);
  }

  async logout(refreshToken?: string, accessToken?: string) {
    for (const [token, type] of [[refreshToken, "refresh"], [accessToken, "access"]] as const) {
      if (!token) continue;
      try { const payload = verifyToken(token, type, true); await this.repository.revokeSession(payload.sub, payload.sid); } catch { /* revoke the other token */ }
    }
  }
}

export function createAuthService(repository: any): IAuthService {
  return new AuthService(repository);
}
