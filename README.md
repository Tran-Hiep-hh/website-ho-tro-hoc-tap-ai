# Website hỗ trợ học tập ứng dụng AI

Dự án website hỗ trợ dạy và học ứng dụng AI:

- Frontend: React, Vite, JavaScript, Tailwind CSS.
- Backend: Node.js, Express.js.
- Database: PostgreSQL.
- AI: DeepSeek API.
- Xác thực: JWT, Refresh Token và bcrypt.

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

PostgreSQL của Docker dùng `127.0.0.1:55432` để tránh trùng cổng với PostgreSQL cài trên Windows.
`DATABASE_URL` trong `server/.env` cần khớp cổng này. Volume dữ liệu được giữ nguyên khi khởi động lại container.

3. Cài thư viện, cập nhật database và chạy hai ứng dụng:

```bash
npm install
npm run migrate --workspace server
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:4000
- Kiểm tra API: http://localhost:4000/api/health
- Kiểm tra database: http://localhost:4000/api/health/database

Trên PowerShell, nếu `npm.ps1` bị Execution Policy chặn, dùng `npm.cmd` thay cho `npm`.
Chỉ sao chép tệp `.env.example` khi chưa có `.env`; giữ cấu hình riêng đã thiết lập.

## Đăng ký, đăng nhập và đăng xuất

Giao diện dành cho máy tính (chiều rộng từ 1024px):

- `http://localhost:5173/#/register`: tạo tài khoản Giáo viên hoặc Người học.
- `http://localhost:5173/#/login`: đăng nhập bằng email và mật khẩu.
- Sau đăng nhập, hiển thị trang chào và thông tin tài khoản theo vai trò; nút Đăng xuất kết thúc phiên hiện tại.
- Đăng ký thành công chuyển về đăng nhập, điền sẵn email. Tải lại trang khôi phục phiên còn hiệu lực.
- Tên từ 2–100 ký tự; email duy nhất, không phân biệt hoa/thường; mật khẩu ít nhất 8 ký tự và tối đa 72 byte UTF-8 để tránh giới hạn cắt ngắn của bcrypt.
- Trạng thái tài khoản: `ACTIVE`, `BLOCKED`, `INACTIVE`. Chưa có giao diện quản trị trạng thái tài khoản.

### API xác thực

| Phương thức | Đường dẫn | Dữ liệu / yêu cầu |
| --- | --- | --- |
| POST | `/api/auth/register` | `fullName`, `email`, `password`, `confirmPassword`, `role` (`TEACHER`/`STUDENT`) |
| POST | `/api/auth/login` | `email`, `password`; trả `user` và `accessToken` |
| POST | `/api/auth/refresh` | Body `{}`, cookie refresh; đổi refresh token và cấp access token mới |
| GET | `/api/auth/me` | Header `Authorization: Bearer <accessToken>` |
| POST | `/api/auth/logout` | Body `{}`, cookie refresh và/hoặc header Bearer; thu hồi phiên và xóa cookie |

Các POST dùng `Content-Type: application/json`. Frontend gửi cookie với `credentials: include`.
Access token lưu trong bộ nhớ của trang; refresh token nằm trong cookie `HttpOnly`, `SameSite=Lax`, đường dẫn `/api/auth`, thêm `Secure` khi chạy production. Database chỉ lưu SHA-256 của refresh token.
Refresh token được thay mới mỗi lần sử dụng; logout thu hồi cả quyền sử dụng access token của phiên đó. Các phiên khác vẫn còn hiệu lực.

`CLIENT_URL` phải đúng origin của frontend. Production cần HTTPS, hai JWT secret ngẫu nhiên khác nhau, mỗi secret ít nhất 32 ký tự.
Giới hạn tần suất đăng ký/đăng nhập hiện lưu trong bộ nhớ của một tiến trình backend; khi mở rộng nhiều tiến trình cần dùng kho đếm chung.

### Kiểm thử

Khởi động PostgreSQL trước, sau đó:

```bash
npm test --workspace server
npm run test:e2e --workspace client
npm run build
```

API test và E2E test tạo schema riêng với tên ngẫu nhiên và xóa schema đó khi kết thúc, không sử dụng tài khoản thật.
Có thể đặt `TEST_DATABASE_URL` để kiểm thử trên database riêng; tài khoản database cần quyền tạo schema.
E2E mặc định dùng Microsoft Edge đã cài, kiểm thử giao diện máy tính cho hai vai trò, tải lại trang, nhiều tab và đăng xuất; dùng cổng 4015/5175 riêng.
Có thể đặt `PLAYWRIGHT_CHANNEL=chrome` nếu dùng Google Chrome. Báo cáo/ảnh kiểm thử nằm trong `client/test-results/` và được bỏ qua bởi Git.

Migration `database/migrations/001_auth.sql` bổ sung trạng thái tài khoản và mã phiên cho database đã có. Lệnh migrate có thể chạy lại và không xóa dữ liệu.

## Lưu ý

- Điền `DEEPSEEK_API_KEY` trong `server/.env` trước khi tích hợp chức năng AI.
- Không đưa tệp `.env` hoặc API key lên Git.
- Quiz đã giao sử dụng một phiên bản cố định; muốn thay đổi phải hủy bài giao cũ, tạo phiên bản Quiz mới và giao lại.
