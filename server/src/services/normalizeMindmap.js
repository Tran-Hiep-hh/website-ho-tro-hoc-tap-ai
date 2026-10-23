// Normalize representation only; never invent links or discard branches.
export function normalizeMindmap(nodes) {
  if (!Array.isArray(nodes)) return nodes;
  const identifier = (value) => Number.isSafeInteger(value) ? String(value) : typeof value === "string" ? value.trim() : value;
  const flat = [];
  const visit = (node, parent) => {
    if (!node || typeof node !== "object" || Array.isArray(node)) {
      flat.push(node);
      return;
    }
    const normalizedParent = Object.hasOwn(node, "parent") ? node.parent : node.parentId ?? parent;
    flat.push({
      ...node,
      id: identifier(node.id),
      parent: normalizedParent === null ? null : identifier(normalizedParent),
    });
    if (Array.isArray(node.children)) {
      for (const child of node.children) visit(child, node.id);
    }
  };
  for (const node of nodes) visit(node, null);
  return flat.map((node) => {
    if (!node || typeof node !== "object" || Array.isArray(node)) return node;
    const parent = node.parent;
    return {
      id: identifier(node.id),
      parent: parent === null ? null : identifier(parent),
      label: typeof node.label === "string" ? node.label.trim() : node.label,
    };
  });
}
