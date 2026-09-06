export function errorHandler(error, _request, response, _next) {
  const statusCode = error.statusCode ?? 500;

  if (process.env.NODE_ENV !== "test") {
    console.error(error);
  }

  response.status(statusCode).json({
    success: false,
    message: statusCode === 500 ? "Hệ thống xảy ra lỗi" : error.message,
  });
}
