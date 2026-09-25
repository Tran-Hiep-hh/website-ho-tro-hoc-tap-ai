from pathlib import Path
from xml.sax.saxutils import escape
import re, math, zipfile
import xml.etree.ElementTree as E

ROOT=Path(__file__).resolve().parents[2]
OUT=Path(__file__).parent/'thiet-ke-api-he-thong-ai-ho-tro-hoc-tap.xlsx'
rows=[]
AUTH='requireAuth; Cache-Control: no-store'
MUT=AUTH+'; protectAuthMutation'
OK='200: { success: true }'
NONE='Không có req.body.'
EMPTY='{} (JSON)'
SET='title: string 1–150; difficulty: "Dễ"|"Trung bình"|"Khó"; sources: ID[1..10]; contentRequest?: string ≤3000.'
GEN='generationMode?: "MOCK"|"DEEPSEEK"|"OPENROUTER"; generationModel?: string (lưu tối đa 150 ký tự).'
AIERR='400: thiết lập/nguồn sai; 422: nguồn không đủ nội dung; 502: lỗi dịch vụ hoặc kết quả AI; 503: cấu hình AI sai/thiếu; 504: AI quá thời gian.'
ASSIGN='title: string 1–150; startAt, dueAt: datetime; maxAttempts: integer 1..10; showAnswers: boolean; durationMinutes?: integer 1..1440 | null.'
ANS='answers: integer[] đủ số câu, theo thứ tự câu hỏi; -1 = bỏ trống, 0..3 = chỉ số phương án.'

def add(desc,method,path,body,out,mw,err,notes=''):
    rows.append([router,base+('' if path=='/' else path),desc,method,body,out,mw,err,notes])

router='index.js';base='/api'
add('Kiểm tra API','GET','/health',NONE,'200: { success: true, message: string }','Middleware chung','500: lỗi hệ thống.','Công khai, không yêu cầu đăng nhập.')
add('Kiểm tra kết nối PostgreSQL','GET','/health/database',NONE,'200: { success: true, message: string, database: { current_time: datetime } }','Middleware chung','500: không kết nối/truy vấn được database.','Công khai, chỉ kiểm tra kết nối.')

router='authRoutes.js';base='/api/auth'
add('Đăng ký tài khoản','POST','/register','fullName: string 2..100; email: string hợp lệ ≤255; password: string ≥8 ký tự, ≤72 byte UTF-8; confirmPassword: trùng password; role: "TEACHER"|"STUDENT".','201: { success: true, message: string, user: User }','protectAuthMutation; authRateLimit(20/15 phút); no-store','400: dữ liệu sai (errors theo trường); 409: email đã tồn tại.','Email chuẩn hóa chữ thường; không tự đăng nhập sau đăng ký.')
add('Đăng nhập','POST','/login','email: string hợp lệ ≤255; password: string không rỗng, ≤72 byte UTF-8.','200: { success: true, user: User, accessToken: string }','protectAuthMutation; authRateLimit(30/15 phút); no-store','400: dữ liệu sai; 401: email/mật khẩu sai hoặc thông tin vừa thay đổi; 403: tài khoản không ACTIVE.','Đặt cookie study_ai_refresh; refresh token không trả trong JSON.')
add('Làm mới phiên','POST','/refresh',EMPTY+'; cookie study_ai_refresh.','200: { success: true, user: User, accessToken: string }','protectAuthMutation; authRateLimit(120/phút); no-store','401: token thiếu, sai, hết hạn hoặc phiên không còn hiệu lực.','Không cần access token; thay refresh token và cookie sau mỗi lần dùng.')
add('Đăng xuất','POST','/logout',EMPTY+'; cookie refresh và/hoặc Bearer access token.','200: { success: true, message: string }','protectAuthMutation; no-store','Lỗi middleware chung; 500: thu hồi phiên thất bại.','Không requireAuth. Token thiếu/sai vẫn có thể trả thành công. Thu hồi phiên nhận diện được và xóa cookie; giữ phiên khác.')
add('Thông tin tài khoản hiện tại','GET','/me',NONE,'200: { success: true, user: User }',AUTH,'401/403/500: xem quy ước chung.','Không trả mật khẩu/bản băm.')
add('Cập nhật họ tên','PUT','/profile','{ fullName: string 2..100 }; chỉ chấp nhận fullName.','200: { success: true, user: User }',MUT,'400: họ tên sai hoặc gửi trường khác; 403: tài khoản không còn hoạt động.','Email và vai trò chỉ đọc.')
add('Đổi mật khẩu','POST','/password','currentPassword, newPassword, confirmPassword: string. Mật khẩu mới ≥8 ký tự, ≤72 byte UTF-8, khác mật khẩu cũ, khớp xác nhận.','200: { success: true, message: string }',MUT+'; authRateLimit(10/15 phút)','400: dữ liệu/mật khẩu cũ sai; 403: tài khoản không ACTIVE; 409: mật khẩu/tài khoản thay đổi đồng thời.','Thu hồi tất cả phiên và xóa cookie; yêu cầu đăng nhập lại.')

