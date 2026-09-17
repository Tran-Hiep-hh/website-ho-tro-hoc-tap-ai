from pathlib import Path
from copy import deepcopy
import zipfile, re, io, math
import xml.etree.ElementTree as E
from PIL import Image, ImageDraw, ImageFont

SOURCE = Path(r'D:\DATN\dac-ta-use-case-he-thong-ai-ho-tro-hoc-tap (1).docx')
OUT = Path(__file__).parent / 'dac-ta-use-case-he-thong-ai-ho-tro-hoc-tap-da-cap-nhat.docx'
W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
NS = {'w': W}
def tag(s): return '{'+W+'}'+s
def txt(el): return ''.join(t.text or '' for t in el.iter(tag('t')))
with zipfile.ZipFile(SOURCE) as z:
    files = {i.filename:z.read(i.filename) for i in z.infolist()}
original = files['word/document.xml']
for _, (prefix, uri) in E.iterparse(io.BytesIO(original), events=['start-ns']):
    if not re.match(r'ns\d+$',prefix): E.register_namespace(prefix,uri)
root = E.fromstring(original)
body = root.find('w:body',NS)
tables = body.findall('w:tbl',NS)
records = {}
for i,t in enumerate(tables,1):
    records[i] = {txt(row[0]): [txt(p) for p in row[1].findall('w:p',NS) if txt(p)] for row in t.findall('w:tr',NS)}
def change(i, **fields):
    mapping={'name':'UC Name','actor':'Actor(s)','description':'Description','trigger':'Trigger','pre':'Pre-condition','post':'Post-condition','basic':'Basic Flow','alt':'Alternative Flow','exc':'Exception Flow'}
    for key,value in fields.items(): records[i][mapping[key]] = value if isinstance(value,list) else [value]

change(1,pre='Người dùng chưa đăng nhập.',basic=['Hệ thống hiển thị biểu mẫu đăng ký.','Người dùng nhập họ tên, email, mật khẩu, xác nhận mật khẩu và chọn vai trò Giáo viên hoặc Người học.','Người dùng nhấn Đăng ký.','Hệ thống kiểm tra họ tên 2–100 ký tự, định dạng và tính duy nhất của email không phân biệt hoa/thường; mật khẩu ít nhất 8 ký tự, tối đa 72 byte UTF-8; xác nhận mật khẩu trùng khớp.','Hệ thống băm mật khẩu, tạo tài khoản và thông báo thành công.','Hệ thống chuyển đến trang đăng nhập, điền sẵn email.'],alt='Người dùng chuyển sang đăng nhập trước khi gửi biểu mẫu; không tạo tài khoản.')
change(5,description='Cho phép người dùng cập nhật họ tên của tài khoản; email và vai trò chỉ được xem.',basic=['Người dùng mở Hồ sơ cá nhân.','Hệ thống hiển thị họ tên hiện tại; email và vai trò chỉ đọc.','Người dùng sửa họ tên và nhấn Lưu thay đổi.','Hệ thống kiểm tra họ tên từ 2–100 ký tự và quyền tài khoản.','Hệ thống lưu họ tên, cập nhật thông tin hiển thị và thông báo thành công.'],exc=['Họ tên không hợp lệ; hệ thống báo lỗi và không lưu.','Phiên đăng nhập hết hạn hoặc không lưu được; hệ thống thông báo để người dùng đăng nhập lại hoặc thử lại.'])
change(6,post='Mật khẩu mới được băm và lưu; tất cả phiên đăng nhập của tài khoản bị thu hồi. Thiết bị hiện tại chuyển về đăng nhập; thiết bị khác phải đăng nhập lại khi truy cập API hoặc tải lại trang.',basic=['Người dùng mở biểu mẫu Đổi mật khẩu.','Người dùng nhập mật khẩu hiện tại, mật khẩu mới và xác nhận.','Người dùng nhấn Đổi mật khẩu.','Hệ thống xác minh mật khẩu hiện tại; mật khẩu mới phải khác mật khẩu cũ, ít nhất 8 ký tự, tối đa 72 byte UTF-8 và khớp xác nhận.','Hệ thống băm và lưu mật khẩu mới, thu hồi tất cả phiên đăng nhập.','Hệ thống thông báo thành công và chuyển về đăng nhập.'])
change(7,pre='Người dùng đã đăng nhập.',post='Tệp và thông tin chủ sở hữu được lưu. Tài liệu có văn bản trích xuất hợp lệ chuyển sang READY; tài liệu không trích xuất được văn bản chuyển sang FAILED và không được dùng tạo học liệu AI.',basic=['Người dùng mở chức năng Tải tài liệu lên và chọn tệp.','Hệ thống kiểm tra định dạng PDF, DOCX hoặc TXT và dung lượng tối đa 10 MB/tệp.','Người dùng xác nhận tải lên.','Hệ thống lưu tệp, thông tin chủ sở hữu và trích xuất văn bản; TXT được đọc bằng UTF-8.','Hệ thống cập nhật trạng thái xử lý và hiển thị tài liệu trong danh sách.'],exc=['Tệp sai định dạng hoặc vượt 10 MB; hệ thống từ chối tải lên.','Tệp lỗi, không có văn bản hoặc PDF chỉ chứa ảnh; hệ thống đánh dấu xử lý thất bại. Phiên bản hiện tại chưa có OCR; tệp đã lưu vẫn có thể tải xuống hoặc xóa.','Lưu tệp hoặc truy cập máy chủ thất bại; hệ thống thông báo lỗi.'])
change(8,alt=['Người dùng tìm kiếm hoặc lọc danh sách tài liệu.','Nếu chưa có tài liệu, hệ thống hiển thị danh sách trống và nút tải lên.','Tài liệu xử lý thất bại vẫn hiển thị thông tin và trạng thái; không có văn bản để tạo học liệu.'])
change(9,description='Cho phép người dùng tải tệp gốc của tài liệu cá nhân hoặc tài liệu được chia sẻ trong lớp mà mình có quyền truy cập.')
change(10,post='Tài liệu được đánh dấu DELETED, tệp gốc được gỡ khỏi lưu trữ; học liệu đã tạo và tham chiếu nguồn được giữ.',exc=['Tài liệu đang chia sẻ trong lớp; hệ thống từ chối và yêu cầu gỡ liên kết chia sẻ trước.','Tài liệu không tồn tại, không thuộc người dùng hoặc thao tác xóa thất bại; hệ thống thông báo lỗi.'])
for i,kind in [(11,'Quiz'),(12,'Flashcard'),(13,'Mindmap')]:
    setup={11:'tên học liệu, số câu hỏi từ 1–20, độ khó và yêu cầu bổ sung nếu có',12:'tên học liệu, số thẻ từ 1–20, độ khó và yêu cầu bổ sung nếu có',13:'tên học liệu, độ khó, mức chi tiết tổng quan/chi tiết và yêu cầu bổ sung nếu có'}[i]
    change(i,pre='Người dùng đã đăng nhập; chọn từ 1–10 tài liệu cá nhân thuộc sở hữu, còn tồn tại, có trạng thái READY và văn bản trích xuất không rỗng.',post=f'{kind} được kiểm tra, xem trước và lưu vào thư viện cá nhân khi người dùng xác nhận; nếu chưa lưu thì chưa tạo học liệu trong thư viện.',basic=['Người dùng chọn tài liệu nguồn thuộc sở hữu.',f'Người dùng thiết lập {setup}.','Người dùng gửi yêu cầu tạo học liệu.','Hệ thống kiểm tra quyền và trạng thái nguồn, lấy văn bản đã trích xuất rồi gửi yêu cầu tới dịch vụ AI được cấu hình.',f'Hệ thống kiểm tra cấu trúc kết quả và hiển thị {kind} để xem trước.','Người dùng kiểm tra, chỉnh sửa nếu cần và chọn Lưu vào thư viện.','Hệ thống kiểm tra dữ liệu, lưu học liệu và liên kết nguồn, thông báo thành công.'],exc=['Nguồn không thuộc sở hữu, đã xóa hoặc chưa có văn bản sẵn sàng; hệ thống yêu cầu chọn nguồn hợp lệ.','Thiết lập không hợp lệ; hệ thống yêu cầu sửa.','Dịch vụ AI gặp lỗi, quá thời gian hoặc trả về cấu trúc không hợp lệ; hệ thống thông báo và cho thử lại.','Lưu học liệu thất bại; hệ thống thông báo, chưa xác nhận lưu thành công.'])
