import { env } from "../config/env.js";
import { httpError } from "../utils/httpError.js";

export const bearerToken = (request) => {
  const match = /^Bearer (\S+)$/i.exec(request.get("authorization") ?? "");
  return match?.[1];
};

export function requireAuth(authService) {
  return async (request, _response, next) => {
    try {
      request.user = await authService.authenticate(bearerToken(request));
      next();
    } catch (error) { next(error); }
  };
}

export function protectAuthMutation(request, _response, next) {
  if (request.get("origin") && request.get("origin") !== new URL(env.clientUrl).origin) {
    return next(httpError(403, "Nguồn gửi yêu cầu không được phép."));
  }
  if (!request.is("application/json")) {
    return next(httpError(415, "Yêu cầu phải sử dụng application/json."));
  }
  next();
}

export function authRateLimit(limit, windowMs) {
  const buckets = new Map();
  return (request, response, next) => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
    const key = request.ip;
    let bucket = buckets.get(key);
    if (!bucket) {
      if (buckets.size >= 10000) return next(httpError(429, "Hệ thống đang bận. Vui lòng thử lại sau."));
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > limit) {
      response.set("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
      return next(httpError(429, "Bạn thao tác quá nhiều lần. Vui lòng thử lại sau."));
    }
    next();
  };
}
