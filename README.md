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

## Tài liệu cá nhân với dữ liệu thật

Đăng nhập tài khoản thật rồi mở **Tài liệu cá nhân**. Hệ thống hỗ trợ tải PDF/DOCX/TXT (tối đa 10 MB/tệp), trích xuất văn bản, tìm kiếm/lọc, xem nội dung, tải tệp gốc và xóa. Dữ liệu vẫn còn sau khi tải lại trang. PDF dạng ảnh chưa có OCR; tệp không có văn bản được đánh dấu thất bại và vẫn có thể tải xuống hoặc xóa. TXT dùng UTF-8.

Với database đã có, chạy `npm run migrate --workspace server` trước khi khởi động ứng dụng. Migration `002_documents.sql` bổ sung `file_size` và `created_at`, có thể chạy lại và không xóa dữ liệu hiện có.

Tệp gốc lưu ở `uploads/` tại thư mục gốc dự án (hoặc `UPLOAD_DIR`), tên lưu trữ ngẫu nhiên và không được phục vụ công khai. Cần sao lưu cả thư mục này và PostgreSQL. API `/api/documents` yêu cầu đăng nhập; danh sách, chi tiết, tải xuống và xóa đều kiểm tra người sở hữu. Xóa đánh dấu bản ghi `DELETED`, gỡ tệp gốc và giữ tham chiếu cho học liệu đã tạo. Tài liệu đang chia sẻ trong lớp phải gỡ liên kết trước khi xóa.

Nội dung tạo AI vẫn là giả lập; lớp học vẫn là giao diện mẫu. Tài liệu, học liệu và kết quả cá nhân đã lưu thật. Nút đặt lại dữ liệu mẫu không xóa tài liệu, học liệu hoặc tiến độ thật. Bộ `test:e2e` kiểm tra cả tải tài liệu, tải lại trang, tải xuống và xóa bằng API thật; API test dùng schema và thư mục tạm riêng để kiểm tra quyền sở hữu và các định dạng.

## Quiz cá nhân với AI giả lập

Không cần DeepSeek API key. Sau khi đăng nhập thật, chọn một tài liệu cá nhân đã xử lý → **Tạo học liệu** → **Quiz** → nhập tên, độ khó, số câu và yêu cầu bổ sung nếu có → **Xem kết quả mẫu** → **Lưu vào thư viện**. Quiz, thiết lập và yêu cầu bổ sung được lưu vào PostgreSQL; có thể chỉnh sửa, làm bài và xem lại kết quả sau khi tải lại trang.

Chế độ hiện tại luôn là **MOCK**, dùng 5 câu hỏi minh họa về cơ sở dữ liệu, không phân tích tài liệu và không áp dụng yêu cầu bổ sung. Mỗi câu có 4 lựa chọn và 1 đáp án đúng; số lượng 1–20, trên 5 câu sẽ lặp lại bộ mẫu. Giao diện ghi rõ giới hạn này. Cấu trúc tạo câu hỏi được tách trong `server/src/services/quizGenerator.js` để tích hợp nhà cung cấp AI sau; thêm API key chưa tự động chuyển sang DeepSeek.

API `/api/quizzes` yêu cầu đăng nhập và kiểm tra quyền sở hữu tài liệu nguồn/Quiz/lượt làm. Máy chủ chấm điểm từ đáp án của phiên bản đã bắt đầu; không nhận điểm do client tự tính. Điểm lưu theo tỷ lệ 0–100 để tương thích cấu trúc cũ, giao diện đổi sang thang 10 (60 → 6/10). Chỉnh sửa tạo phiên bản mới, giữ nguyên câu hỏi và kết quả của lượt làm cũ. Gửi lại yêu cầu nộp cùng lượt không tạo điểm hoặc câu trả lời trùng. Lựa chọn chưa nộp chỉ nằm trong trang hiện tại; tải lại trang cần chọn lại.

Chạy `npm run migrate --workspace server` cho database đã có. Migration `003_quizzes.sql` bổ sung cấu hình tạo, ngày tạo, tiêu đề phiên bản và nhãn nguồn câu hỏi; giữ nguyên dữ liệu cũ. Xóa Quiz khỏi thư viện vẫn giữ lịch sử làm bài. Giao bài trong lớp hiện vẫn là giao diện mẫu.

Kiểm thử: `npm run test --workspace server` kiểm tra quyền sở hữu, phiên bản, chấm điểm và yêu cầu đồng thời; `npm run test:e2e --workspace client` kiểm tra luồng Quiz trên trình duyệt với PostgreSQL thật trong schema riêng.

## Flashcard và Mindmap lưu thật

