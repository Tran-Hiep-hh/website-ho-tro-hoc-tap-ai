import { env } from "../config/env.js";

export async function createDeepSeekCompletion(messages, options = {}) {
  if (!env.deepseekApiKey) {
    const error = new Error("Chưa cấu hình DEEPSEEK_API_KEY");
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch(`${env.deepseekApiUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.deepseekApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.model ?? env.deepseekModel,
      messages,
      temperature: options.temperature ?? 0.2,
      response_format: options.responseFormat,
    }),
  });

  if (!response.ok) {
    const error = new Error(`DeepSeek API trả về lỗi ${response.status}`);
    error.statusCode = 502;
    throw error;
  }

  return response.json();
}
