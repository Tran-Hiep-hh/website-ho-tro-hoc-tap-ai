import { useMemo, useRef, useState } from "react";
import { useWorkspace } from "./WorkspaceContext.jsx";
import { id } from "./data.js";
import { Button, Field } from "./ui.jsx";

function layoutTree(nodes) {
  let leaf = 0;
  const positions = [];
  function place(node, depth) {
    const children = nodes.filter((item) => item.parent === node.id);
    const childrenPositions = children.map((child) => place(child, depth + 1));
    const y = childrenPositions.length
      ? childrenPositions.reduce((sum, child) => sum + child.y, 0) /
        childrenPositions.length
      : 70 + leaf++ * 110;
    const position = { ...node, x: 30 + depth * 235, y };
    positions.push(position);
    return position;
  }
  const root = nodes.find((node) => !node.parent);
  if (root) place(root, 0);
  return {
    positions,
    width: Math.max(850, ...positions.map((node) => node.x + 220)),
    height: Math.max(420, leaf * 110 + 45),
  };
}

export default function MindmapEditor({ item, onChange }) {
  const { update, notify, confirm } = useWorkspace();
  const [localNodes, setLocalNodes] = useState(() => structuredClone(item.nodes));
  const nodes = onChange ? item.nodes : localNodes;
  const setNodes = (next) => onChange ? onChange(next) : setLocalNodes(next);
  const [selected, setSelected] = useState(item.nodes[0].id);
  const [zoom, setZoom] = useState(1);
  const svgRef = useRef(null);
  const { positions, width, height } = useMemo(
    () => layoutTree(nodes),
    [nodes],
  );
  const node = nodes.find((entry) => entry.id === selected);
  function descendants(key) {
    return nodes
      .filter((entry) => entry.parent === key)
      .flatMap((entry) => [entry.id, ...descendants(entry.id)]);
  }
  const forbiddenParents = node ? [node.id, ...descendants(node.id)] : [];
  async function exportPng() {
    const svg = svgRef.current.cloneNode(true);
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));
    const source = URL.createObjectURL(
      new Blob([new XMLSerializer().serializeToString(svg)], {
        type: "image/svg+xml;charset=utf-8",
      }),
    );
    try {
      const image = new Image();
      image.src = source;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = width * 2;
      canvas.height = height * 2;
      const context = canvas.getContext("2d");
      context.scale(2, 2);
      context.drawImage(image, 0, 0);
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error("export");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${item.title}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify("Đã xuất Mindmap thành PNG.");
    } catch {
      notify("Không thể xuất ảnh. Hãy thử lại.");
    } finally {
      URL.revokeObjectURL(source);
    }
  }
  function exportPdf() {
    const popup = window.open("", "_blank", "width=1100,height=750");
    if (!popup) {
      notify("Hãy cho phép cửa sổ bật lên để in hoặc lưu PDF.");
      return;
    }
    popup.opener = null;
    popup.document.title = item.title;
    const title = popup.document.createElement("h1");
    title.textContent = item.title;
    title.style.font = "22px sans-serif";
    popup.document.body.appendChild(title);
    const svg = svgRef.current.cloneNode(true);
    svg.style.width = "100%";
    svg.style.height = "auto";
    popup.document.body.appendChild(svg);
    const style = popup.document.createElement("style");
    style.textContent =
      "@page { size: landscape; margin: 12mm; } body { margin: 20px; }";
    popup.document.head.appendChild(style);
    popup.focus();
    popup.print();
  }
  return (
    <>
      <div className="ws-toolbar">
        <p className="ws-muted">
          Chọn một nút để chỉnh sửa. Dùng thanh cuộn để xem sơ đồ lớn.
        </p>
        <div className="ws-actions">
          <Button variant="secondary" icon="download" onClick={exportPng}>
            Xuất PNG
          </Button>
          <Button variant="secondary" onClick={exportPdf}>
            In / Lưu PDF
          </Button>
          {!onChange && <Button
            icon="check"
            onClick={() => {
              if (nodes.some((entry) => !entry.label.trim())) {
                notify("Mỗi nút cần có nội dung.");
                return;
              }
              update("contents", item.id, { nodes });
              notify("Đã lưu sơ đồ trong bản xem trước.");
            }}
          >
            Lưu Mindmap
          </Button>}
        </div>
      </div>
      <div className="ws-mindmap-layout">
        <section className="ws-map-canvas">
          <div className="ws-map-scroll">
            <svg
              ref={svgRef}
              xmlns="http://www.w3.org/2000/svg"
              viewBox={`0 0 ${width} ${height}`}
              width={width * zoom}
              height={height * zoom}
              aria-label="Sơ đồ tư duy tương tác"
              role="group"
            >
              <rect width={width} height={height} fill="#fafcf7" />
              {positions
                .filter((entry) => entry.parent)
                .map((entry) => {
                  const parent = positions.find((p) => p.id === entry.parent);
                  return (
                    <path
                      key={`edge-${entry.id}`}
                      d={`M${parent.x + 190},${parent.y} C${parent.x + 218},${parent.y} ${entry.x - 28},${entry.y} ${entry.x},${entry.y}`}
                      fill="none"
                      stroke="#bed0ad"
                      strokeWidth="2"
                    />
                  );
                })}
              {positions.map((entry) => (
                <g
                  key={entry.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Nút ${entry.label}`}
                  onClick={() => setSelected(entry.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelected(entry.id);
                    }
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <rect
                    x={entry.x}
                    y={entry.y - 28}
                    width="190"
                    height="56"
                    rx="9"
                    fill={
                      !entry.parent
                        ? "#325f40"
                        : entry.id === selected
                          ? "#e6f0d9"
                          : "#ffffff"
                    }
                    stroke={entry.id === selected ? "#6f9656" : "#dae4cf"}
                    strokeWidth={entry.id === selected ? 2 : 1}
                  />
                  <text
                    x={entry.x + 95}
                    y={entry.y - (entry.label.length > 24 ? 5 : -4)}
                    fill={entry.parent ? "#4b663e" : "#ffffff"}
                    textAnchor="middle"
                    fontFamily="Segoe UI, sans-serif"
                    fontSize="11"
                  >
                    {entry.label.length > 24 ? (
                      <>
                        <tspan x={entry.x + 95}>
                          {entry.label.slice(0, 24)}
                        </tspan>
                        <tspan x={entry.x + 95} dy="17">
                          {entry.label.slice(24, 48)}
                        </tspan>
                      </>
                    ) : (
                      entry.label
                    )}
                  </text>
                </g>
              ))}
            </svg>
          </div>
          <div className="ws-map-controls">
            <Button
              variant="secondary"
              aria-label="Thu nhỏ"
              disabled={zoom <= 0.6}
              onClick={() => setZoom(Math.max(0.6, zoom - 0.1))}
            >
              −
            </Button>
            <span>{Math.round(zoom * 100)}%</span>
            <Button
              variant="secondary"
              aria-label="Phóng to"
              disabled={zoom >= 1.6}
              onClick={() => setZoom(Math.min(1.6, zoom + 0.1))}
            >
              +
            </Button>
            <Button variant="ghost" onClick={() => setZoom(1)}>
              Đặt lại
            </Button>
          </div>
        </section>
        <aside className="ws-panel ws-node-editor">
          <h2>Chỉnh sửa nút</h2>
          {node && (
            <>
              <Field label="Nội dung nút">
                <textarea
                  value={node.label}
                  maxLength={48}
                  onChange={(event) =>
                    setNodes(
                      nodes.map((entry) =>
                        entry.id === selected
                          ? { ...entry, label: event.target.value }
                          : entry,
                      ),
                    )
                  }
                />
              </Field>
              {node.parent && (
                <Field label="Nút cha">
                  <select
                    value={node.parent}
                    onChange={(event) =>
                      setNodes(
                        nodes.map((entry) =>
                          entry.id === selected
                            ? { ...entry, parent: event.target.value }
                            : entry,
                        ),
                      )
                    }
                  >
                    {nodes
                      .filter((entry) => !forbiddenParents.includes(entry.id))
                      .map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.label}
                        </option>
                      ))}
                  </select>
                </Field>
              )}
              <Button
                variant="secondary"
                icon="plus"
                disabled={nodes.length >= 30}
                onClick={() => {
                  const next = {
                    id: id(),
                    parent: node.id,
                    label: "Ý tưởng mới",
                  };
                  setNodes([...nodes, next]);
                  setSelected(next.id);
                }}
              >
                Thêm nhánh con
              </Button>
              <Button
                variant="danger"
                icon="trash"
                disabled={!node.parent}
                onClick={() =>
                  confirm({
                    title: "Xóa nhánh kiến thức?",
                    text: "Nút đã chọn và các nút con sẽ bị xóa khỏi sơ đồ đang chỉnh sửa.",
                    action: () => {
                      setNodes(
                        nodes.filter(
                          (entry) => !forbiddenParents.includes(entry.id),
                        ),
                      );
                      setSelected(nodes.find((entry) => !entry.parent).id);
                    },
                  })
                }
              >
                Xóa nhánh
              </Button>
            </>
          )}
          <small>
            {nodes.length}/30 nút. {onChange ? "Thay đổi được giữ trong bản nháp. Nhấn Lưu vào thư viện ở phía trên khi hoàn tất." : "Nhấn Lưu Mindmap để giữ thay đổi trong phiên này."}
          </small>
        </aside>
      </div>
    </>
  );
}