change(15,description='Cho phép chủ sở hữu chỉnh sửa Quiz, Flashcard hoặc Mindmap trong thư viện cá nhân.',post='Nội dung hợp lệ được lưu. Sửa Quiz tạo phiên bản mới, giữ nguyên đề và kết quả của lượt đã bắt đầu/bài đã giao. Sửa mặt trước hoặc mặt sau Flashcard đặt lại tiến độ của riêng thẻ đó; đổi tên, từ khóa hoặc thứ tự không đặt lại tiến độ của thẻ không đổi.')
change(16,post='Quiz gốc và kết quả tự luyện tương ứng bị xóa; bài giao cùng kết quả lớp vẫn giữ nguyên. Với Flashcard/Mindmap, học liệu bị xóa; tiến độ Flashcard liên quan bị xóa theo.',basic=['Người dùng chọn học liệu cần xóa.','Hệ thống hiển thị xác nhận và ảnh hưởng dữ liệu; với Quiz nêu rõ chỉ xóa kết quả tự luyện, giữ bài giao và kết quả lớp.','Người dùng xác nhận.','Hệ thống kiểm tra quyền sở hữu và xóa học liệu cùng dữ liệu liên quan theo loại.','Hệ thống cập nhật thư viện và thông báo thành công.'],exc='Học liệu không tồn tại, không thuộc sở hữu hoặc thao tác thất bại; hệ thống từ chối và thông báo.')
change(17,pre='Người dùng đã đăng nhập. Quiz cá nhân phải thuộc sở hữu; với Quiz được giao, người dùng là Người học đang thuộc lớp, bài đã công bố, đang trong thời gian mở và còn lượt hoặc có lượt đang làm.',basic=['Người dùng chọn Quiz và xem điều kiện làm bài.','Người dùng nhấn Bắt đầu; hệ thống tạo lượt gắn với phiên bản đề cố định hoặc khôi phục lượt đang làm.','Hệ thống hiển thị câu hỏi và các lựa chọn, không cung cấp đáp án đúng khi đang làm.','Người dùng chọn đáp án; với bài giao, hệ thống lưu lựa chọn lên máy chủ và hiển thị trạng thái lưu.','Người dùng nhấn Nộp bài và xác nhận.','Máy chủ chấm điểm theo đề của lượt làm, lưu kết quả và tránh tạo kết quả trùng khi gửi lại.','Hệ thống hiển thị điểm thang 10; bài giao chỉ hiển thị đáp án/giải thích sau nộp nếu giáo viên cho phép.'],alt=['Với bài giao, tải lại trang và bắt đầu lại sẽ tiếp tục lượt đang làm cùng các đáp án đã lưu, không dùng thêm lượt và không đặt lại thời gian.','Quiz cá nhân không có hạn nộp, giới hạn lượt như bài giao; lựa chọn chưa nộp chỉ giữ trong trang hiện tại, tải lại phải chọn lại.','Người học làm lượt tiếp theo của bài giao nếu còn lượt và còn trong thời gian mở.'],exc=['Bài chưa mở, đã hết hạn, bị hủy/xóa, hết lượt hoặc người học mất quyền thành viên; hệ thống từ chối bắt đầu.','Đến hạn kết thúc, máy chủ chỉ chấm đáp án đã lưu; hạn kết thúc là thời điểm sớm hơn giữa hạn nộp và thời điểm bắt đầu cộng thời lượng (nếu có).','Nếu trình duyệt đã đóng, lượt hết hạn được hoàn tất khi API bài giao được truy cập tiếp; hiện chưa có tác vụ nền bảo đảm nộp đúng thời điểm khi không có truy cập.','Mất kết nối khi lưu/nộp bài; thông báo lỗi và cho thử lại. Không khẳng định các lựa chọn chưa lưu đã được bảo toàn.','Hai tab cùng cập nhật đáp án bài giao gây xung đột phiên bản; hệ thống yêu cầu tải lại dữ liệu.'])
change(19,description='Cho phép Giáo viên xem các lớp mình quản lý; Người học xem lớp đã tham gia và lớp đang chờ duyệt.',post='Danh sách hiển thị theo quyền và trạng thái tham gia; lớp chờ duyệt không cấp quyền truy cập tài liệu hoặc thành viên.')
change(22,post='Lớp bị đánh dấu đã xóa, bài giao trong lớp bị hủy/đánh dấu xóa; mọi lượt làm, đáp án và điểm của các bài giao đó bị xóa. Tài liệu và Quiz gốc của giáo viên được giữ.',basic=['Giáo viên chọn Xóa lớp học.','Hệ thống cảnh báo việc xóa toàn bộ kết quả thuộc bài giao trong lớp, kể cả lớp có Quiz đang mở.','Giáo viên xác nhận.','Hệ thống kiểm tra quyền chủ lớp và xử lý xóa lớp cùng dữ liệu liên quan.','Hệ thống cập nhật danh sách và thông báo thành công.'],exc='Lớp không còn tồn tại, người dùng không phải chủ lớp hoặc xử lý dữ liệu thất bại; hệ thống thông báo lỗi. Có Quiz đang mở không phải điều kiện chặn xóa lớp.')
change(23,alt='Lớp chưa có Người học; hệ thống hiển thị trạng thái danh sách trống.')
change(24,pre='Giáo viên đã đăng nhập và là chủ lớp.',post='Yêu cầu chuyển sang APPROVED hoặc REJECTED; khi duyệt, Người học trở thành thành viên ACTIVE. Hệ thống tạo thông báo cho người gửi yêu cầu.',alt='Không có yêu cầu chờ xử lý; hệ thống hiển thị danh sách trống.',exc='Yêu cầu đã được xử lý hoặc đã được người học hủy; hệ thống không xử lý lặp và yêu cầu cập nhật danh sách.')
for i,status in [(25,'REMOVED'),(28,'LEFT')]:
    change(i,post=f'Tư cách thành viên chuyển sang {status}; người học mất quyền truy cập tài liệu lớp và bắt đầu bài giao. Lịch sử bài làm đã có vẫn được giữ khi lớp và bài giao chưa bị xóa.',exc=['Lớp có Quiz đã công bố đang trong thời gian mở; hệ thống từ chối thao tác và thông báo lý do.','Người học không còn thuộc lớp hoặc lớp không còn tồn tại; hệ thống thông báo và cập nhật danh sách.'])
    records[i]['Basic Flow']=[s.replace('xóa quan hệ thành viên',f'cập nhật trạng thái thành viên thành {status}') for s in records[i]['Basic Flow']]
