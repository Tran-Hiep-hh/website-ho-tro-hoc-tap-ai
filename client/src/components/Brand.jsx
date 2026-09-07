export function Icon({ name, size = 20, ...props }) {
  const paths = {
    book: <><path d="M12 6v15M3 3h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5v16h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3Z" /></>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
    hidden: <path d="m3 3 18 18M10.5 5.1 12 5c6.5 0 10 7 10 7a22 22 0 0 1-3 3.8M6.1 6.1A23 23 0 0 0 2 12s3.5 7 10 7c1.8 0 3.4-.5 4.8-1.2M10 10a3 3 0 0 0 4 4" />,
    logout: <path d="M9 4H4v16h5m6-13 5 5-5 5M8 12h12" />,
    spark: <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" />,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] ?? paths.book}</svg>;
}

export function Brand({ light = false }) {
  return <a className={`brand ${light ? "brand-light" : ""}`} href="#/login" aria-label="StudyAI — Trang chính">
    <span className="brand-mark"><Icon name="book" size={23} /></span>
    <span>Study<span className="brand-ai">AI</span></span>
  </a>;
}
