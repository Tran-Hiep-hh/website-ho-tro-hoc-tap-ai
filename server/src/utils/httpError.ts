// @ts-nocheck
export interface HttpError extends Error {
  statusCode: number;
  errors?: unknown;
}

export function httpError(statusCode: number, message: string, errors?: unknown): HttpError {
  return Object.assign(new Error(message), { statusCode, errors });
}
