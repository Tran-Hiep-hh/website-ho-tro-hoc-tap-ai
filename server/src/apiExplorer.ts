// @ts-nocheck
export const apiExplorerHtml = `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>StudyAI API Explorer</title>
    <link rel="stylesheet" href="/api-explorer.css">
  </head>
  <body>
    <main>
      <header>
        <p class="eyebrow">LOCAL DEVELOPMENT</p>
        <h1>StudyAI API Explorer</h1>
        <p>Chọn một API, nhập dữ liệu và gửi request trực tiếp tới backend đang chạy trên localhost.</p>
        <p class="sample-note"><strong>Dữ liệu mẫu đã được điền sẵn.</strong> Bạn chỉ cần thay email, mật khẩu, ID hoặc các giá trị trong ô nhập bằng dữ liệu thật rồi bấm gửi.</p>
      </header>
      <section class="auth panel">
        <label for="token">Access token (tùy chọn)</label>
        <input id="token" type="password" placeholder="Dán accessToken sau khi đăng nhập">
        <p>API yêu cầu đăng nhập sẽ dùng token này và cookie phiên hiện tại.</p>
      </section>
      <section id="endpoints"></section>
      <section class="panel result-panel">
        <div class="result-heading"><h2>Kết quả</h2><button id="clear" type="button">Xóa</button></div>
        <pre id="result">Chưa có request nào.</pre>
      </section>
    </main>
    <script src="/api-explorer.js"></script>
  </body>
</html>`;

