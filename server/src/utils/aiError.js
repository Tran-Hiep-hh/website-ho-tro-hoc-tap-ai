import { httpError } from "./httpError.js";
// Only curated messages, never upstream response bodies or credentials.
export function aiError(status, message) {
  return Object.assign(httpError(status, message), { expose: true });
}