router='documentRoutes.js';base='/api/documents'
add('Danh sách tài liệu cá nhân','GET','/',NONE,'200: { success: true, documents: Document[] }',AUTH,'401/403/500: lỗi chung.','Chỉ tài liệu của mình chưa DELETED; không nhận query lọc/phân trang.')
add('Tải tài liệu lên','POST','/','multipart/form-data: file (1 tệp PDF/DOCX/TXT); không nhận trường văn bản bổ sung.','201: { success: true, document: Document }',AUTH+'; authRateLimit(30/15 phút); multer.single("file")','400: thiếu/rỗng/sai loại tệp, tên quá 255 hoặc vượt giới hạn upload; 422: không đọc được, sai mã hóa/bảo vệ mật khẩu hoặc văn bản quá 2.000.000 ký tự.','Dung lượng cấu hình maxFileSizeMb, mặc định 10 MB. Văn bản có nội dung → READY; đọc được nhưng rỗng → FAILED và 201. Lỗi trích xuất 422 chưa lưu. Router này không gắn protectAuthMutation.')
add('Chi tiết tài liệu','GET','/:id',NONE,'200: { success: true, document: Document }',AUTH,'404: mã sai, không tồn tại/đã xóa hoặc không có quyền.','Path id: mã tài liệu. Chủ sở hữu hoặc thành viên ACTIVE của lớp ACTIVE đang chia sẻ được xem.')
add('Tải tệp gốc xuống','GET','/:id/download',NONE,'200: dữ liệu nhị phân của tệp; không phải JSON.',AUTH,'404: không có quyền, không có bản ghi/tệp; 500: lỗi gửi tệp.','Path id: mã tài liệu. Content-Disposition: attachment. Lỗi sau khi gửi header có thể làm gián đoạn tải thay vì JSON.')
add('Xóa tài liệu','DELETE','/:id','Không yêu cầu body.',OK,AUTH,'404: không tồn tại/không thuộc sở hữu; 409: tài liệu còn chia sẻ trong lớp.','Path id: mã tài liệu. Đánh dấu DELETED, xóa văn bản và gỡ tệp; giữ tham chiếu nguồn của học liệu đã tạo.')

router='quizRoutes.js';base='/api/quizzes'
add('Tạo Quiz AI để xem trước','POST','/generate',SET+' quantity?: integer 1..20 (mặc định 5).','200: { success: true, content: GeneratedPreview }',MUT+'; authRateLimit(30/15 phút)',AIERR,'Chưa lưu database; nguồn phải thuộc mình, READY và có văn bản. Có thể dùng MOCK tùy cấu hình.')
add('Danh sách Quiz cá nhân','GET','/',NONE,'200: { success: true, contents: QuizContent[] }',AUTH,'401/403/500: lỗi chung.','Chỉ Quiz chưa xóa của mình; lấy phiên bản gốc mới nhất, không lấy assignment_only.')
add('Lịch sử tự luyện','GET','/attempts',NONE,'200: { success: true, attempts: PersonalResult[] }',AUTH,'401/403/500: lỗi chung.','Chỉ lượt SUBMITTED với assignment_id=NULL của tài khoản.')
add('Lưu Quiz','POST','/',SET+' questions: QuestionInput[1..50]. '+GEN,'201: { success: true, content: QuizContent }',MUT,'400: thiết lập, câu hỏi hoặc nguồn sai.','Lưu trạng thái READY, phiên bản đầu tiên và liên kết nguồn; không gọi lại AI.')
add('Chỉnh sửa Quiz gốc','PUT','/:id','{ title: string 1..150, versionId: ID, questions: QuestionInput[1..50] }','200: { success: true, content: QuizContent }',MUT,'400: nội dung sai; 404: Quiz không thuộc mình/không tồn tại; 409: versionId đã cũ.','Path id: mã Quiz. Tạo phiên bản mới; giữ đề/kết quả lượt cũ và bài đã giao.')
add('Xóa Quiz gốc','DELETE','/:id',EMPTY,OK,MUT,'404: không có quyền/không tồn tại.','Path id: mã Quiz. Xóa kết quả tự luyện, đánh dấu Quiz DELETED; giữ bài giao và kết quả lớp.')
add('Bắt đầu/tiếp tục tự luyện','POST','/:id/attempts',EMPTY,'200: { success: true, attempt: { id, title, questions: SafeQuestion[] } }',MUT,'404: Quiz không thuộc mình/không tồn tại.','Path id: mã Quiz. Tái sử dụng lượt IN_PROGRESS của phiên bản gốc mới nhất hoặc tạo mới. Không tự lưu lựa chọn chưa nộp.')
add('Nộp Quiz cá nhân','POST','/attempts/:id/submit',ANS,'200: { success: true, attempt: PersonalResult }',MUT,'400: mảng đáp án sai; 404: không có lượt tự luyện thuộc tài khoản.','Path id: mã lượt làm. Chấm theo phiên bản đề; gửi lại lượt đã nộp trả kết quả cũ.')

