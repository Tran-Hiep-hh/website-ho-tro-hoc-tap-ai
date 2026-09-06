import { useEffect, useState } from "react";
import { Button } from "./components/ui/button.jsx";

const apiUrl = import.meta.env.VITE_API_URL ?? "/api";

function App() {
  const [apiStatus, setApiStatus] = useState("Đang kiểm tra...");

  useEffect(() => {
    fetch(`${apiUrl}/health`)
      .then((response) => {
        if (!response.ok) throw new Error("API không phản hồi");
        return response.json();
      })
      .then(() => setApiStatus("API đang hoạt động"))
      .catch(() => setApiStatus("Chưa kết nối được API"));
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <section className="mx-auto max-w-5xl rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
          Đồ án tốt nghiệp
        </p>
        <h1 className="max-w-3xl text-4xl font-bold leading-tight">
          Website hỗ trợ học tập ứng dụng AI
        </h1>
        <p className="mt-4 max-w-2xl text-slate-300">
          Quản lý lớp học, tài liệu và tạo Quiz, Flashcard, Mindmap từ nguồn học tập.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            ["Quiz", "Tạo và giao bài trắc nghiệm"],
            ["Flashcard", "Ôn tập bằng thẻ ghi nhớ"],
            ["Mindmap", "Hệ thống hóa kiến thức"],
          ].map(([title, description]) => (
            <article key={title} className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
              <h2 className="font-semibold text-cyan-300">{title}</h2>
              <p className="mt-2 text-sm text-slate-400">{description}</p>
            </article>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Button>Thêm nguồn học tập</Button>
          <span className="text-sm text-slate-400">{apiStatus}</span>
        </div>
      </section>
    </main>
  );
}

export default App;
