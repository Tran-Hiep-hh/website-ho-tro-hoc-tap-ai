# Website hỗ trợ học tập ứng dụng AI

Bộ khung mã nguồn cho đồ án sử dụng:

- Frontend: React, Vite, JavaScript, Tailwind CSS.
- Backend: Node.js, Express.js.
- Database: PostgreSQL.
- AI: DeepSeek API.
- Xác thực dự kiến: JWT, Refresh Token và bcrypt.

## Cấu trúc

```text
client/       Giao diện React
server/       RESTful API Express.js
database/     Cấu trúc PostgreSQL
```

## Chạy dự án

1. Sao chép biến môi trường:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

2. Khởi động PostgreSQL:

```bash
docker compose up -d postgres
```

3. Cài thư viện và chạy hai ứng dụng:

```bash
npm install
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:4000
- Kiểm tra API: http://localhost:4000/api/health

## Lưu ý

- Điền `DEEPSEEK_API_KEY` trong `server/.env` trước khi tích hợp chức năng AI.
- Không đưa tệp `.env` hoặc API key lên Git.
- Quiz đã giao sử dụng một phiên bản cố định; muốn thay đổi phải hủy bài giao cũ, tạo phiên bản Quiz mới và giao lại.