router='studyRoutes.js';base='/api/study-materials'
add('Danh sách Flashcard/Mindmap','GET','/',NONE,'200: { success: true, contents: StudyContent[] }',AUTH,'401/403/500: lỗi chung.','Học liệu cá nhân chưa xóa; kèm tiến độ Flashcard. Không có GET /:id riêng.')
add('Tạo Flashcard/Mindmap AI','POST','/generate','type: "FLASHCARD"|"MINDMAP"; '+SET+' quantity?: integer 1..20 (mặc định 6); detail?: "overview"|"detailed" (mặc định detailed).','200: { success: true, content: GeneratedPreview }',MUT+'; authRateLimit(30/15 phút)',AIERR,'Chưa lưu. Flashcard dùng quantity; Mindmap dùng detail. Handler vẫn kiểm tra cả hai nếu được truyền.')
add('Lưu Flashcard/Mindmap','POST','/','type: "FLASHCARD"|"MINDMAP"; '+SET+' cards: CardInput[1..50] hoặc nodes: NodeInput[1..30] theo loại. '+GEN,'201: { success: true, content: StudyContent }',MUT,'400: thiết lập, nguồn, thẻ hoặc cấu trúc cây sai.','Thẻ mới không gửi id. Mã nút đầu vào được ánh xạ sang mã database.')
add('Chỉnh sửa bộ thẻ/sơ đồ','PUT','/:id','title: string 1..150; revision: integer hiện tại; cards hoặc nodes theo loại.','200: { success: true, content: StudyContent }',MUT,'400: nội dung sai; 404: không thuộc mình/không tồn tại; 409: revision đã cũ.','Path id: mã học liệu. Giữ id thẻ cũ, bỏ id thẻ mới; sửa front/back đặt lại tiến độ riêng thẻ đó. Tăng revision.')
add('Lưu tiến độ ôn Flashcard','PUT','/:id/progress','{ revision: integer, cardId: ID, remembered: boolean }','200: { success: true, content: StudyContent }',MUT,'400: không phải Flashcard/dữ liệu sai; 404: không có quyền hoặc thẻ không thuộc bộ; 409: bộ thẻ đã đổi.','Path id: mã bộ thẻ. TRUE=đã nhớ, FALSE=cần ôn. learned trong output là chỉ số thẻ, không phải cardId.')
add('Xóa Flashcard/Mindmap','DELETE','/:id',EMPTY,OK,MUT,'404: không có quyền/không tồn tại; 409: còn liên kết class_materials cũ.','Path id: mã học liệu. Hiện đánh dấu DELETED; không trực tiếp xóa thẻ/nút/tiến độ. Chia sẻ lớp mới chỉ nhận tài liệu nguồn.')