change(28,description='Cho phép Người học rời lớp đang tham gia khi lớp không có Quiz đang mở.')
names={27:'Xem tài liệu lớp',29:'Xem danh sách tài liệu lớp',30:'Chia sẻ tài liệu cho lớp',31:'Gỡ tài liệu khỏi lớp'}
for i,name in names.items():
    for key,lines in records[i].items():
        records[i][key]=[s.replace('tài liệu, Flashcard và Mindmap','tài liệu PDF, DOCX và TXT').replace('tài liệu, Flashcard hoặc Mindmap','tài liệu PDF, DOCX hoặc TXT').replace('một tài liệu, Flashcard hoặc Mindmap','một tài liệu PDF, DOCX hoặc TXT').replace('học liệu','tài liệu').replace('Học liệu','Tài liệu') for s in lines]
    change(i,name=name)
change(27,post='Danh sách hoặc nội dung tài liệu lớp được hiển thị. Tài liệu không tự sao chép vào tài liệu cá nhân của người học.',alt=['Lớp chưa có tài liệu; hệ thống hiển thị danh sách trống.','Người học tải tệp gốc xuống; muốn dùng làm nguồn AI cá nhân phải tự tải lên khu vực tài liệu cá nhân.','PDF được mở để xem; DOCX/TXT có văn bản xem trước khi trích xuất thành công.'])
change(30,pre='Giáo viên đã đăng nhập, sở hữu lớp và tài liệu cá nhân cần chia sẻ; tài liệu còn tồn tại, ở trạng thái READY hoặc FAILED.',post='Liên kết tài liệu với lớp được tạo; thành viên đang hoạt động có thể xem/tải theo trạng thái tài liệu và nhận thông báo tài liệu mới.')
change(32,post='Bài giao được lưu với tên và phiên bản đề riêng, trạng thái DRAFT hoặc PUBLISHED. Sửa/xóa Quiz gốc không làm thay đổi bài giao.',basic=['Giáo viên mở Giao Quiz mới và chọn Quiz đã lưu thuộc sở hữu.','Giáo viên chọn lớp do mình quản lý và nhập tên bài giao.','Giáo viên thiết lập thời gian mở, hạn nộp, số lượt từ 1–10, quyền xem đáp án sau nộp và thời lượng làm bài từ 1–1440 phút hoặc để trống.','Giáo viên kiểm tra và chọn công bố.','Hệ thống kiểm tra đề, quyền chủ lớp và dữ liệu; hạn nộp phải sau thời gian mở.','Hệ thống lưu bài giao PUBLISHED với phiên bản đề cố định, tạo thông báo cho thành viên đang hoạt động.','Hệ thống hiển thị bài giao và điều kiện làm bài.'],alt=['Giáo viên chọn Lưu nháp; hệ thống tạo bài DRAFT, chưa công bố và chưa gửi thông báo.','Chỉnh sửa bản nháp, công bố, hủy và xóa bài giao thực hiện theo UC45–UC48.'],exc=['Tên, lịch, thời lượng hoặc số lượt không hợp lệ; hệ thống yêu cầu sửa.','Quiz, phiên bản đề hoặc lớp không tồn tại/không thuộc quyền quản lý; hệ thống không tạo bài giao.'])
change(33,description='Cho phép Giáo viên xem tỷ lệ hoàn thành của một bài giao theo số người có ít nhất một lượt đã nộp.',basic=['Giáo viên mở Kết quả học tập, chọn Thống kê lớp học.','Giáo viên chọn lớp và bài giao.','Hệ thống xác định thành viên hiện tại và bổ sung người đã rời/bị xóa khỏi lớp có kết quả của bài giao.','Hệ thống đếm người có ít nhất một lượt đã nộp.','Hệ thống tính tỷ lệ hoàn thành = số người đã nộp / tổng số người trong phạm vi thống kê × 100%, làm tròn số nguyên.','Hệ thống hiển thị tỷ lệ và trạng thái của từng người.'],alt=['Chưa có bài nộp hoặc phạm vi thống kê không có người; hiển thị 0%.','Giáo viên chọn một người học để lọc bảng kết quả.'])
change(34,basic=['Giáo viên mở thống kê, chọn lớp và bài giao.','Hệ thống kiểm tra quyền quản lý.','Với mỗi người có bài nộp trong phạm vi UC33, hệ thống chọn lượt có điểm cao nhất.','Hệ thống tính trung bình các điểm cao nhất; không tính người chưa nộp là 0 điểm.','Hệ thống làm tròn điểm trung bình trên thang lưu trữ 0–100 rồi hiển thị quy đổi thang 10.'],alt=['Giáo viên đổi bài giao để xem số liệu tương ứng.','Chưa có bài nộp; hệ thống hiển thị dấu —, không coi là điểm trung bình 0.'])
change(35,basic=['Giáo viên chọn lớp và bài giao.','Hệ thống lấy điểm cao nhất của từng người đã nộp trong phạm vi UC33.','Hệ thống chia điểm thang 10 vào các khoảng [0,2), [2,4), [4,6), [6,8), [8,10].','Hệ thống đếm và hiển thị số người ở mỗi khoảng điểm.'],alt='Chưa có bài nộp; các khoảng điểm có số lượng bằng 0. Không có chức năng bấm khoảng điểm để mở danh sách chi tiết trong phiên bản hiện tại.')
change(36,name='Xem kết quả theo bài giao',description='Cho phép Giáo viên xem kết quả theo từng bài giao trong lớp, phân biệt các bài giao dù dùng cùng Quiz gốc.',alt=['Giáo viên lọc bảng theo một người học.','Chưa có bài nộp; hệ thống hiển thị thành viên hiện tại ở trạng thái chưa làm.'])
change(37,description='Cho phép Giáo viên xem điểm và từng lượt đã nộp của một người học trong bài giao đang chọn.',pre='Giáo viên đã đăng nhập, sở hữu lớp và chọn bài giao; người học thuộc phạm vi thống kê tại UC33.',basic=['Giáo viên mở Thống kê lớp học.','Giáo viên chọn lớp và bài giao.','Hệ thống hiển thị bảng kết quả người học.','Giáo viên lọc theo một người học.','Hệ thống hiển thị trạng thái, điểm cao nhất và số lượt đã nộp.','Giáo viên chọn Xem bài làm hoặc một lượt khác để xem chi tiết.'],alt=['Người học chưa nộp bài; hiển thị Chưa làm.','Người đã rời lớp nhưng có bài nộp vẫn hiển thị lịch sử, kèm dấu hiệu đã rời lớp.'],exc=['Bài giao/lớp đã xóa hoặc giáo viên không có quyền; hệ thống từ chối truy cập.','Không tải được dữ liệu; thông báo và cho phép thử lại.'])
change(38,basic=['Giáo viên chọn lớp và bài giao trong trang thống kê.','Hệ thống chọn lượt có điểm cao nhất của mỗi người đã nộp trong phạm vi UC33.','Với mỗi câu hỏi, hệ thống đếm số người chọn sai hoặc bỏ trống trong các lượt được chọn.','Hệ thống tính tỷ lệ sai = số người sai hoặc bỏ trống / số người có kết quả × 100%.','Hệ thống sắp xếp giảm dần và hiển thị tối đa 3 câu cùng tỷ lệ sai làm tròn số nguyên.'],alt='Chưa có bài nộp; hệ thống thông báo chưa có dữ liệu để phân tích. Phiên bản hiện tại chưa có phân bố lựa chọn đáp án.')
change(39,alt=['Người dùng lọc theo Quiz cá nhân hoặc bài được giao phù hợp vai trò.','Chưa có kết quả; hiển thị trạng thái trống.'],post='Hiển thị lịch sử các lượt đã nộp của tài khoản. Với bài giao, đáp án và giải thích chỉ hiển thị khi giáo viên cho phép.')

