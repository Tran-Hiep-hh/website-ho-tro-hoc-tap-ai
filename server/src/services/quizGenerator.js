// Replace this provider with an AI provider when one is configured. It never calls an external API.
export async function generateQuiz({ title, difficulty, sources, contentRequest, quantity }) {
  const templates = [
    ["Khóa chính có vai trò nào trong bảng dữ liệu?", ["Xác định duy nhất mỗi bản ghi", "Lưu mọi bản ghi trùng lặp", "Thay thế tất cả cột", "Xóa các bảng liên quan"], 0, "Khóa chính xác định duy nhất mỗi bản ghi và không nhận giá trị NULL."],
    ["Câu lệnh nào truy vấn dữ liệu trong SQL?", ["DELETE", "SELECT", "INSERT", "UPDATE"], 1, "SELECT lấy dữ liệu theo các điều kiện truy vấn."],
    ["Khóa ngoại dùng để làm gì?", ["Tăng kích thước tệp", "Mã hóa mật khẩu", "Liên kết dữ liệu giữa các bảng", "Xóa dữ liệu trùng"], 2, "Khóa ngoại tham chiếu đến khóa của bảng được liên kết."],
    ["Chuẩn hóa dữ liệu giúp ích gì?", ["Tăng độ sáng màn hình", "Thay đổi ngôn ngữ lập trình", "Tăng tốc Internet", "Giảm dư thừa và bất thường cập nhật"], 3, "Chuẩn hóa tổ chức dữ liệu nhằm giảm dư thừa và bất thường khi cập nhật."],
    ["INNER JOIN trả về những bản ghi nào?", ["Các bản ghi thỏa điều kiện nối ở cả hai bảng", "Mọi bản ghi của bảng trái", "Chỉ bản ghi không khớp", "Mọi bản ghi của bảng phải"], 0, "INNER JOIN chỉ giữ các cặp bản ghi thỏa điều kiện nối."],
  ];
  return {
    type: "QUIZ", title, difficulty, sources, contentRequest, quantity,
    generationMode: "MOCK",
    questions: Array.from({ length: quantity }, (_, index) => {
      const [text, options, answer, explanation] = templates[index % templates.length];
      return { text, options: [...options], answer, explanation, source: "Bộ câu hỏi giả lập về cơ sở dữ liệu — không trích từ tài liệu đã chọn" };
    }),
  };
}
