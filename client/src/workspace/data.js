export const id = () => crypto.randomUUID();
const relativeDate = (days) =>
  new Date(Date.now() + days * 86400000).toISOString();
export const dateLabel = (value) => new Date(value).toLocaleDateString("vi-VN");
export const typeLabels = {
  QUIZ: "Quiz",
  FLASHCARD: "Flashcard",
  MINDMAP: "Mindmap",
};
export const typeIcons = { QUIZ: "quiz", FLASHCARD: "cards", MINDMAP: "map" };

export const questions = [
  {
    text: "Khóa chính trong cơ sở dữ liệu quan hệ có đặc điểm nào?",
    options: [
      "Có thể trùng lặp",
      "Xác định duy nhất mỗi bản ghi",
      "Luôn chứa văn bản",
      "Có thể nhận giá trị NULL",
    ],
    answer: 1,
    explanation:
      "Khóa chính xác định duy nhất mỗi bản ghi và không được nhận giá trị NULL.",
    source: "Cơ sở dữ liệu — Mục 2.1: Khóa chính",
  },
  {
    text: "Câu lệnh SQL nào dùng để truy vấn dữ liệu?",
    options: ["INSERT", "DELETE", "SELECT", "UPDATE"],
    answer: 2,
    explanation: "SELECT dùng để lấy dữ liệu từ một hoặc nhiều bảng.",
    source: "Cơ sở dữ liệu — Mục 3.1: Truy vấn",
  },
  {
    text: "Khóa ngoại dùng để làm gì?",
    options: [
      "Liên kết dữ liệu giữa các bảng",
      "Mã hóa dữ liệu",
      "Xóa bảng",
      "Sắp xếp cột",
    ],
    answer: 0,
    explanation:
      "Khóa ngoại tham chiếu đến khóa duy nhất của bảng khác hoặc cùng bảng.",
    source: "Cơ sở dữ liệu — Mục 2.2: Khóa ngoại",
  },
  {
    text: "Chuẩn hóa dữ liệu giúp giải quyết vấn đề nào?",
    options: [
      "Tốc độ Internet",
      "Kích thước màn hình",
      "Số lượng người dùng",
      "Dư thừa dữ liệu và bất thường cập nhật",
    ],
    answer: 3,
    explanation:
      "Chuẩn hóa tổ chức các quan hệ để giảm dư thừa và các bất thường khi thêm, sửa, xóa.",
    source: "Cơ sở dữ liệu — Chương 4: Chuẩn hóa",
  },
  {
    text: "INNER JOIN trả về những bản ghi nào?",
    options: [
      "Tất cả bản ghi bảng trái",
      "Những bản ghi thỏa điều kiện nối ở cả hai bảng",
      "Chỉ các bản ghi không khớp",
      "Tất cả bản ghi bảng phải",
    ],
    answer: 1,
    explanation: "INNER JOIN chỉ giữ các cặp bản ghi thỏa điều kiện nối.",
    source: "Cơ sở dữ liệu — Mục 3.4: Phép nối",
  },
];

export function sampleContent(type, title = "Cơ sở dữ liệu quan hệ") {
  return {
    id: id(),
    type,
    title,
    difficulty: "Trung bình",
    createdAt: relativeDate(0),
    sources: ["doc-1"],
    status: "READY",
    questions: structuredClone(questions),
    cards: [
      {
        front: "Khóa chính (Primary Key)",
        back: "Thuộc tính hoặc tập thuộc tính xác định duy nhất mỗi bản ghi trong bảng.",
        keyword: "Khóa",
      },
      {
        front: "Khóa ngoại (Foreign Key)",
        back: "Thuộc tính tham chiếu đến khóa duy nhất của một bảng, giúp đảm bảo toàn vẹn tham chiếu.",
        keyword: "Liên kết",
      },
      {
        front: "Chuẩn hóa dữ liệu",
        back: "Quá trình tổ chức các bảng để giảm dư thừa dữ liệu và tránh bất thường cập nhật.",
        keyword: "Thiết kế",
      },
      {
        front: "Giao dịch (Transaction)",
        back: "Một đơn vị xử lý gồm nhiều thao tác, được thực hiện trọn vẹn hoặc hoàn tác.",
        keyword: "ACID",
      },
      {
        front: "Chỉ mục (Index)",
        back: "Cấu trúc hỗ trợ tìm kiếm bản ghi nhanh hơn, có chi phí lưu trữ và cập nhật bổ sung.",
        keyword: "Hiệu năng",
      },
      {
        front: "INNER JOIN",
        back: "Phép nối lấy các cặp bản ghi thỏa điều kiện nối ở hai bảng.",
        keyword: "SQL",
      },
    ],
    nodes: [
      { id: "root", parent: null, label: "Cơ sở dữ liệu" },
      { id: "rel", parent: "root", label: "Mô hình quan hệ" },
      { id: "sql", parent: "root", label: "Ngôn ngữ SQL" },
      { id: "design", parent: "root", label: "Thiết kế dữ liệu" },
      { id: "pk", parent: "rel", label: "Khóa chính / Khóa ngoại" },
      { id: "query", parent: "sql", label: "SELECT · JOIN · GROUP BY" },
      { id: "normal", parent: "design", label: "Chuẩn hóa 1NF, 2NF, 3NF" },
    ],
  };
}

