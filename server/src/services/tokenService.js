import { createHash, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { httpError } from "../utils/httpError.js";

const issuer = "study-ai";
const audience = "study-ai-web";

export const hashToken = (token) => createHash("sha256").update(token).digest("hex");

export function createTokens(userId, sessionId = randomUUID()) {
  const base = { subject: String(userId), issuer, audience, algorithm: "HS256" };
  const accessToken = jwt.sign({ type: "access", sid: sessionId }, env.jwtAccessSecret, {
    ...base, expiresIn: env.jwtAccessExpiresIn, jwtid: randomUUID(),
  });
  const refreshToken = jwt.sign({ type: "refresh", sid: sessionId }, env.jwtRefreshSecret, {
    ...base, expiresIn: env.jwtRefreshExpiresIn, jwtid: randomUUID(),
  });
  return {
    accessToken, refreshToken, sessionId,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(jwt.decode(refreshToken).exp * 1000),
  };
}

export function verifyToken(token, type, ignoreExpiration = false) {
  try {
    const payload = jwt.verify(token, type === "access" ? env.jwtAccessSecret : env.jwtRefreshSecret, {
      algorithms: ["HS256"], issuer, audience, ignoreExpiration,
    });
    if (payload.type !== type || !/^[1-9]\d*$/.test(payload.sub)
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.sid)) {
      throw new Error("Invalid token claims");
    }
    return payload;
  } catch {
    throw httpError(401, "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
  }
}