router='classRoutes.js';base='/api/classes'
add('Danh sách lớp và dữ liệu liên quan','GET','/',NONE,'200: { success: true, classes: Classroom[], members: Member[], requests: JoinRequest[], documents: Document[] }',AUTH,'401/403/500: lỗi chung.','Lớp sở hữu/đã tham gia/đang chờ. requests chỉ cho chủ lớp; người đang chờ không nhận thành viên và tài liệu lớp.')
add('Tra cứu lớp bằng mã','POST','/lookup','{ code: string không rỗng, ≤20 }','200: { success: true, classroom: ClassroomBasic }',MUT+'; authRateLimit(30/15 phút)','400: mã sai; 403: không phải STUDENT; 404: không có lớp ACTIVE theo mã.','Chưa gửi yêu cầu tham gia; code được chuyển chữ hoa.')
add('Tạo lớp học','POST','/','name: string 1..100; group?: string ≤100; description?: string ≤1000.','201: { success: true, id: ID }',MUT,'400: dữ liệu sai; 403: không phải TEACHER; 503: không tạo được mã duy nhất sau các lần thử.','Tự sinh mã lớp; teacherId lấy từ phiên. group/description mặc định chuỗi rỗng.')
add('Cập nhật lớp','PUT','/:id','name: string 1..100; group?: string ≤100; description?: string ≤1000.',OK,MUT,'400: dữ liệu sai; 403: không phải TEACHER; 404: không có lớp thuộc quyền quản lý.','Path id: mã lớp. Giữ mã tham gia. Bỏ group/description sẽ dùng chuỗi rỗng.')
add('Gửi yêu cầu tham gia','POST','/:id/join','{ code: string không rỗng, ≤20 }','201: { success: true }',MUT+'; authRateLimit(30/15 phút)','400: mã sai định dạng; 403: không phải STUDENT; 404: lớp/mã không hợp lệ; 409: đã tham gia hoặc đã có PENDING.','Path id: mã lớp. Tạo yêu cầu PENDING và thông báo giáo viên.')
add('Hủy yêu cầu tham gia','DELETE','/:id/requests/:requestId',EMPTY,OK,MUT,'403: không phải STUDENT; 404: mã/lớp không hợp lệ; 409: không còn PENDING hoặc không thuộc người gửi.','Path id: mã lớp; requestId: mã yêu cầu. Chỉ hủy yêu cầu của mình; chuyển CANCELLED.')
add('Duyệt/từ chối yêu cầu','POST','/:id/requests/:requestId','{ approve: boolean }',OK,MUT,'400: requestId/approve sai; 403: không phải TEACHER; 404: lớp không thuộc mình; 409: yêu cầu đã xử lý/không thuộc lớp.','Path id: mã lớp; requestId: mã yêu cầu. TRUE→APPROVED, thành viên ACTIVE; FALSE→REJECTED; thông báo người học.')
add('Xóa thành viên','DELETE','/:id/members/:memberId',EMPTY,OK,MUT,'403: không phải TEACHER; 404: không có quyền/thành viên ACTIVE; 409: lớp có Quiz đang mở.','Path id: mã lớp; memberId là membership_id, không phải userId. Chuyển REMOVED, giữ kết quả.')
add('Rời lớp học','POST','/:id/leave',EMPTY,OK,MUT,'403: không phải STUDENT; 404: lớp/quan hệ ACTIVE không tồn tại; 409: lớp có Quiz đang mở.','Path id: mã lớp. Chuyển LEFT, giữ lịch sử; mất quyền tài liệu và bắt đầu bài giao.')
add('Chia sẻ tài liệu cho lớp','POST','/:id/materials','{ documentIds: ID[1..50] }; không nhận contentIds.',OK,MUT,'400: danh sách/nguồn sai, không thuộc mình hoặc không READY/FAILED; 403: không phải TEACHER; 404: lớp không thuộc mình.','Path id: mã lớp. Chỉ PDF/DOCX/TXT. Bỏ qua liên kết trùng; chỉ thông báo nếu thêm mới. Chia sẻ lại vẫn trả 200.')
add('Gỡ tài liệu khỏi lớp','DELETE','/:id/materials/:documentId',EMPTY,OK,MUT,'403: không phải TEACHER; 404: mã/lớp sai hoặc không thuộc mình.','Path id: mã lớp; documentId: mã tài liệu. Giữ tệp gốc; liên kết đã gỡ vẫn trả thành công khi quyền lớp hợp lệ.')
add('Xóa lớp học','DELETE','/:id',EMPTY,OK,MUT,'403: không phải TEACHER; 404: lớp không tồn tại/không thuộc quản lý.','Path id: mã lớp. Cho phép khi Quiz đang mở; đánh dấu lớp DELETED, hủy/xóa bài giao và xóa lượt làm/đáp án/điểm. Giữ tài liệu/Quiz gốc.')

