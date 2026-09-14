// Normalize representation only; never invent links or discard branches.
export function normalizeMindmap(nodes) {
  if (!Array.isArray(nodes)) return nodes;
  const identifier = (value) => Number.isSafeInteger(value) ? String(value) : typeof value === "string" ? value.trim() : value;
  return nodes.map((node) => {
    if (!node || typeof node !== "object" || Array.isArray(node)) return node;
    const parent = Object.hasOwn(node, "parent") ? node.parent : node.parentId;
    return {
      id: identifier(node.id),
      parent: parent === null ? null : identifier(parent),
      label: typeof node.label === "string" ? node.label.trim() : node.label,
    };
  });
}