export const apiExplorerScript = `
const endpoints = [
  ["Sức khỏe", "GET", "/api/health", "", false],
  ["Sức khỏe database", "GET", "/api/health/database", "", false],
  ["Đăng ký", "POST", "/api/auth/register", '{"fullName":"Nguyen Van A","email":"a@example.com","password":"Password123","confirmPassword":"Password123","role":"STUDENT"}', false],
  ["Đăng nhập", "POST", "/api/auth/login", '{"email":"a@example.com","password":"Password123"}', false],
  ["Làm mới phiên", "POST", "/api/auth/refresh", "{}", false],
  ["Đăng xuất", "POST", "/api/auth/logout", "{}", false],
  ["Thông tin tài khoản", "GET", "/api/auth/me", "", true],
  ["Cập nhật hồ sơ", "PUT", "/api/auth/profile", '{"fullName":"Nguyen Van B"}', true],
  ["Đổi mật khẩu", "POST", "/api/auth/password", '{"currentPassword":"Password123","newPassword":"NewPassword123"}', true],
  ["Danh sách tài liệu", "GET", "/api/documents", "", true],
  ["Tải tài liệu", "POST", "/api/documents", "", true],
  ["Chi tiết tài liệu", "GET", "/api/documents/1", "", true],
  ["Tải file tài liệu", "GET", "/api/documents/1/download", "", true],
  ["Xóa tài liệu", "DELETE", "/api/documents/1", "", true],
  ["Tạo Quiz bằng AI", "POST", "/api/quizzes/generate", '{"title":"Quiz mẫu","quantity":5,"difficulty":"EASY","sources":[]}', true],
  ["Danh sách Quiz cá nhân", "GET", "/api/quizzes", "", true],
  ["Lịch sử Quiz", "GET", "/api/quizzes/attempts", "", true],
  ["Tạo Quiz", "POST", "/api/quizzes", '{"title":"Quiz mẫu","difficulty":"EASY","sources":[],"questions":[]}', true],
  ["Cập nhật Quiz", "PUT", "/api/quizzes/1", '{"title":"Quiz đã sửa","versionId":"1","questions":[{"text":"Thủ đô của Việt Nam là gì?","options":["Hà Nội","Huế","Đà Nẵng","TP. Hồ Chí Minh"],"answer":0,"explanation":"Hà Nội là thủ đô Việt Nam.","source":""}]}', true],
  ["Xóa Quiz", "DELETE", "/api/quizzes/1", "", true],
  ["Bắt đầu Quiz cá nhân", "POST", "/api/quizzes/1/attempts", "{}", true],
  ["Nộp Quiz cá nhân", "POST", "/api/quizzes/attempts/1/submit", '{"answers":[0],"revision":0}', true],
  ["Danh sách học liệu", "GET", "/api/study-materials", "", true],
  ["Tạo học liệu", "POST", "/api/study-materials", '{"title":"Học liệu mẫu","type":"FLASHCARD","cards":[]}', true],
  ["Cập nhật học liệu", "PUT", "/api/study-materials/1", '{"title":"Học liệu đã sửa","revision":1,"cards":[{"front":"CPU là gì?","back":"Bộ xử lý trung tâm.","keyword":"CPU"}]}', true],
  ["Cập nhật tiến độ Flashcard", "PUT", "/api/study-materials/1/progress", '{"cardId":"1","remembered":true,"revision":1}', true],
  ["Xóa học liệu", "DELETE", "/api/study-materials/1", "", true],
  ["Danh sách lớp", "GET", "/api/classes", "", true],
  ["Tra cứu mã lớp", "POST", "/api/classes/lookup", '{"joinCode":"ABC123"}', true],
  ["Tạo lớp", "POST", "/api/classes", '{"name":"Lớp 10A1","description":"Lớp học"}', true],
  ["Cập nhật lớp", "PUT", "/api/classes/1", '{"name":"Lớp 10A1","description":"Lớp học mẫu"}', true],
  ["Tham gia lớp", "POST", "/api/classes/1/join", "{}", true],
  ["Hủy yêu cầu tham gia", "DELETE", "/api/classes/1/requests/1", "", true],
  ["Duyệt/từ chối yêu cầu", "POST", "/api/classes/1/requests/1", '{"status":"APPROVED"}', true],
  ["Xóa thành viên", "DELETE", "/api/classes/1/members/1", "", true],
  ["Rời lớp", "POST", "/api/classes/1/leave", "{}", true],
  ["Chia sẻ tài liệu", "POST", "/api/classes/1/materials", '{"documentId":"1"}', true],
  ["Bỏ chia sẻ tài liệu", "DELETE", "/api/classes/1/materials/1", "", true],
  ["Xóa lớp", "DELETE", "/api/classes/1", "", true],
  ["Danh sách bài Quiz được giao", "GET", "/api/assignments", "", true],
  ["Tạo bài Quiz giao", "POST", "/api/assignments", '{"classId":"1","contentId":"1","versionId":"1","title":"Bài kiểm tra mẫu","startAt":"2027-01-01T00:00:00.000Z","dueAt":"2027-12-31T23:59:59.000Z","maxAttempts":1,"showAnswers":false,"shuffleQuestions":true,"status":"PUBLISHED"}', true],
  ["Cập nhật bài giao", "PUT", "/api/assignments/1", '{"title":"Bài kiểm tra đã sửa","versionId":"1","questions":[{"text":"2 + 2 bằng bao nhiêu?","options":["3","4","5","6"],"answer":1,"explanation":"2 + 2 = 4","source":""}],"startAt":"2027-01-01T00:00:00.000Z","dueAt":"2027-12-31T23:59:59.000Z","maxAttempts":1,"showAnswers":false,"shuffleQuestions":true}', true],
  ["Xóa bài giao", "DELETE", "/api/assignments/1", "", true],
  ["Đổi trạng thái bài giao", "POST", "/api/assignments/1/status", '{"status":"PUBLISHED"}', true],
  ["Bắt đầu/tiếp tục bài giao", "POST", "/api/assignments/1/attempts", "{}", true],
  ["Lưu một đáp án", "PUT", "/api/assignments/attempts/1/answers", '{"questionId":"1","answer":0,"revision":0}', true],
  ["Nộp bài giao", "POST", "/api/assignments/attempts/1/submit", '{"answers":[0],"revision":0}', true],
  ["Danh sách thông báo", "GET", "/api/notifications", "", true],
  ["Đánh dấu thông báo đã đọc", "PUT", "/api/notifications/:id/read", "{}", true],
  ["Đánh dấu thông báo đến mốc đã đọc", "PUT", "/api/notifications/read", '{"throughId":"1"}', true],
];

const endpointRoot = document.querySelector("#endpoints");
const result = document.querySelector("#result");
const token = document.querySelector("#token");
token.value = sessionStorage.getItem("api-explorer-token") ?? "";
token.addEventListener("input", () => sessionStorage.setItem("api-explorer-token", token.value));

for (const [label, method, path, sample, auth] of endpoints) {
  const card = document.createElement("article");
  card.className = "endpoint panel";
  card.innerHTML = \`
    <button class="endpoint-toggle" type="button" aria-expanded="false">
      <span class="endpoint-heading">
        <span><span class="method \${method.toLowerCase()}">\${method}</span><code>\${path}</code></span>
        <span class="endpoint-meta"><span class="auth-label">\${auth ? "Cần đăng nhập" : "Công khai"}</span><span class="chevron">⌄</span></span>
      </span>
      <strong>\${label}</strong>
    </button>
    <div class="endpoint-body" hidden>
    <div class="endpoint-heading endpoint-path-heading">
      <div><span class="method \${method.toLowerCase()}">\${method}</span><code>\${path}</code></div>
      <span class="auth-label">\${auth ? "Cần đăng nhập" : "Công khai"}</span>
    </div>
    <label>Đường dẫn <span>(có thể thay :id bằng ID thật)</span></label>
    <input class="path" value="\${path}">
    <label>JSON body <span>(để trống nếu không dùng)</span></label>
    <textarea placeholder='{"key":"value"}'>\${sample}</textarea>
    <button class="send-request" type="button">Gửi request</button>
    <pre class="request-result">Chưa gửi request.</pre>
    </div>
  \`;
  const toggle = card.querySelector(".endpoint-toggle");
  const endpointBody = card.querySelector(".endpoint-body");
  const body = card.querySelector("textarea");
  const pathInput = card.querySelector(".path");
  const button = card.querySelector(".send-request");
  const requestResult = card.querySelector(".request-result");
  toggle.addEventListener("click", () => {
    const expanded = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!expanded));
    endpointBody.hidden = expanded;
  });
  button.addEventListener("click", async () => {
    button.disabled = true;
    button.textContent = "Đang gửi...";
    requestResult.textContent = "Đang gửi request...";
    result.textContent = "Đang gửi request...";
    try {
      const headers = {};
      if (token.value.trim()) headers.Authorization = "Bearer " + token.value.trim();
      const request = { method, headers, credentials: "include" };
      if (body.value.trim() && method !== "GET") {
        headers["Content-Type"] = "application/json";
        request.body = body.value;
      }
      const response = await fetch(pathInput.value.trim(), request);
      const text = await response.text();
      let payload;
      try { payload = JSON.parse(text); } catch { payload = text; }
      if (payload && payload.accessToken) {
        token.value = payload.accessToken;
        sessionStorage.setItem("api-explorer-token", payload.accessToken);
      }
      const output = \`\${response.status} \${response.statusText}\\\\n\\\\n\${typeof payload === "string" ? payload : JSON.stringify(payload, null, 2)}\`;
      requestResult.textContent = output;
      result.textContent = output;
      requestResult.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (error) {
      const output = \`Request failed\\\\n\\\\n\${error.message}\`;
      requestResult.textContent = output;
      result.textContent = output;
    } finally {
      button.disabled = false;
      button.textContent = "Gửi request";
    }
  });
  endpointRoot.append(card);
}

document.querySelector("#clear").addEventListener("click", () => { result.textContent = "Chưa có request nào."; });
`;

