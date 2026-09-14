# Cấu hình AI tạo học liệu

Chỉ sửa `server/.env`, không đặt key trong `client/.env` và không commit key. Khởi động lại backend sau khi đổi cấu hình. Không cần migration database cho phần AI này.

## DeepSeek

```dotenv
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=dan_key_cua_ban
DEEPSEEK_API_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
AI_TIMEOUT_MS=55000
AI_MAX_SOURCE_CHARS=40000
```

Kết nối DeepSeek dùng chế độ non-thinking cho tác vụ tạo học liệu; cơ chế `thinking.type` theo [tài liệu DeepSeek](https://api-docs.deepseek.com/guides/thinking_mode/). Tốc độ thực tế vẫn phụ thuộc dịch vụ và độ dài nội dung.

## OpenRouter

```dotenv
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=dan_key_cua_ban
OPENROUTER_MODEL=dan_model_id_tu_openrouter
AI_TIMEOUT_MS=55000
AI_MAX_SOURCE_CHARS=40000
```

Điền chính xác model ID từ tài khoản OpenRouter, chọn model hỗ trợ JSON output. Model miễn phí và khả năng phục vụ có thể thay đổi; không tự chuyển sang model trả phí hoặc sang DeepSeek nếu OpenRouter lỗi. Với OpenRouter cần cấu hình cả key và tên model.

`AI_PROVIDER=auto` (mặc định): ưu tiên key DeepSeek, sau đó OpenRouter, không có key thì MOCK. `AI_PROVIDER=mock` luôn dùng giả lập. Chọn rõ `deepseek`/`openrouter` nhưng thiếu key/model sẽ báo lỗi cấu hình. Không tự giả lập khi AI thật gặp lỗi.

## Sử dụng và kiểm tra

Đăng nhập tài khoản thật → tải tài liệu có văn bản → Tạo học liệu → chọn Quiz/Flashcard/Mindmap → Tạo học liệu. Xem nhãn DeepSeek/OpenRouter trong kết quả, kiểm tra nội dung và chỉnh sửa trước khi lưu. `/preview/` luôn là giả lập.

Hệ thống chỉ đọc tài liệu cá nhân READY của người dùng, gửi văn bản và yêu cầu bổ sung tới nhà cung cấp đã chọn. Chỉ lấy tối đa 40.000 ký tự chia đều cho các tài liệu; nếu cắt bớt, kết quả có thông báo. PDF dạng ảnh chưa OCR vẫn chưa thể dùng làm nguồn.

Quiz được kiểm tra đúng số câu, 4 lựa chọn khác nhau, đáp án 0–3 và giải thích; Flashcard kiểm tra số thẻ và hai mặt; Mindmap kiểm tra cây một gốc, không vòng lặp, tối đa 30 nút. Kiểm tra định dạng không bảo đảm mọi kiến thức AI đều chính xác, giáo viên vẫn cần duyệt nội dung.

Timeout mặc định 55 giây, có thể đặt 1.000–180.000 ms. Nếu tăng quá timeout reverse proxy, cần tăng `proxy_read_timeout` của Nginx tương ứng rồi kiểm tra `sudo nginx -t` trước khi reload. Mỗi lần tạo gọi AI một lần, không tự retry để tránh phát sinh thêm lượt tính phí. Nên bắt đầu thử với 3–5 câu/thẻ.

EC2 sau khi cập nhật code: sửa `/var/www/website-ho-tro-hoc-tap-ai/server/.env`, sau đó `sudo systemctl restart study-ai`. Không cần build frontend chỉ để thay key/model.

## Tài liệu giao thức

- [DeepSeek JSON output](https://api-docs.deepseek.com/guides/json_mode/)
- [DeepSeek Chat Completions và model](https://api-docs.deepseek.com/api/create-chat-completion/)
- [OpenRouter Quickstart](https://openrouter.ai/docs/quickstart)

Kiểm thử tự động dùng HTTP provider giả lập và database kiểm thử, không cần key và không phát sinh chi phí. Cần key/model đang hoạt động để kiểm thử chất lượng và độ trễ dịch vụ thật.
