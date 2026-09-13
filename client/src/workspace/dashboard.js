const time = (value) => new Date(value).getTime() || 0;
const newest = (items, key) => [...items].sort((a, b) => time(b[key]) - time(a[key]));

export function dashboardData(data, isTeacher, personalDocuments, now = new Date()) {
  const classes = data.classes.filter((item) => isTeacher || item.joined);
  const classIds = new Set(classes.map((item) => item.id));
  const members = data.members.filter((item) => classIds.has(item.classId));
  const requests = data.requests.filter((item) => classIds.has(item.classId));
  const assignments = data.assignments.filter((item) => classIds.has(item.classId));
  const attempts = data.attempts.filter((item) => item.status !== "IN_PROGRESS" && Number.isFinite(item.score));
  const submissions = data.classAttempts.filter((item) => assignments.some((a) => a.id === item.assignmentId) && item.status !== "IN_PROGRESS" && Number.isFinite(item.score));
  const upcoming = assignments.filter((item) => item.status === "PUBLISHED" && time(item.dueAt) > now.getTime() && (isTeacher || item.inProgress || (item.attemptsUsed ?? attempts.filter((a) => a.assignmentId === item.id).length) < item.maxAttempts)).sort((a, b) => time(a.dueAt) - time(b.dueAt));
  const cards = data.contents.filter((item) => item.type === "FLASHCARD").map((item) => {
    const learned = new Set((data.learned[item.id] ?? []).filter((index) => Number.isInteger(index) && index >= 0 && index < item.cards.length));
    return { ...item, remembered: learned.size, total: item.cards.length };
  });
  const events = [...personalDocuments.map((item) => item.date), ...data.contents.map((item) => item.createdAt), ...(isTeacher ? submissions : attempts).map((item) => item.date)];
  const activity = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now); date.setDate(date.getDate() - 6 + index);
    return { label: date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }), count: events.filter((value) => new Date(value).toDateString() === date.toDateString()).length };
  });
  return {
    classes, requests, upcoming, cards, activity,
    studentCount: new Set(members.map((item) => item.userId ?? item.id)).size,
    publishedCount: assignments.filter((item) => item.status === "PUBLISHED").length,
    average: attempts.length ? attempts.reduce((sum, item) => sum + item.score, 0) / attempts.length : null,
    attemptCount: attempts.length,
    recentContents: newest(data.contents, "createdAt").slice(0, 3),
    recentResults: newest(isTeacher ? submissions : attempts, "date").slice(0, 5),
    remembered: cards.reduce((sum, item) => sum + item.remembered, 0),
    totalCards: cards.reduce((sum, item) => sum + item.total, 0),
  };
}
