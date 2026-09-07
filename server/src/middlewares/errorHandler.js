export function errorHandler(error, _request, response, _next) {
  const statusCode = error.statusCode ?? error.status ?? 500;

  if (statusCode >= 500 && process.env.NODE_ENV !== "test") {
    // Parser errors may contain request bodies, including passwords. Never log them.
    console.error("API error:", { statusCode, code: error.code ?? error.name });
  }

  response.status(statusCode).json({
    success: false,
    message: statusCode >= 500 ? "Hệ thống xảy ra lỗi. Vui lòng thử lại sau." :
      error.type === "entity.parse.failed" ? "Dữ liệu JSON không hợp lệ." : error.message,
    ...(error.errors ? { errors: error.errors } : {}),
  });
}
