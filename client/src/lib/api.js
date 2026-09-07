const apiUrl = (import.meta.env.VITE_API_URL ?? "/api").replace(/\/$/, "");
let accessToken = null;
let refreshPromise = null;
let sessionGeneration = 0;

export class ApiError extends Error {
  constructor(message, status = 0, errors = {}) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

async function request(path, { method = "GET", body, token } = {}) {
  let response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      method, credentials: "include", cache: "no-store",
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch { throw new ApiError("Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối và thử lại."); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data.message ?? "Không thể xử lý yêu cầu. Vui lòng thử lại.", response.status, data.errors);
  return data;
}

// Serialize cookie rotation across tabs and concurrent requests in this tab.
const withSessionLock = (action) => navigator.locks
  ? navigator.locks.request("study-ai-session", action) : action();

export function refreshSession() {
  if (!refreshPromise) {
    const generation = sessionGeneration;
    refreshPromise = withSessionLock(async () => {
      if (generation !== sessionGeneration) throw new ApiError("Phiên đăng nhập đã thay đổi.", 401);
      const data = await request("/auth/refresh", { method: "POST", body: {} });
      if (generation !== sessionGeneration) throw new ApiError("Phiên đăng nhập đã thay đổi.", 401);
      accessToken = data.accessToken;
      return data.user;
    }).catch((error) => {
      if (generation === sessionGeneration && error.status === 401) accessToken = null;
      throw error;
    }).finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

export const register = (input) => request("/auth/register", { method: "POST", body: input });

export async function login(input) {
  sessionGeneration += 1;
  return withSessionLock(async () => {
    const data = await request("/auth/login", { method: "POST", body: input });
    accessToken = data.accessToken;
    return data.user;
  });
}

export async function logout() {
  sessionGeneration += 1;
  await withSessionLock(() => request("/auth/logout", { method: "POST", body: {}, token: accessToken }));
  accessToken = null;
}

export async function apiRequest(path, options = {}) {
  if (!accessToken) await refreshSession();
  try { return await request(path, { ...options, token: accessToken }); }
  catch (error) {
    if (error.status !== 401) throw error;
    await refreshSession();
    return request(path, { ...options, token: accessToken });
  }
}
