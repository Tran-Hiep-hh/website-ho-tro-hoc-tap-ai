export function notFound(request, response) {
  response.status(404).json({
    success: false,
    message: `Không tìm thấy API ${request.method} ${request.originalUrl}`,
  });
}