router='assignmentRoutes.js';base='/api/assignments'
add('Danh sách bài giao và kết quả','GET','/',NONE,'200: { success: true, assignments: Assignment[], attempts: AssignedResult[], classAttempts: AssignedResult[] }',AUTH,'401/403/500: lỗi chung.','Giáo viên: lớp mình; học sinh: bài PUBLISHED của lớp ACTIVE đã tham gia. attempts: của mình; classAttempts: lớp mình quản lý. Có xử lý hoàn tất lượt hết hạn khi truy cập.')
add('Tạo bài giao/lưu nháp','POST','/','classId, contentId, versionId: ID; '+ASSIGN+' status: "DRAFT"|"PUBLISHED".','201: { success: true, id: ID }',MUT,'400: đề/thiết lập sai, dueAt không sau startAt/hiện tại; 403: không phải TEACHER; 404: lớp/Quiz ngoài quyền; 409: versionId cũ.','Cố định phiên bản Quiz. Chỉ PUBLISHED tạo thông báo; durationMinutes bỏ qua/null chỉ dùng hạn nộp.')
add('Chỉnh sửa bản nháp','PUT','/:id','versionId: ID hiện tại; '+ASSIGN+' questions: QuestionInput[1..50].',OK,MUT,'400: thiết lập/câu hỏi sai; 403: không phải TEACHER; 404: ngoài quyền/đã xóa; 409: không DRAFT hoặc versionId cũ.','Path id: mã bài giao. Tạo phiên bản assignment_only, không sửa Quiz gốc; không tự công bố. Tải lại danh sách để nhận versionId mới.')
add('Xóa bài giao','DELETE','/:id',EMPTY,OK,MUT,'403: không phải TEACHER; 404: bài/lớp không tồn tại hoặc ngoài quyền.','Path id: mã bài giao. Xóa lượt làm/đáp án/điểm, đặt CANCELLED/deleted_at; giữ Quiz gốc. Không chặn khi đang mở.')
add('Công bố/hủy bài giao','POST','/:id/status','{ status: "PUBLISHED"|"CANCELLED" }',OK,MUT,'403: không phải TEACHER; 404: ngoài quyền/đã xóa; 409: chuyển trạng thái không hợp lệ.','Path id: mã bài giao. Chỉ công bố DRAFT chưa hết hạn. Hủy giữ kết quả; không chuyển về DRAFT bằng endpoint này.')
add('Bắt đầu/tiếp tục bài giao','POST','/:id/attempts',EMPTY,'200: { success: true, attempt: AssignedStart }; hoặc { success: true, attempt: { submitted: true, result: AssignedResult } }',MUT,'403: không phải STUDENT; 404: không có quyền/thành viên ACTIVE; 409: chưa mở, quá hạn, đã hủy hoặc hết lượt.','Path id: mã bài giao. Tiếp tục IN_PROGRESS không dùng thêm lượt. Nếu lượt hết thời lượng nhưng bài giao chưa hết hạn, trả nhánh submitted/result.')
add('Lưu đáp án bài giao','PUT','/attempts/:id/answers','revision: integer hiện tại; '+ANS,'200: { success: true, submitted: false, revision: integer }; hoặc { success: true, submitted: true, attempt: AssignedResult }',MUT,'400: đáp án sai; 403: không phải STUDENT; 404: lượt ngoài quyền/mất tư cách thành viên; 409: bài không mở/đã hủy hoặc revision cũ.','Path id: mã lượt làm. Nếu hết giờ, chỉ chấm đáp án đã lưu; không nhận lựa chọn mới. Lưu thành công tăng revision.')
add('Nộp bài giao','POST','/attempts/:id/submit','revision: integer hiện tại; '+ANS,'200: { success: true, submitted: true, attempt: AssignedResult }',MUT,'400: đáp án sai; 403: không phải STUDENT; 404: không có quyền/lượt; 409: bài hủy/chưa mở hoặc revision cũ.','Path id: mã lượt làm. Nộp lại lượt SUBMITTED trả kết quả cũ. Máy chủ chấm điểm; đáp án/giải thích phụ thuộc showAnswers.')

router='notificationRoutes.js';base='/api/notifications'
add('Danh sách thông báo','GET','/',NONE,'200: { success: true, notifications: Notification[] }',AUTH,'401/403/500: lỗi chung.','Chỉ thông báo của mình, mới nhất trước. Giao diện tự lọc chưa đọc.')
add('Đánh dấu tất cả đến mốc đã tải','PUT','/read','{ throughId: ID }',OK,MUT,'400: throughId không hợp lệ.','Mốc thông báo mới nhất đã tải; chỉ cập nhật thông báo của mình có id ≤ throughId. Thông báo mới hơn giữ chưa đọc.')
add('Đánh dấu một thông báo đã đọc','PUT','/:id/read',EMPTY,OK,MUT,'404: id sai hoặc thông báo không thuộc mình.','Path id: mã thông báo. Gọi lại vẫn thành công nếu bản ghi thuộc mình.')