def add(i,name,actor,description,trigger,pre,post,basic,alt,exc):
    records[i]={'UC ID':[f'UC{i:02}'],'UC Name':[name],'Actor(s)':[actor],'Priority':['Phải có'],'Description':[description],'Trigger':[trigger],'Pre-condition':[pre],'Post-condition':[post],'Basic Flow':basic,'Alternative Flow':alt if isinstance(alt,list) else [alt],'Exception Flow':exc if isinstance(exc,list) else [exc]}
BOTH='Giáo viên, Người học'
add(40,'Xem tổng quan học tập và giảng dạy',BOTH,'Tổng hợp số liệu và nội dung gần đây phù hợp vai trò.','Người dùng mở Tổng quan.','Người dùng đã đăng nhập.','Số liệu thuộc quyền truy cập được hiển thị, không thay đổi dữ liệu gốc.',['Hệ thống xác định tài khoản và vai trò.','Hệ thống tải tài liệu, học liệu, lớp và bài giao thuộc quyền truy cập.','Giáo viên xem số lớp, số người học duy nhất, yêu cầu chờ duyệt, bài đã công bố và bài nộp gần đây; Người học xem tài liệu, học liệu cá nhân, lớp đã duyệt, điểm trung bình mọi lượt đã nộp và Flashcard đã nhớ.','Hệ thống hiển thị hoạt động 7 ngày, học liệu gần đây và bài giao sắp đến hạn phù hợp vai trò.','Người dùng mở mục liên quan hoặc chọn Làm mới số liệu.'],'Chưa phát sinh dữ liệu; hiển thị trạng thái trống phù hợp.','Một nguồn tải lỗi; báo lỗi và cho thử lại, không thay số liệu chưa tải bằng 0.')
add(41,'Ôn tập Flashcard',BOTH,'Ôn tập bộ thẻ cá nhân và lưu tiến độ từng thẻ.','Người dùng chọn ôn tập một bộ Flashcard.','Đã đăng nhập và sở hữu bộ thẻ còn tồn tại.','Trạng thái ghi nhớ được lưu theo từng thẻ của tài khoản.',['Người dùng mở bộ Flashcard.','Hệ thống tải thẻ và tiến độ đã lưu.','Người dùng xem mặt trước, lật để xem mặt sau.','Người dùng chọn Đã nhớ hoặc Cần ôn lại.','Hệ thống lưu trạng thái của thẻ và cập nhật tiến độ.','Người dùng chuyển sang thẻ tiếp theo.'],'Người dùng mở lại bộ thẻ; tiến độ đã lưu được khôi phục.',['Bộ thẻ đã xóa hoặc không thuộc quyền sở hữu; từ chối truy cập.','Lưu tiến độ thất bại; thông báo và cho thử lại.'])
add(42,'Xuất Mindmap',BOTH,'Xuất sơ đồ cá nhân thành PNG hoặc dùng chức năng in/lưu PDF của trình duyệt.','Người dùng chọn Xuất PNG hoặc In / Lưu PDF.','Đã đăng nhập, có quyền mở Mindmap và sơ đồ đã được hiển thị.','Tệp PNG được tải về hoặc hộp thoại in mở để người dùng in/lưu PDF.',['Người dùng mở Mindmap.','Hệ thống hiển thị sơ đồ.','Người dùng chọn Xuất PNG.','Hệ thống dựng ảnh sơ đồ và tải tệp PNG về thiết bị.'],'Người dùng chọn In / Lưu PDF; trình duyệt mở hộp thoại in, người dùng chọn máy in hoặc lưu PDF rồi xác nhận.','Không tạo được ảnh hoặc thao tác in bị chặn; thông báo/kiểm tra trình duyệt và thử lại.')
add(43,'Hủy yêu cầu tham gia lớp','Người học','Hủy yêu cầu tham gia do chính mình gửi khi còn chờ duyệt.','Người học chọn Hủy yêu cầu trên lớp đang chờ duyệt.','Đã đăng nhập và có yêu cầu của mình ở trạng thái PENDING.','Yêu cầu chuyển sang CANCELLED; chưa phát sinh tư cách thành viên.',['Người học mở danh sách lớp.','Người học chọn Hủy yêu cầu tại lớp đang chờ duyệt.','Hệ thống kiểm tra người gửi và trạng thái yêu cầu.','Hệ thống cập nhật trạng thái và làm mới danh sách.'],'Người học có thể tìm lớp bằng mã và gửi yêu cầu mới sau khi hủy.','Yêu cầu đã được duyệt/từ chối/hủy; hệ thống thông báo và cập nhật danh sách; nếu đã là thành viên thì dùng Rời lớp.')
add(44,'Xem danh sách và chi tiết bài giao',BOTH,'Xem bài giao và điều kiện làm bài theo quyền giáo viên hoặc người học.','Người dùng mở Giao Quiz hoặc Bài Quiz được giao.','Người dùng đã đăng nhập.','Danh sách và chi tiết được hiển thị theo quyền.',['Hệ thống xác định vai trò và lớp thuộc quyền truy cập.','Hệ thống tải danh sách bài giao.','Người dùng chọn một bài giao.','Hệ thống hiển thị tên, lớp, lịch, thời lượng, số lượt và trạng thái.','Giáo viên chủ lớp có thể xem Nội dung Quiz đã giao gồm câu hỏi, đáp án và giải thích; Người học xem điều kiện và hành động làm bài được phép.'],'Chưa có bài giao; hiển thị danh sách trống.','Bài giao không tồn tại hoặc ngoài quyền truy cập; từ chối hiển thị. Người học không được xem đề kèm đáp án qua chức năng dành cho giáo viên.')
add(45,'Chỉnh sửa bản nháp bài giao','Giáo viên','Sửa điều kiện và nội dung đề riêng của bài giao chưa công bố.','Giáo viên chọn Chỉnh sửa bản nháp.','Đã đăng nhập, là chủ lớp và bài giao còn DRAFT.','Bản nháp được cập nhật; đề riêng không thay Quiz gốc; trạng thái vẫn DRAFT.',['Giáo viên mở bản nháp.','Hệ thống hiển thị tên, lịch, thời lượng, số lượt, quyền xem đáp án và câu hỏi.','Giáo viên sửa thiết lập hoặc thêm/sửa/xóa câu hỏi.','Giáo viên chọn lưu.','Hệ thống kiểm tra quyền, trạng thái và cấu trúc đề; mỗi câu có 4 lựa chọn và 1 đáp án đúng.','Hệ thống lưu phiên bản đề riêng và thiết lập bài giao, thông báo thành công.'],'Giáo viên hủy chỉnh sửa; bản nháp đã lưu giữ nguyên.',['Bài không còn DRAFT; từ chối chỉnh sửa.','Dữ liệu không hợp lệ hoặc có xung đột; không ghi đè và yêu cầu kiểm tra/tải lại.'])
add(46,'Công bố bài giao','Giáo viên','Công bố bài giao đã lưu nháp cho lớp.','Giáo viên chọn Công bố ở bản nháp.','Đã đăng nhập, sở hữu lớp và bài giao DRAFT còn hợp lệ.','Bài giao chuyển sang PUBLISHED; tạo thông báo cho thành viên đang hoạt động.',['Giáo viên mở bản nháp và kiểm tra nội dung.','Giáo viên chọn Công bố.','Hệ thống kiểm tra quyền và trạng thái, lịch cùng dữ liệu bài giao.','Hệ thống chuyển trạng thái, gửi thông báo trong ứng dụng và cập nhật danh sách.'],'Nếu chưa đến giờ mở, bài đã công bố vẫn chưa cho bắt đầu làm.','Bài đã hủy/xóa, không còn nháp hoặc dữ liệu không hợp lệ; không công bố và thông báo lỗi.')
add(47,'Hủy bài giao','Giáo viên','Dừng bài giao, giữ các kết quả đã có.','Giáo viên chọn Hủy bài giao.','Đã đăng nhập, là chủ lớp và bài giao còn tồn tại, chưa bị hủy.','Bài giao chuyển sang CANCELLED, không cho tiếp tục làm/nộp bài; các kết quả đã có được giữ.',['Giáo viên chọn bài giao cần hủy.','Hệ thống yêu cầu xác nhận.','Giáo viên xác nhận.','Hệ thống kiểm tra quyền và chuyển trạng thái sang CANCELLED.','Hệ thống cập nhật danh sách và thông báo thành công.'],['Giáo viên hủy xác nhận; bài giao giữ nguyên.','Có thể hủy cả khi bài giao đang mở.'],'Bài không tồn tại hoặc không thuộc quyền quản lý; từ chối thao tác.')
add(48,'Xóa bài giao','Giáo viên','Xóa bài giao và toàn bộ dữ liệu làm bài thuộc bài giao đó.','Giáo viên chọn Xóa bài giao.','Đã đăng nhập, sở hữu lớp và bài giao còn tồn tại.','Bài giao bị đánh dấu xóa; toàn bộ lượt làm, đáp án và điểm tương ứng bị xóa vĩnh viễn; Quiz gốc giữ nguyên.',['Giáo viên chọn Xóa bài giao.','Hệ thống cảnh báo dữ liệu làm bài và điểm sẽ bị xóa.','Giáo viên xác nhận.','Hệ thống kiểm tra quyền và xóa dữ liệu liên quan của bài giao.','Hệ thống cập nhật danh sách và thông báo thành công.'],['Giáo viên hủy xác nhận; dữ liệu giữ nguyên.','Cho phép xóa bài nháp, đã công bố, đang mở hoặc đã hủy.'],'Bài không tồn tại, không có quyền hoặc xử lý dữ liệu thất bại; hệ thống thông báo lỗi.')
add(49,'Xuất kết quả lớp ra CSV','Giáo viên','Xuất bảng kết quả theo một bài giao của lớp.','Giáo viên chọn Xuất CSV trong Thống kê lớp học.','Đã đăng nhập, sở hữu lớp, đã chọn bài giao và tải dữ liệu kết quả.','Tệp CSV được tải về; dữ liệu hệ thống không thay đổi.',['Giáo viên chọn lớp và bài giao.','Hệ thống hiển thị kết quả theo phạm vi UC33.','Giáo viên chọn Xuất CSV.','Hệ thống xuất họ tên, email, điểm cao nhất thang 10 và số lượt đã nộp của từng người trong bảng thống kê.','Trình duyệt tải tệp CSV về thiết bị.'],'Người chưa có bài nộp có điểm ghi Chưa làm; xuất toàn bộ phạm vi bài giao, không chỉ người đang lọc trên bảng.','Dữ liệu chưa tải được hoặc trình duyệt chặn tải; người dùng tải lại dữ liệu hoặc thử tải tệp lại.')
add(50,'Xem thông báo',BOTH,'Xem các thông báo trong ứng dụng dành riêng cho tài khoản.','Người dùng nhấn biểu tượng chuông hoặc mở Thông báo.','Người dùng đã đăng nhập.','Thông báo của tài khoản được hiển thị; khi mở một thông báo, trạng thái đọc được cập nhật và điều hướng tới nội dung liên quan.',['Hệ thống tải thông báo của tài khoản và số chưa đọc.','Người dùng xem danh sách hoặc lọc chưa đọc.','Người dùng chọn một thông báo.','Hệ thống đánh dấu đã đọc và mở đường dẫn liên quan.','Hệ thống kiểm tra quyền truy cập nội dung đích.'],['Chưa có thông báo; hiển thị danh sách trống.','Người dùng chọn Làm mới; giao diện cũng kiểm tra định kỳ 30 giây khi đang hiển thị và khi quay lại cửa sổ.'],['Không tải được thông báo; thông báo lỗi và cho thử lại.','Nội dung đích đã xóa/hủy hoặc người dùng mất quyền; không cấp quyền truy cập chỉ vì có thông báo cũ.'])
add(51,'Đánh dấu thông báo đã đọc',BOTH,'Cập nhật trạng thái đã đọc cho thông báo của chính tài khoản.','Người dùng mở một thông báo hoặc chọn Đánh dấu tất cả đã đọc.','Đã đăng nhập và đã tải danh sách thông báo.','Trạng thái đã đọc được lưu, số chưa đọc được cập nhật.',['Người dùng chọn thao tác đánh dấu đã đọc.','Hệ thống xác định thông báo thuộc người dùng; với tất cả, xác định mốc thông báo đã tải.','Hệ thống lưu trạng thái đã đọc cho thông báo được chọn hoặc các thông báo đến mốc đó.','Giao diện cập nhật danh sách và số chưa đọc.'],'Thông báo mới đến sau mốc đã tải vẫn giữ chưa đọc khi đánh dấu tất cả.','Thông báo không thuộc tài khoản hoặc cập nhật thất bại; từ chối/thông báo lỗi, cho phép tải lại.')

