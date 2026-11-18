// @ts-nocheck
import { createHash, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { httpError } from "../utils/httpError.js";
import type { JwtPayload, SignOptions } from "jsonwebtoken";

const issuer = "study-ai";
const audience = "study-ai-web";

export const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface VerifiedTokenPayload extends JwtPayload {
  sub: string;
  sid: string;
  type: "access" | "refresh";
}

export function createTokens(userId: string | number, sessionId: string = randomUUID()): TokenPair {
  const base = { subject: String(userId), issuer, audience, algorithm: "HS256" };
  const accessToken = jwt.sign({ type: "access", sid: sessionId }, env.jwtAccessSecret, {
    ...base, expiresIn: env.jwtAccessExpiresIn, jwtid: randomUUID(),
  } as SignOptions);
  const refreshToken = jwt.sign({ type: "refresh", sid: sessionId }, env.jwtRefreshSecret, {
    ...base, expiresIn: env.jwtRefreshExpiresIn, jwtid: randomUUID(),
  } as SignOptions);
  const decoded = jwt.decode(refreshToken);
  if (!decoded || typeof decoded === "string" || typeof decoded.exp !== "number") {
    throw httpError(500, "Không thể tạo phiên đăng nhập.");
  }
  return {
    accessToken, refreshToken, sessionId,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(decoded.exp * 1000),
  };
}

export function verifyToken(token: string, type: "access" | "refresh", ignoreExpiration = false): VerifiedTokenPayload {
  try {
    const payload = jwt.verify(token, type === "access" ? env.jwtAccessSecret : env.jwtRefreshSecret, {
      algorithms: ["HS256"], issuer, audience, ignoreExpiration,
    });
    if (!payload || typeof payload === "string") throw new Error("Invalid token payload");
    if (typeof payload.sub !== "string" || typeof payload.sid !== "string"
      || payload.type !== type || !/^[1-9]\d*$/.test(payload.sub)
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.sid)) {
      throw new Error("Invalid token claims");
    }
    return payload as VerifiedTokenPayload;
  } catch {
    throw httpError(401, "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
  }
}
