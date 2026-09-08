// Deterministic fixtures; this provider makes no external API calls.
export async function generateStudyMaterial(input) {
  const cards = [
    { front: "Khóa chính", back: "Xác định duy nhất mỗi bản ghi trong bảng.", keyword: "Khóa" },
    { front: "Khóa ngoại", back: "Tham chiếu đến khóa của bảng được liên kết.", keyword: "Liên kết" },
    { front: "SELECT", back: "Câu lệnh truy vấn dữ liệu trong SQL.", keyword: "SQL" },
    { front: "Chuẩn hóa", back: "Tổ chức dữ liệu nhằm giảm dư thừa và bất thường cập nhật.", keyword: "Thiết kế" },
    { front: "Giao dịch", back: "Một nhóm thao tác được thực hiện trọn vẹn hoặc hoàn tác.", keyword: "ACID" },
    { front: "INNER JOIN", back: "Lấy các cặp bản ghi thỏa điều kiện nối ở cả hai bảng.", keyword: "SQL" },
  ];
  const nodes = [
    { id: "root", parent: null, label: "Cơ sở dữ liệu" },
    { id: "keys", parent: "root", label: "Khóa và quan hệ" },
    { id: "sql", parent: "root", label: "Truy vấn SQL" },
    { id: "design", parent: "root", label: "Thiết kế dữ liệu" },
    { id: "pk", parent: "keys", label: "Khóa chính và khóa ngoại" },
    { id: "query", parent: "sql", label: "SELECT và JOIN" },
    { id: "normal", parent: "design", label: "Chuẩn hóa" },
  ];
  return { ...input, generationMode: "MOCK", ...(input.type === "FLASHCARD"
    ? { cards: Array.from({ length: input.quantity }, (_, index) => ({ ...cards[index % cards.length] })) }
    : { nodes: input.detail === "overview" ? nodes.filter((node) => !node.parent || node.parent === "root") : nodes }) };
}