# Reuse source table structure and paragraph formatting; replace the outdated diagrams.
def paragraph(text='',heading=None):
    p=E.Element(tag('p')); props=E.SubElement(p,tag('pPr'))
    E.SubElement(props,tag('spacing'),{tag('after'):'120'})
    if heading:
        E.SubElement(props,tag('keepNext')); E.SubElement(props,tag('outlineLvl'),{tag('val'):str(heading-1)})
    r=E.SubElement(p,tag('r')); rp=E.SubElement(r,tag('rPr'))
    E.SubElement(rp,tag('rFonts'),{tag('ascii'):'Times New Roman',tag('hAnsi'):'Times New Roman',tag('eastAsia'):'Times New Roman'})
    E.SubElement(rp,tag('sz'),{tag('val'):str(30 if heading==1 else 26 if heading else 24)})
    if heading: E.SubElement(rp,tag('b'))
    E.SubElement(r,tag('t')).text=text
    return p
def pagebreak():
    p=paragraph();E.SubElement(E.SubElement(p,tag('r')),tag('br'),{tag('type'):'page'});return p
def make_table(rec):
    t=deepcopy(tables[0])
    for row in t.findall('w:tr',NS):
        key=txt(row[0]); cell=row[1]
        for child in list(cell):
            if child.tag!=tag('tcPr'):cell.remove(child)
        for j,s in enumerate(rec[key],1):
            if key in ['Basic Flow','Alternative Flow','Exception Flow'] and (key=='Basic Flow' or len(rec[key])>1): s=f'{j}. {s}'
            cell.append(paragraph(s))
        # Allow long flows to continue across pages, avoiding oversized rows.
        for rp in row.findall('w:trPr',NS):
            for x in rp.findall('w:cantSplit',NS):rp.remove(x)
    return t

