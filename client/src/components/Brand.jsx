export function Icon({ name, size = 20, ...props }) {
  const paths = {
    book: (
      <>
        <path d="M12 6v15M3 3h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5v16h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3Z" />
      </>
    ),
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    eye: (
      <>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    hidden: (
      <path d="m3 3 18 18M10.5 5.1 12 5c6.5 0 10 7 10 7a22 22 0 0 1-3 3.8M6.1 6.1A23 23 0 0 0 2 12s3.5 7 10 7c1.8 0 3.4-.5 4.8-1.2M10 10a3 3 0 0 0 4 4" />
    ),
    logout: <path d="M9 4H4v16h5m6-13 5 5-5 5M8 12h12" />,
    spark: (
      <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" />
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3" />
      </>
    ),
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="7" r="3" />
        <path d="M3 21v-3a6 6 0 0 1 12 0v3m1-17a3 3 0 0 1 0 6m3 11v-3a6 6 0 0 0-2-4" />
      </>
    ),
    file: (
      <>
        <path d="M14 2H5v20h14V7Zm0 0v6h5M8 12h8m-8 4h6" />
      </>
    ),
    quiz: (
      <>
        <rect x="4" y="3" width="16" height="19" rx="2" />
        <path d="m8 9 1 1 2-2m2 1h3m-8 6 1 1 2-2m2 1h3" />
      </>
    ),
    cards: (
      <>
        <rect x="6" y="7" width="15" height="14" rx="2" />
        <path d="M17 4H5a2 2 0 0 0-2 2v11m8-4h5m-5 4h3" />
      </>
    ),
    map: (
      <>
        <rect x="8" y="2" width="8" height="5" rx="1" />
        <path d="M12 7v5m-8 4v-4h16v4" />
        <rect x="1" y="16" width="6" height="5" rx="1" />
        <rect x="9" y="16" width="6" height="5" rx="1" />
        <rect x="17" y="16" width="6" height="5" rx="1" />
      </>
    ),
    chart: <path d="M3 3v18h18M7 16v-5m5 5V7m5 9V4" />,
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
      </>
    ),
    search: (
      <>
        <circle cx="10" cy="10" r="6" />
        <path d="m15 15 6 6" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    upload: (
      <>
        <path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5" />
      </>
    ),
    edit: (
      <>
        <path d="m14 5 5 5M4 20l5-1L21 7l-5-5L4 14Zm0 0h16" />
      </>
    ),
    trash: <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    chevron: <path d="m9 5 7 7-7 7" />,
    back: <path d="M19 12H5m6-6-6 6 6 6" />,
    settings: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 22v-3a8 8 0 0 1 16 0v3" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 7V2m0 5h-5M4 17v5m0-5h5" />
        <path d="M4 9a8 8 0 0 1 14-5l2 3M4 17l2 3a8 8 0 0 0 14-5" />
      </>
    ),
    folder: <path d="M3 5h6l2 3h10v12H3Z" />,
    trophy: (
      <>
        <path d="M8 3h8v7a4 4 0 0 1-8 0Zm0 2H3v3a4 4 0 0 0 5 4m8-7h5v3a4 4 0 0 1-5 4m-4 2v6m-4 1h8" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name] ?? paths.book}
    </svg>
  );
}

export function Brand({ light = false, href = "#/login" }) {
  return (
    <a
      className={`brand ${light ? "brand-light" : ""}`}
      href={href}
      aria-label="StudyAI — Trang chính"
    >
      <span className="brand-mark">
        <Icon name="book" size={23} />
      </span>
      <span>
        Study<span className="brand-ai">AI</span>
      </span>
    </a>
  );
}