mounts={'index.js':'/api','authRoutes.js':'/api/auth','documentRoutes.js':'/api/documents','quizRoutes.js':'/api/quizzes','studyRoutes.js':'/api/study-materials','classRoutes.js':'/api/classes','assignmentRoutes.js':'/api/assignments','notificationRoutes.js':'/api/notifications'}
actual=set()
for f,p in mounts.items():
    for method,path in re.findall(r'router\.(get|post|put|delete)\("([^"]+)"',(ROOT/'server/src/routes'/f).read_text(encoding='utf-8')):
        actual.add((f,method.upper(),p+('' if path=='/' else path)))
listed={(r[0],r[3],r[1]) for r in rows}
assert actual==listed,{'missing':actual-listed,'extra':listed-actual}
assert len(rows)==len(listed)

rules=[
'Phạm vi: hợp đồng API theo mã nguồn hiện tại, không phải kết quả kiểm thử HTTP. Router là tên file trong server/src/routes; Endpoint là đường dẫn đầy đủ tính từ /api. Không thêm endpoint chưa triển khai.',
'Ký hiệu: ID là mã BIGINT dạng chuỗi thập phân dương; nên gửi chuỗi để tránh mất chính xác JavaScript. datetime là ngày giờ dạng chuỗi có múi giờ. Dấu ? là trường tùy chọn/có thể không có trong JSON. Path params nằm trong Notes; cookie/header không thuộc req.body.',
'Middleware chung: helmet; cors(origin=CLIENT_URL, credentials=true); express.json(limit="1mb"); express.urlencoded({extended:true}); notFound và errorHandler. JSON sai: 400; vượt giới hạn JSON: 413; route không tồn tại: 404; lỗi hệ thống: 500.',
'requireAuth: Authorization: Bearer <accessToken>. Thiếu/sai/hết hạn/phiên thu hồi: 401; tài khoản không ACTIVE: 403. Các lỗi này áp dụng mọi dòng có requireAuth.',
'protectAuthMutation: Origin (nếu có) phải khớp CLIENT_URL, sai trả 403; Content-Type phải application/json, sai trả 415. Body rỗng vẫn gửi {}. Router documents không gắn middleware này; upload dùng multipart/form-data.',
'authRateLimit: đếm theo IP trong bộ nhớ mỗi middleware; vượt mức trả 429 kèm Retry-After. Ví dụ 30/15 phút = 30 yêu cầu trong 15 phút. Áp dụng mọi dòng có middleware giới hạn.',
'Cookie study_ai_refresh: HttpOnly, SameSite=Lax, Path=/api/auth, Secure ở production; frontend gửi credentials: include. Login/refresh đặt cookie; logout/password xóa cookie.',
'Errors ở từng dòng là lỗi nghiệp vụ chính, cộng lỗi middleware/hệ thống chung. Phân quyền vai trò/chủ sở hữu được kiểm tra trong handler/service; không có middleware riêng cho từng vai trò. Một số tài nguyên trả 404 cả khi không có quyền.',
'Độ khó req/res dùng "Dễ", "Trung bình", "Khó"; EASY/MEDIUM/HARD là giá trị database. Chỉ số lựa chọn 0..3 không phải optionId. Điểm lưu/trả 0..100, giao diện quy đổi thang 10.',
'API danh sách hiện không có query phân trang/tìm kiếm. Thống kê, Dashboard, xuất CSV và xuất Mindmap thực hiện ở frontend từ dữ liệu API; không có endpoint chuyên biệt.',
'Định nghĩa kiểu bên dưới là ký hiệu mô tả, không phải JSON mẫu để gửi nguyên văn. Các trường id trong object viết gọn mặc định kiểu ID, trường tên/nội dung mặc định string.'
]
schemas=[
('User','{ userId: ID, fullName: string, email: string, role: "TEACHER"|"STUDENT" }'),
('Document','{ id, ownerId: ID, name, type: "PDF"|"DOCX"|"TXT", size: string (ví dụ "12.0 KB"), date: datetime, status, text: string }'),
('QuestionInput','{ text: string 1..4000, options: string[4] (mỗi lựa chọn 1..2000, không trùng khi bỏ khác biệt hoa/thường), answer: integer 0..3, explanation: string 1..4000, source?: string ≤1000 (mặc định "Bổ sung thủ công") }'),
('Question / SafeQuestion','Question = QuestionInput + { id: ID, optionIds: ID[4] }. SafeQuestion = { id: ID, text: string, options: string[4] }; không có answer/explanation/source/optionIds.'),
('QuizContent','{ id, persisted: true, type: "QUIZ", title, status, difficulty, createdAt: datetime, sources: ID[], contentRequest, generationMode, generationModel?, versionId: ID, questions: Question[] }'),
('GeneratedPreview','Các thiết lập chuẩn hóa: type, title, difficulty, sources, contentRequest, quantity; Flashcard/Mindmap có detail. Có generationMode, generationModel? và sourceTruncated? (AI thật). Quiz có questions: QuestionInput[]; Flashcard có cards: CardInput[]; Mindmap có nodes: NodeInput[]. Chưa có id/revision/persisted của học liệu đã lưu.'),
('CardInput','{ id?: ID (khi sửa thẻ cũ), front: string 1..4000, back: string 1..4000, keyword?: string ≤100 (mặc định "") }. Khi lưu có 1..50 thẻ; yêu cầu sinh AI chỉ 1..20.'),
('NodeInput','{ id: string 1..80, parent: string 1..80 | null, label: string 1..48 }. 1..30 nút, id duy nhất; đúng một gốc parent=null; nút cha tồn tại và không vòng lặp. Sau lưu, id/parent dùng mã database dạng chuỗi.'),
('StudyContent','{ id, type: "FLASHCARD"|"MINDMAP", title, revision: integer, persisted: true, generationMode, generationModel?, contentRequest, difficulty, sources: ID[], createdAt: datetime }. FLASHCARD thêm cards: {id,front,back,keyword}[], learned: integer[] (chỉ số thẻ đã nhớ bắt đầu từ 0). MINDMAP thêm nodes: {id,parent,label}[].'),
('PersonalResult','{ id, attemptNumber: integer, persisted: true, contentId, assignmentId: null, title, userId, name, status, date: datetime, score: number, showAnswers: true, answers: integer[], questions: Question[] }'),
('ClassroomBasic','{ id, persisted: true, name, group, description, code, teacher, teacherId, color: "green", materialIds: [], joined: false, pending: false }. Lookup trả các cờ mặc định, không dùng chúng để kết luận tình trạng tham gia thực tế.'),
('Classroom','ClassroomBasic, nhưng materialIds: ID[], joined/pending được tính theo tài khoản; thêm pendingRequestId: ID|null.'),
('Member / JoinRequest','Member = { id: membershipId, userId, classId, name, email }. JoinRequest = { id: requestId, userId, classId, name, email }; requests chỉ có PENDING của lớp giáo viên quản lý.'),
('Assignment','{ id, persisted: true, classId, contentId, versionId, title, startAt, dueAt, maxAttempts, durationMinutes: integer|null, showAnswers: boolean, status, questionCount: integer, questions: Question[], attemptsUsed: integer, inProgress: boolean }. Giáo viên có đầy đủ questions; học sinh nhận questions=[].'),
('AssignedStart','{ id, title, questions: SafeQuestion[], answers: integer[], revision: integer, dueAt: datetime, startedAt: datetime, serverNow: datetime }. dueAt là hạn kết thúc lượt: min(hạn bài giao, bắt đầu lượt + thời lượng nếu có).'),
('AssignedResult','{ id, attemptNumber, persisted: true, assignmentId, classId: ID|null, className: string|null, contentId, title, userId, name, email?, status, date, score: number, correctCount: integer, showAnswers: boolean, answers: integer[], questions: Question[]|SafeQuestion[] }. Đáp án đầy đủ khi showAnswers=true; giáo viên chủ lớp được xem. email có trong GET danh sách, có thể vắng ở phản hồi nộp/bắt đầu.'),
('Notification','{ id, title, text, route, icon, read: boolean, date: datetime }'),
('ErrorResponse','{ success: false, message: string, errors?: object }. errors chứa thông báo theo trường nếu có. Lỗi >=500 mặc định thông báo chung, trừ lỗi AI đã có thông báo được chọn lọc.')
]