export const apiExplorerCss = `
:root { color-scheme: light; font-family: "Segoe UI", Arial, sans-serif; color: #172033; background: #f4f7fb; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
* { box-sizing: border-box; }
body { margin: 0; line-height: 1.5; }
main { max-width: 1100px; margin: 0 auto; padding: 40px 20px 64px; }
header { margin-bottom: 28px; }
h1 { margin: 4px 0 8px; font-size: clamp(2rem, 5vw, 3.2rem); }
h2 { margin: 12px 0; font-size: 1.1rem; }
p { color: #5c667a; line-height: 1.55; }
.eyebrow { margin: 0; color: #3b63d3; font-size: .75rem; font-weight: 800; letter-spacing: .12em; }
.sample-note { max-width: 760px; padding: 12px 14px; border: 1px solid #c8d8ff; border-radius: 9px; background: #edf3ff; color: #36518b; }
.panel { background: white; border: 1px solid #dfe5ef; border-radius: 14px; box-shadow: 0 5px 18px #2434540b; padding: 18px; }
.auth { margin-bottom: 20px; }
label { display: block; color: #354057; font-size: .86rem; font-weight: 700; margin-bottom: 7px; }
label span, .auth p { color: #7a8497; font-weight: 400; }
input, textarea { width: 100%; border: 1px solid #cbd3e1; border-radius: 8px; padding: 10px 12px; font: inherit; color: #172033; background: #fff; }
input::placeholder, textarea::placeholder { color: #7a8497; opacity: 1; }
textarea { min-height: 70px; resize: vertical; font-family: Consolas, "Courier New", monospace; font-size: .86rem; line-height: 1.5; }
button { border: 0; border-radius: 8px; padding: 10px 15px; color: white; background: #315bd5; cursor: pointer; font: inherit; font-weight: 700; }
button:disabled { cursor: wait; opacity: .6; }
#endpoints { display: grid; gap: 14px; }
.endpoint-heading, .result-heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.endpoint-toggle { display: block; width: 100%; padding: 0; color: #172033; background: transparent; text-align: left; font-family: inherit; }
.endpoint-toggle:hover { background: transparent; }
.endpoint-toggle strong { display: block; margin-top: 12px; font-size: 1.05rem; }
.endpoint-meta { display: inline-flex; align-items: center; gap: 12px; }
.chevron { color: #315bd5; font-size: 1.3rem; transition: transform .2s ease; }
.endpoint-toggle[aria-expanded="true"] .chevron { transform: rotate(180deg); }
.endpoint-body { margin-top: 18px; padding-top: 18px; border-top: 1px solid #e6eaf1; }
.endpoint-path-heading { margin-bottom: 14px; }
.method { display: inline-block; min-width: 54px; margin-right: 10px; border-radius: 5px; padding: 4px 7px; color: white; font-size: .75rem; font-weight: 800; text-align: center; }
.get { background: #198754; } .post { background: #db8b16; } .put { background: #6950c7; } .delete { background: #c23b4a; }
code { color: #263451; font-family: Consolas, "Courier New", monospace; font-size: .9rem; }
.auth-label { color: #bd6e0b; font-size: .78rem; font-weight: 700; }
.endpoint textarea { margin-bottom: 10px; }
.request-result { margin: 12px 0 0; max-height: 220px; min-height: 56px; overflow: auto; padding: 10px; border-radius: 8px; background: #172033; color: #d7e1f5; white-space: pre-wrap; font-size: .82rem; }
.result-panel { margin-top: 20px; }
.result-heading { margin-bottom: 10px; } .result-heading h2 { margin: 0; }
.result-heading button { background: #697386; padding: 6px 10px; }
pre { min-height: 130px; max-height: 520px; overflow: auto; margin: 0; padding: 14px; border-radius: 8px; background: #172033; color: #d7e1f5; white-space: pre-wrap; }
`;