export function initialData(user = {}) {
  const ownerId = String(user.userId ?? user.id ?? "preview-user");
  const teacherId = user.role === "TEACHER" ? ownerId : "sample-teacher";
  const quiz = {
    ...sampleContent("QUIZ", "Ôn tập cơ sở dữ liệu — Chương 2"),
    id: "quiz-1",
    createdAt: relativeDate(-2),
  };
  const flash = {
    ...sampleContent("FLASHCARD", "Thuật ngữ cơ sở dữ liệu"),
    id: "flash-1",
    createdAt: relativeDate(-3),
  };
  const mindmap = {
    ...sampleContent("MINDMAP", "Tổng quan cơ sở dữ liệu"),
    id: "map-1",
    createdAt: relativeDate(-1),
  };
  return {
    documents: [
      {
        id: "doc-1",
        ownerId: teacherId,
        name: "Cơ sở dữ liệu — Chương 2.pdf",
        type: "PDF",
        size: "2,4 MB",
        date: relativeDate(-2),
        status: "READY",
        text: "CƠ SỞ DỮ LIỆU QUAN HỆ\n\n1. Mô hình quan hệ\nDữ liệu được tổ chức dưới dạng bảng, mỗi hàng là một bản ghi và mỗi cột biểu diễn một thuộc tính.\n\n2. Khóa và toàn vẹn dữ liệu\nKhóa chính xác định duy nhất mỗi bản ghi. Khóa ngoại tạo mối liên kết và đảm bảo toàn vẹn tham chiếu.\n\n3. Truy vấn SQL\nSELECT truy vấn dữ liệu. INNER JOIN kết hợp các bản ghi thỏa điều kiện nối.\n\n4. Chuẩn hóa\nChuẩn hóa giúp giảm dư thừa và tránh các bất thường cập nhật dữ liệu.",
      },
      {
        id: "doc-2",
        ownerId: teacherId,
        name: "Nhập môn công nghệ phần mềm.docx",
        type: "DOCX",
        size: "1,8 MB",
        date: relativeDate(-4),
        status: "READY",
        text: "CÔNG NGHỆ PHẦN MỀM\n\nQuy trình phát triển phần mềm gồm khảo sát, phân tích yêu cầu, thiết kế, triển khai, kiểm thử và bảo trì.\n\nPhân tách trách nhiệm giúp các mô-đun dễ hiểu và dễ thay đổi.",
      },
      {
        id: "doc-3",
        ownerId,
        name: "Ghi chú ôn tập SQL.txt",
        type: "TXT",
        size: "12 KB",
        date: relativeDate(-1),
        status: "READY",
        text: "GHI CHÚ SQL\n\nSELECT: lấy dữ liệu.\nWHERE: lọc bản ghi.\nGROUP BY: nhóm dữ liệu.\nORDER BY: sắp xếp kết quả.\nJOIN: nối các bảng.",
      },
      {
        id: "doc-4",
        ownerId: teacherId,
        name: "Bài giảng cấu trúc dữ liệu.pdf",
        type: "PDF",
        size: "3,2 MB",
        date: relativeDate(-6),
        status: "READY",
        text: "CẤU TRÚC DỮ LIỆU\n\nMảng, danh sách liên kết, ngăn xếp và hàng đợi là các cấu trúc dữ liệu cơ bản. Cây biểu diễn dữ liệu phân cấp.",
      },
    ],
    contents: [quiz, flash, mindmap],
    classes: [
      {
        id: "class-1",
        name: "Cơ sở dữ liệu",
        code: "CSDL26",
        group: "67PM2",
        description:
          "Cùng khám phá mô hình quan hệ, ngôn ngữ SQL và cách thiết kế cơ sở dữ liệu.",
        color: "green",
        teacher: "Nguyễn Minh Anh",
        joined: true,
        materialIds: ["doc-1"],
      },
      {
        id: "class-2",
        name: "Công nghệ phần mềm",
        code: "CNPM26",
        group: "67PM1",
        description:
          "Từ ý tưởng đến sản phẩm: phân tích, thiết kế và xây dựng phần mềm.",
        color: "purple",
        teacher: "Trần Hoàng Nam",
        joined: true,
        materialIds: ["doc-2"],
      },
      {
        id: "class-3",
        name: "Cấu trúc dữ liệu",
        code: "CTDL26",
        group: "67PM2",
        description: "Cấu trúc dữ liệu cơ bản và tư duy giải thuật.",
        color: "orange",
        teacher: "Lê Thu Hà",
        joined: false,
        materialIds: ["doc-4"],
      },
    ],
    members: [
      {
        id: "member-1",
        classId: "class-1",
        name: "Nguyễn Minh An",
        email: "an.nguyen@example.com",
      },
      {
        id: "member-2",
        classId: "class-1",
        name: "Trần Thu Hà",
        email: "ha.tran@example.com",
      },
      {
        id: "member-3",
        classId: "class-1",
        name: "Lê Hoàng Nam",
        email: "nam.le@example.com",
      },
      {
        id: "member-4",
        classId: "class-2",
        name: "Vũ Ngọc Linh",
        email: "linh.vu@example.com",
      },
    ],
    requests: [
      {
        id: "request-1",
        classId: "class-1",
        name: "Phạm Gia Huy",
        email: "huy.pham@example.com",
      },
    ],
    assignments: [
      {
        id: "assignment-1",
        classId: "class-1",
        contentId: "quiz-1",
        title: "Ôn tập chương 2: Mô hình quan hệ",
        startAt: relativeDate(-1),
        dueAt: relativeDate(3),
        maxAttempts: 3,
        showAnswers: true,
        status: "PUBLISHED",
        questions: structuredClone(questions),
      },
      {
        id: "assignment-2",
        classId: "class-2",
        contentId: "quiz-1",
        title: "Kiểm tra kiến thức dữ liệu",
        startAt: relativeDate(2),
        dueAt: relativeDate(5),
        maxAttempts: 2,
        showAnswers: false,
        status: "PUBLISHED",
        questions: structuredClone(questions),
      },
    ],
    attempts: [],
    learned: {},
    profile: null,
    draftAnswers: {},
    classAttempts: [
      {
        id: "class-result-1",
        assignmentId: "assignment-1",
        contentId: "quiz-1",
        userId: "member-1",
        name: "Nguyễn Minh An",
        title: "Ôn tập chương 2: Mô hình quan hệ",
        score: 80,
        date: relativeDate(0),
        answers: [1, 2, 0, 0, 1],
        questions: structuredClone(questions),
        showAnswers: true,
      },
      {
        id: "class-result-2",
        assignmentId: "assignment-1",
        contentId: "quiz-1",
        userId: "member-2",
        name: "Trần Thu Hà",
        title: "Ôn tập chương 2: Mô hình quan hệ",
        score: 60,
        date: relativeDate(0),
        answers: [1, 0, 0, 3, 0],
        questions: structuredClone(questions),
        showAnswers: true,
      },
    ],
    notifications: [
      {
        id: "notice-1",
        title: "Bài Quiz mới đang chờ bạn",
        text: "Ôn tập chương 2: Mô hình quan hệ đã được mở trong lớp Cơ sở dữ liệu.",
        route: "assignments",
        read: false,
        date: relativeDate(0),
        icon: "quiz",
      },
      {
        id: "notice-2",
        title: "Học liệu mới trong lớp",
        text: "Bộ Flashcard Thuật ngữ cơ sở dữ liệu đã sẵn sàng để ôn tập.",
        route: "classes/class-1",
        read: false,
        date: relativeDate(-1),
        icon: "cards",
      },
      {
        id: "notice-3",
        title: "Chào mừng đến với StudyAI",
        text: "Khám phá không gian học tập và bắt đầu với tài liệu đầu tiên của bạn.",
        route: "documents",
        read: true,
        date: relativeDate(-2),
        icon: "spark",
      },
    ],
  };
}