Đăng nhập thật → chọn tài liệu sẵn sàng → **Tạo học liệu** → chọn Flashcard hoặc Mindmap → xem kết quả giả lập → chỉnh sửa trước khi lưu → **Lưu vào thư viện**. Hai loại học liệu dùng API `/api/study-materials`, được lưu trong các bảng `generated_contents`, `content_sources`, `flashcards` và `mindmap_nodes`. Người dùng chỉ được tạo từ tài liệu của mình và xem/sửa/xóa học liệu do mình sở hữu. Học liệu đang chia sẻ phải gỡ khỏi lớp trước khi xóa.

Migration `004_study_materials.sql` bổ sung `generated_contents.revision`, `flashcards.keyword` và bảng `flashcard_progress`. Lệnh migrate có thể chạy lại, không xóa dữ liệu cũ. Số phiên bản giúp chặn lưu đè từ trang đã cũ; khi gặp thông báo xung đột, tải lại trang rồi chỉnh sửa tiếp.

Flashcard lưu trạng thái **Đã nhớ / Cần ôn lại** theo từng thẻ. Sửa mặt trước hoặc mặt sau của thẻ đặt lại tiến độ của riêng thẻ đó; đổi tên bộ thẻ, từ khóa hoặc thứ tự không làm mất tiến độ của thẻ không đổi. Khi xóa thẻ, tiến độ liên quan được xóa theo. Mindmap lưu đầy đủ nút và nút cha; kiểm tra một nút gốc, không vòng lặp, không nhánh mồ côi, tối đa 30 nút. Nhấn **Lưu Mindmap** sau chỉnh sửa; có thể xuất PNG hoặc in/lưu PDF.

Chế độ tạo nội dung vẫn là **MOCK**, không gọi DeepSeek hoặc phân tích tài liệu/yêu cầu bổ sung. Flashcard dùng 6 thẻ minh họa (chọn 1–20; trên 6 sẽ lặp lại), Mindmap dùng cây mẫu tổng quan hoặc chi tiết. Tất cả nội dung đã lưu và tiến độ đều còn sau khi tải lại trang. Đường dẫn `/preview/` vẫn dùng dữ liệu trong bộ nhớ và không gọi API.

## Bản xem trước giao diện máy tính

Chỉ cần chạy frontend, không cần Docker, API hoặc khóa DeepSeek:

```bash
npm run dev --workspace client
```

- Giáo viên: `http://localhost:5173/#/preview/teacher/home`
- Người học: `http://localhost:5173/#/preview/student/home`
- Trang đăng nhập cũng có liên kết **Xem giao diện mẫu** cho hai vai trò.

Các màn hình gồm Dashboard, hồ sơ/đổi mật khẩu, tài liệu cá nhân, thư viện và tạo học liệu, Quiz, ôn Flashcard, trình sửa Mindmap, lớp/thành viên/yêu cầu tham gia, chia sẻ học liệu, giao/làm Quiz, kết quả và thông báo.
Có tìm kiếm, bộ lọc, biểu mẫu, xác nhận xóa, trạng thái trống và các thao tác thử trong trình duyệt.

Dữ liệu học tập nằm trong `client/src/workspace/data.js`, trạng thái được quản lý bởi `WorkspaceContext.jsx`.
Thay đổi chỉ giữ trong bộ nhớ của phiên xem, sẽ đặt lại khi tải lại trang hoặc chuyển vai trò. Nút **Đặt lại** khôi phục dữ liệu mẫu.
Tệp TXT có thể được đọc tại máy; PDF/DOCX chỉ hiển thị metadata và chờ dịch vụ trích xuất. Không tệp nào được tải lên máy chủ.
Luồng tạo AI dùng nội dung minh họa cố định về cơ sở dữ liệu và không gọi DeepSeek.
Mindmap xuất PNG bằng canvas; **In / Lưu PDF** mở hộp thoại in của trình duyệt để người dùng lưu PDF.
Hồ sơ được sửa trong bản mẫu; biểu mẫu mật khẩu chỉ kiểm tra dữ liệu, không thay đổi tài khoản thật.
Đăng ký, đăng nhập, đăng xuất vẫn sử dụng API thật khi mở ngoài đường dẫn `/preview/`.

Kiểm thử giao diện độc lập trên Edge:

```bash
npm run test:ui --workspace client
```

Kiểm thử dùng dữ liệu mẫu và API giả lập cho kiểm tra điều hướng xác thực; không kết nối database.
Bộ `test:e2e` riêng vẫn kiểm thử xác thực thật và cần PostgreSQL đang chạy.

## Lưu ý chung

- Điền `DEEPSEEK_API_KEY` trong `server/.env` trước khi tích hợp chức năng AI.
- Không đưa tệp `.env` hoặc API key lên Git.
- Quiz đã giao sử dụng một phiên bản cố định; muốn thay đổi phải hủy bài giao cũ, tạo phiên bản Quiz mới và giao lại.
