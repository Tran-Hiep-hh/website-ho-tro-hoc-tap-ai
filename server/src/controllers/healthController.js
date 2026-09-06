import { checkDatabaseConnection } from "../config/database.js";

export function getHealth(_request, response) {
  response.status(200).json({
    success: true,
    message: "Website hỗ trợ học tập ứng dụng AI API đang hoạt động",
  });
}

export async function getDatabaseHealth(_request, response, next) {
  try {
    const database = await checkDatabaseConnection();
    response.status(200).json({
      success: true,
      message: "Kết nối PostgreSQL thành công",
      database,
    });
  } catch (error) {
    next(error);
  }
}