font_path=r'C:\Windows\Fonts\arial.ttf'
font=ImageFont.truetype(font_path,28); small=ImageFont.truetype(font_path,24); titlefont=ImageFont.truetype(r'C:\Windows\Fonts\arialbd.ttf',32)
def wrap(draw,s,f,width):
    lines=[];line=''
    for word in s.split():
        test=(line+' '+word).strip()
        if draw.textlength(test,font=f)>width and line:lines.append(line);line=word
        else:line=test
    return lines+[line]
def diagram(title,items):
    h=max(650,150+len(items)*100); im=Image.new('RGB',(1650,h),'white');d=ImageDraw.Draw(im)
    d.rectangle((320,55,1370,h-25),outline='#334155',width=3);d.text((360,70),title,font=titlefont,fill='#0f172a')
    positions={'Giáo viên':(120,h//3),'Người học':(120,2*h//3),'Dịch vụ AI':(1510,h//2)}
    for actor,(x,y) in positions.items():
        if not any(actor in actors for _,actors in items):continue
        d.ellipse((x-16,y-57,x+16,y-25),outline='black',width=3);d.line((x,y-25,x,y+22),fill='black',width=3);d.line((x-30,y-7,x+30,y-7),fill='black',width=3);d.line((x,y+22,x-25,y+57),fill='black',width=3);d.line((x,y+22,x+25,y+57),fill='black',width=3)
        d.text((x-d.textlength(actor,font=small)/2,y+66),actor,font=small,fill='black')
    for j,(label,actors) in enumerate(items):
        y=165+j*100
        for actor in actors:
            x,ay=positions[actor];d.line((x+38 if x<300 else x-38,ay,390 if x<300 else 1310,y),fill='#64748b',width=2)
        d.ellipse((390,y-40,1310,y+40),fill='#f1f5f9',outline='#334155',width=2)
        lines=wrap(d,label,font,790)
        for k,line in enumerate(lines):d.text((850-d.textlength(line,font=font)/2,y-len(lines)*17+k*34),line,font=font,fill='#0f172a')
    out=io.BytesIO();im.save(out,format='PNG');return out.getvalue(),im.size
def uc_items(ids):
    output=[]
    for i in ids:
        actors=[a.strip() for a in records[i]['Actor(s)'][0].split(',')]
        if i in [11,12,13]:actors.append('Dịch vụ AI')
        output.append((f'UC{i:02} – '+records[i]['UC Name'][0],actors))
    return output
overview=[('Tài khoản: UC01–UC06',['Giáo viên','Người học']),('Tài liệu và học liệu cá nhân: UC07–UC16, UC41–UC42',['Giáo viên','Người học']),('Tạo học liệu bằng AI: UC11–UC13',['Giáo viên','Người học','Dịch vụ AI']),('Lớp học và tài liệu lớp: UC18–UC31, UC43',['Giáo viên','Người học']),('Làm và quản lý bài giao: UC17, UC32, UC44–UC48',['Giáo viên','Người học']),('Thống kê và xuất kết quả: UC33–UC39, UC49',['Giáo viên','Người học']),('Tổng quan và thông báo: UC40, UC50–UC51',['Giáo viên','Người học'])]
specs=[('Tổng quan các nhóm chức năng',overview),('Tài khoản',uc_items(range(1,7))),('Tài liệu và học liệu cá nhân',uc_items(list(range(7,17))+[41,42])),('Lớp học và tài liệu lớp',uc_items(list(range(18,32))+[43])),('Quiz và quản lý bài giao',uc_items([17,32,44,45,46,47,48])),('Thống kê kết quả',uc_items(list(range(33,40))+[49])),('Tổng quan và thông báo',uc_items([40,50,51]))]
drawing_template=next(deepcopy(p) for p in body.findall('w:p',NS) if p.find('.//w:drawing',NS) is not None)
sect=deepcopy(body.find('w:sectPr',NS))
for x in list(body):body.remove(x)
body.append(paragraph('ĐẶC TẢ USE CASE',1));body.append(paragraph('HỆ THỐNG WEBSITE HỖ TRỢ HỌC TẬP ỨNG DỤNG AI',1))
body.append(paragraph('Bản cập nhật theo mã nguồn hiện tại • Ngày 17/09/2026 • 51 use case'))
body.append(paragraph('Phạm vi: chức năng sử dụng tài khoản thật và dữ liệu lưu trên máy chủ. Chế độ xem trước và AI giả lập phục vụ minh họa, không được coi là kết quả sinh bởi dịch vụ AI thật.'))
body.append(paragraph('1. Tác nhân, phạm vi và quy tắc chung',1))
intro=[
'Giáo viên: quản lý dữ liệu cá nhân, tạo học liệu, tự luyện, quản lý lớp, tài liệu lớp, bài giao và kết quả thuộc lớp mình sở hữu.',
'Người học: quản lý dữ liệu cá nhân, tạo học liệu, tự học, gửi/hủy yêu cầu tham gia lớp, xem tài liệu lớp và làm bài được giao sau khi được duyệt.',
'Dịch vụ AI: tác nhân ngoài hệ thống nhận nội dung nguồn và trả học liệu. Ứng dụng hỗ trợ nhà cung cấp được cấu hình; dữ liệu MOCK phải được nhận diện là giả lập.',
'Tài liệu nguồn là tệp PDF/DOCX/TXT. Học liệu AI là Quiz, Flashcard hoặc Mindmap cá nhân. Bài giao là một đề Quiz cố định gắn với lớp, lịch và điều kiện làm bài.',
'Lớp chỉ chia sẻ tài liệu nguồn; Flashcard và Mindmap phục vụ ôn tập cá nhân. Muốn dùng tài liệu lớp làm nguồn AI, người học phải tải về rồi tự tải lên tài liệu cá nhân.',
'Mọi thao tác phải kiểm tra phiên đăng nhập, vai trò, quyền sở hữu hoặc tư cách thành viên trên máy chủ. Tài khoản bị khóa/ngừng hoạt động không đăng nhập được; phiên bản hiện tại chưa có giao diện quản trị tài khoản.',
'Mỗi câu Quiz có 4 lựa chọn và 1 đáp án đúng. Máy chủ chấm theo phiên bản đề của lượt làm; điểm lưu thang 0–100, hiển thị thang 10.',
'Bài giao có trạng thái DRAFT, PUBLISHED, CANCELLED; trạng thái đang mở/chưa mở/hết hạn còn phụ thuộc lịch. Hạn kết thúc lượt là thời điểm sớm hơn giữa hạn nộp và thời điểm bắt đầu cộng thời lượng nếu có.',
'Hủy bài giao giữ kết quả; xóa bài giao xóa kết quả của bài giao. Xóa Quiz gốc chỉ xóa kết quả tự luyện. Xóa lớp xóa kết quả thuộc các bài giao trong lớp, giữ tài liệu và Quiz gốc.',
'Thống kê lớp dùng điểm cao nhất của mỗi người đã nộp, gồm thành viên hiện tại và người đã rời lớp có kết quả bài giao. Khi nhiều lượt cùng điểm cao nhất, giao diện chọn lượt gặp trước trong dữ liệu sắp theo thời gian nộp.',
'Thông báo chỉ trong ứng dụng, phát sinh khi xin tham gia lớp, duyệt/từ chối, chia sẻ tài liệu mới hoặc công bố bài giao. Chưa có gửi email hoặc WebSocket.',
'Phiên bản hiện tại chưa hỗ trợ OCR, chia sẻ Flashcard/Mindmap cho lớp, thống kê phân bố lựa chọn đáp án hoặc lọc lịch sử theo khoảng thời gian.'
]
for s in intro:body.append(paragraph(s))
body.append(paragraph('2. Sơ đồ use case',1))
body.append(paragraph('Hình tổng quan nhóm các mục tiêu để dễ đọc; các hình chi tiết dùng mã UC tương ứng bảng đặc tả. Đường liền biểu thị liên kết tác nhân–use case, không biểu thị thứ tự xử lý.'))
rels=E.fromstring(files['word/_rels/document.xml.rels'])
image_ids={r.attrib['Target']:r.attrib['Id'] for r in rels}
for idx,(title,items) in enumerate(specs,1):
    body.append(pagebreak());body.append(paragraph(f'2.{idx}. {title}',2))
    png,(width,height)=diagram(title,items);files[f'word/media/image{idx}.png']=png
    p=deepcopy(drawing_template)
    # Keep only the drawing run and paragraph properties.
    for child in list(p):
        if child.tag!=tag('pPr') and child.find('.//w:drawing',NS) is None:p.remove(child)
    cx=min(5700000,int(7600000*width/height));cy=int(cx*height/width)
    for node in p.iter():
        local=node.tag.split('}')[-1]
        if local=='blip':node.set('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed',image_ids[f'media/image{idx}.png'])
        if local in ['extent','ext'] and 'cx' in node.attrib:node.set('cx',str(cx));node.set('cy',str(cy))
        if local=='docPr':node.set('id',str(idx));node.set('name',f'Sơ đồ use case {idx}');node.set('descr',title)
    body.append(p);body.append(paragraph(f'Hình {idx}. {title}'))
body.append(pagebreak());body.append(paragraph('3. Đặc tả chi tiết use case',1))
body.append(paragraph('Giữ mã UC01–UC39 từ bản gốc; bổ sung UC40–UC51. Mức ưu tiên Phải có áp dụng cho phạm vi chức năng của phiên bản đồ án hiện tại.'))
for i,rec in records.items():
    body.append(paragraph(f'3.{i}. UC{i:02} – {rec["UC Name"][0]}',2))
    body.append(make_table(rec));body.append(paragraph(f'Bảng {i}. Đặc tả UC{i:02} – {rec["UC Name"][0]}'))
body.append(sect)
xml=E.tostring(root,encoding='unicode')
# Preserve declarations used by compatibility attributes such as mc:Ignorable.
old_head=original.decode('utf-8').split('>',2)[1] if original.startswith(b'<?xml') else original.decode('utf-8').split('>')[0]
root_end=xml.index('>');head=xml[:root_end]
for prefix,uri in re.findall(r'xmlns:([\w]+)="([^"]+)"',old_head):
    if f'xmlns:{prefix}=' not in head:head+=f' xmlns:{prefix}="{uri}"'
xml=head+xml[root_end:]
files['word/document.xml']=b'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'+xml.encode('utf-8')
with zipfile.ZipFile(OUT,'w',zipfile.ZIP_DEFLATED) as z:
    for name,data in files.items():z.writestr(name,data)
with zipfile.ZipFile(OUT) as z:
    assert z.testzip() is None
    for name in z.namelist():
        if name.endswith(('.xml','.rels')):E.fromstring(z.read(name))
    check=E.fromstring(z.read('word/document.xml'))
    ts=check.findall('w:body/w:tbl',NS);assert len(ts)==51
    assert [txt(t.find('w:tr',NS)[1]) for t in ts]==[f'UC{i:02}' for i in range(1,52)]
    assert len(check.findall('.//w:drawing',NS))==7
print(str(OUT.resolve()))
print('Validated: 51 use cases, 7 diagrams, all package XML files and ZIP integrity.')
