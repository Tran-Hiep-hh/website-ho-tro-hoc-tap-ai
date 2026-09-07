import { httpError } from "../utils/httpError.js";

export function validateCredentials(body, registering = false) {
  const input = body && typeof body === "object" ? body : {};
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const password = typeof input.password === "string" ? input.password : "";
  const fullName = typeof input.fullName === "string" ? input.fullName.trim().replace(/\s+/g, " ") : "";
  const errors = {};

  if (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Vui lòng nhập email hợp lệ.";
  }
  if (!password || Buffer.byteLength(password, "utf8") > 72) {
    errors.password = "Mật khẩu không được để trống hoặc dài quá 72 byte.";
  }
  if (registering) {
    if (fullName.length < 2 || fullName.length > 100) errors.fullName = "Họ tên cần từ 2 đến 100 ký tự.";
    if (password.length < 8) errors.password = "Mật khẩu cần ít nhất 8 ký tự.";
    if (input.confirmPassword !== password) errors.confirmPassword = "Mật khẩu xác nhận không khớp.";
    if (!["TEACHER", "STUDENT"].includes(input.role)) errors.role = "Vui lòng chọn Giáo viên hoặc Người học.";
  }
  if (Object.keys(errors).length) throw httpError(400, "Vui lòng kiểm tra thông tin đã nhập.", errors);
  return { email, password, fullName, role: input.role };
}
