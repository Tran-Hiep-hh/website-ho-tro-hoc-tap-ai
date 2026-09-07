import "dotenv/config";

const numberFromEnv = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: numberFromEnv(process.env.PORT, 4000),
  clientUrl: process.env.CLIENT_URL ?? "http://localhost:5173",
  databaseUrl:
    process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55432/study_ai",
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? "development-access-secret",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? "development-refresh-secret",
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",
  deepseekApiKey: process.env.DEEPSEEK_API_KEY ?? "",
  deepseekApiUrl: process.env.DEEPSEEK_API_URL ?? "https://api.deepseek.com",
  deepseekModel: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
  maxFileSizeMb: numberFromEnv(process.env.MAX_FILE_SIZE_MB, 10),
  uploadDir: process.env.UPLOAD_DIR ?? "uploads",
});

if (env.nodeEnv === "production") {
  for (const key of ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"]) {
    const secret = process.env[key];
    if (!secret || secret.length < 32 || secret.startsWith("replace-with-")) {
      throw new Error(`${key} phải là chuỗi bí mật ngẫu nhiên ít nhất 32 ký tự`);
    }
  }
  if (env.jwtAccessSecret === env.jwtRefreshSecret) {
    throw new Error("Hai khóa JWT phải khác nhau");
  }
}
