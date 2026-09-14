import { env } from "../config/env.js";
import { aiError as httpError } from "../utils/aiError.js";

export function providerConfig(config = env) {
  const requested = config.aiProvider.toLowerCase();
  const provider = requested === "auto" ? (config.deepseekApiKey ? "deepseek" : config.openrouterApiKey ? "openrouter" : "mock") : requested;
  if (provider === "mock") return { provider };
  if (!["deepseek", "openrouter"].includes(provider)) throw httpError(503, "AI_PROVIDER không hợp lệ. Chọn auto, mock, deepseek hoặc openrouter.");
  const key = provider === "deepseek" ? config.deepseekApiKey : config.openrouterApiKey;
  const model = provider === "deepseek" ? config.deepseekModel : config.openrouterModel;
  if (!key || !model) throw httpError(503, "Chưa cấu hình đầy đủ API key và model AI trên máy chủ.");
  const url = provider === "deepseek" ? `${config.deepseekApiUrl.replace(/\/+$/, "")}/chat/completions` : "https://openrouter.ai/api/v1/chat/completions";
  return { provider, key, model, url };
}

// One request only: retrying automatically can duplicate charges.
export async function createAICompletion(messages, { config = env, fetchImpl = fetch } = {}) {
  const settings = providerConfig(config);
  if (settings.provider === "mock") throw httpError(503, "Chưa bật dịch vụ AI thật.");
  const controller = new AbortController();
  const timeout = Math.max(1000, Math.min(config.aiTimeoutMs, 180000));
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetchImpl(settings.url, {
      method: "POST", signal: controller.signal,
      headers: { Authorization: `Bearer ${settings.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: settings.model, messages, stream: false, temperature: 0.2, max_tokens: 8000, response_format: { type: "json_object" }, ...(settings.provider === "deepseek" ? { thinking: { type: "disabled" } } : {}) }),
    });
    if (!response.ok) {
      const message = response.status === 401 || response.status === 403 ? "API key AI không hợp lệ hoặc không có quyền sử dụng model."
        : response.status === 402 ? "Tài khoản AI không đủ số dư."
        : response.status === 429 ? "Dịch vụ AI đang giới hạn yêu cầu. Vui lòng thử lại sau."
        : response.status === 400 || response.status === 404 ? "Model AI hoặc định dạng JSON chưa được dịch vụ hỗ trợ. Kiểm tra cấu hình model."
        : "Dịch vụ AI tạm thời không khả dụng. Vui lòng thử lại sau.";
      throw httpError(502, message);
    }
    const data = await response.json();
    const choice = data.choices?.[0];
    if (data.error || choice?.finish_reason !== "stop" || typeof choice?.message?.content !== "string") throw httpError(502, "AI chưa trả về nội dung hoàn chỉnh. Hãy giảm số lượng câu/thẻ hoặc thử lại.");
    let content;
    try { content = JSON.parse(choice.message.content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")); }
    catch { throw httpError(502, "AI trả về JSON không hợp lệ. Vui lòng thử lại."); }
    if (!content || Array.isArray(content) || typeof content !== "object") throw httpError(502, "AI trả về nội dung sai định dạng.");
    return { content, provider: settings.provider, model: settings.model };
  } catch (error) {
    if (controller.signal.aborted) throw httpError(504, "AI phản hồi quá lâu. Hãy giảm số lượng câu/thẻ hoặc thử lại sau.");
    if (error.statusCode) throw error;
    throw httpError(502, "Không kết nối được dịch vụ AI. Vui lòng thử lại sau.");
  } finally { clearTimeout(timer); }
}
