export function httpError(statusCode, message, errors) {
  return Object.assign(new Error(message), { statusCode, errors });
}
