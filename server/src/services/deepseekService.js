import { env } from "../config/env.js";
import { createAICompletion } from "./aiProvider.js";

// Compatibility entry point with shared timeouts and safe errors.
export async function createDeepSeekCompletion(messages, options = {}) {
  const result = await createAICompletion(messages, { config: { ...env, aiProvider: "deepseek", deepseekModel: options.model ?? env.deepseekModel } });
  return { choices: [{ finish_reason: "stop", message: { role: "assistant", content: JSON.stringify(result.content) } }] };
}