N='http://schemas.openxmlformats.org/spreadsheetml/2006/main'
R='http://schemas.openxmlformats.org/officeDocument/2006/relationships'
PR='http://schemas.openxmlformats.org/package/2006/relationships'
def cell(ref,v,s):
    return f'<c r="{ref}" s="{s}" t="inlineStr"><is><t xml:space="preserve">{escape(str(v))}</t></is></c>'
def row(n,values,styles,h):
    return f'<row r="{n}" ht="{h}" customHeight="1">'+''.join(cell(f'{chr(65+i)}{n}',v,styles[i]) for i,v in enumerate(values))+'</row>'
headers=['Router','Endpoint','Mô tả','Method','Input (req.body)','Output (res.body)','Middleware','Errors (Unhappy path)','Notes']
widths=[28,48,33,12,76,76,48,76,85]
xrows=[row(1,['THIẾT KẾ API – WEBSITE AI HỖ TRỢ HỌC TẬP'],[1],36),row(2,[f'{len(rows)} endpoint • Một sheet • Quy ước và kiểu dữ liệu dùng chung ở cuối bảng'],[7],28),row(3,headers,[2]*9,32)]
for i,a in enumerate(rows,4):
    h=max(74,18*(max(math.ceil(len(str(v))/(w*0.9)) for v,w in zip(a,widths))+1))
    xrows.append(row(i,a,[5,3,3,4,3,5,3,3,5],min(h,380)))
