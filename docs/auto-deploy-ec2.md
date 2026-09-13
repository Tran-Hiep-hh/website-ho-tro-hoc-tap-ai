# Tự triển khai EC2 khi push main

Workflow: `.github/workflows/deploy-ec2.yml`. Chạy khi push `main` hoặc chọn Run workflow trong GitHub Actions. Chỉ triển khai main, không chạy trên pull request.

## Thiết lập một lần trên EC2

Tạo khóa riêng cho GitHub Actions (không ghi đè nếu tệp đã tồn tại):

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
ssh-keygen -t ed25519 -f ~/.ssh/github_actions_deploy -C github-actions-deploy -N ''
cat ~/.ssh/github_actions_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

Nếu ssh-keygen hỏi ghi đè khóa cũ, trả lời `n` và dùng khóa đã có.

Sao chép khóa riêng vào GitHub Secret EC2_SSH_KEY bằng terminal cá nhân, không gửi qua chat hoặc commit:

```bash
cat ~/.ssh/github_actions_deploy
```

Lấy host key ngay từ phiên EC2 tin cậy (không dùng ssh-keyscan trên kết nối chưa xác minh):

```bash
awk '{print "hiep-ai-study.duckdns.org " $1 " " $2}' /etc/ssh/ssh_host_ed25519_key.pub
```

## GitHub Secrets

Repository → Settings → Secrets and variables → Actions → New repository secret:

| Secret | Nội dung |
| --- | --- |
| EC2_HOST | hiep-ai-study.duckdns.org |
| EC2_SSH_KEY | Toàn bộ khóa riêng, gồm BEGIN và END |
| EC2_KNOWN_HOSTS | Dòng host key từ lệnh awk phía trên |

EC2 phải cho phép SSH cổng 22 từ runner GitHub. Quy tắc chỉ cho My IP hoặc EC2 Instance Connect không đủ. Runner ubuntu-latest có IP thay đổi; nếu dùng Source 0.0.0.0/0 cho SSH, cổng SSH sẽ công khai. Chỉ dùng xác thực khóa, không bật đăng nhập mật khẩu. Nếu không muốn mở SSH công khai, cần đổi sang triển khai qua AWS SSM hoặc runner có IP cố định.

Tên miền phải luôn trỏ đúng EC2. Workflow không tự cập nhật DuckDNS khi IP EC2 đổi.

## Điều kiện trên máy chủ

- Node/npm có trong /usr/bin hoặc /usr/local/bin; Docker/PostgreSQL đang chạy.
- Dự án ở /var/www/website-ho-tro-hoc-tap-ai, branch main, origin truy cập được từ EC2.
- Không có chỉnh sửa tracked file trên EC2. Workflow dừng nếu có, không tự xóa chỉnh sửa.
- server/.env đã cấu hình, không được Git theo dõi; workflow giữ nguyên .env và uploads.
- Dịch vụ study-ai hiện tại chạy bằng systemd; ec2-user được sudo không cần mật khẩu cho systemctl restart study-ai và journalctl.

## Đưa workflow lên GitHub

Chạy trên máy lập trình, sau khi đã cấu hình Secrets và kết nối SSH:

```bash
git add .github/workflows/deploy-ec2.yml docs/auto-deploy-ec2.md
git commit -m "Add automatic EC2 deployment"
git push origin main
```

Kiểm tra tab Actions → Deploy EC2. Lần sau commit/push các thay đổi ứng dụng lên main sẽ tự triển khai.

## Kiểm tra và giới hạn

Workflow tuần tự hóa các lần deploy, kiểm tra đúng commit, dừng khi lệnh lỗi và kiểm tra API database sau restart. Không tắt kiểm tra SSH host key. Có thể chạy lại workflow lỗi trong Actions.

Đây là cập nhật ngay trên thư mục đang chạy: npm ci/build/restart có thể gây gián đoạn, lỗi giữa chừng có thể để lại bản cập nhật một phần. Chưa có rollback tự động. Cần sao lưu database và uploads trước thay đổi dữ liệu quan trọng. Health check chưa thay thế kiểm thử đăng nhập, tải tệp và các chức năng nghiệp vụ.

Không cần reload Nginx khi chỉ cập nhật code ứng dụng. Nếu thay đổi server/.env.example, phải cập nhật server/.env tương ứng trên EC2; workflow không tự sao chép cấu hình mẫu.
