// Keep action buttons (delete, download, etc.) independent of the surrounding card.
export function clickable(action, label, row = false) {
  return {
    ...(row ? {} : { role: "link" }),
    tabIndex: 0,
    "aria-label": label,
    onClick(event) {
      if (event.target !== event.currentTarget && event.target.closest("button, a, input, select, textarea, [role='button']")) return;
      action();
    },
    onKeyDown(event) {
      if (event.target === event.currentTarget && ["Enter", " "].includes(event.key)) {
        event.preventDefault(); action();
      }
    },
  };
}