merges=['A1:I1','A2:I2'];n=len(rows)+5
def merged(text,style=6):
    global n
    xrows.append(row(n,[text],[style],48 if len(text)>450 else 36));merges.append(f'A{n}:I{n}');n+=1
merged('QUY ƯỚC CHUNG',1)
for text in rules:merged(text)
merged('KIỂU DỮ LIỆU INPUT / OUTPUT DÙNG CHUNG',1)
for name,text in schemas:merged(name+' = '+text,7)
sheet=f'<worksheet xmlns="{N}"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:I{n-1}"/><sheetViews><sheetView workbookViewId="0"><pane xSplit="2" ySplit="3" topLeftCell="C4" activePane="bottomRight" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="24"/><cols>'+''.join(f'<col min="{i}" max="{i}" width="{w}" customWidth="1"/>' for i,w in enumerate(widths,1))+'</cols><sheetData>'+''.join(xrows)+f'</sheetData><autoFilter ref="A3:I{len(rows)+3}"/><mergeCells count="{len(merges)}">'+''.join(f'<mergeCell ref="{m}"/>' for m in merges)+'</mergeCells><pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup paperSize="8" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>'
styles=f'''<styleSheet xmlns="{N}">
<fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="15"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><sz val="11"/><color rgb="FF475569"/><name val="Calibri"/></font></fonts>
<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF205B50"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF0F7F5"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFDF3D5"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border/><border><left style="thin"><color rgb="FFD3DFDA"/></left><right style="thin"><color rgb="FFD3DFDA"/></right><top style="thin"><color rgb="FFD3DFDA"/></top><bottom style="thin"><color rgb="FFD3DFDA"/></bottom></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="8">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="3" fillId="4" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'''
parts={'xl/styles.xml':styles,'xl/worksheets/sheet1.xml':sheet,
'xl/workbook.xml':f'<workbook xmlns="{N}" xmlns:r="{R}"><bookViews><workbookView/></bookViews><sheets><sheet name="Thiet ke API" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm.Print_Titles" localSheetId="0">\'Thiet ke API\'!$1:$3</definedName></definedNames></workbook>',
'_rels/.rels':f'<Relationships xmlns="{PR}"><Relationship Id="rId1" Type="{R}/officeDocument" Target="xl/workbook.xml"/></Relationships>',
'xl/_rels/workbook.xml.rels':f'<Relationships xmlns="{PR}"><Relationship Id="rId1" Type="{R}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="{R}/styles" Target="styles.xml"/></Relationships>',
'[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'}
with zipfile.ZipFile(OUT,'w',zipfile.ZIP_DEFLATED) as z:
    for name,data in parts.items():E.fromstring(data);z.writestr(name,data)
with zipfile.ZipFile(OUT) as z:
    assert z.testzip() is None
    ns={'s':N};r=E.fromstring(z.read('xl/worksheets/sheet1.xml'))
    rr=r.findall('s:sheetData/s:row',ns)
    assert [c.text for c in rr[2].findall('s:c/s:is/s:t',ns)]==headers
    for i,a in enumerate(rows,3):assert [c.text or '' for c in rr[i].findall('s:c/s:is/s:t',ns)]==a
print(OUT)
print(f'Validated: {len(rows)} endpoints match source routes; exact 9 headers; 1 sheet; {len(schemas)} shared types; XML and ZIP integrity.')
