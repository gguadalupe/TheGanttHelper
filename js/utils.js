function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getPathLeaf(path) {
  if (!path) return "";
  return String(path).split("\\").filter(Boolean).at(-1) || "";
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function makeId() {
  if (globalThis.crypto && globalThis.crypto.randomUUID) return globalThis.crypto.randomUUID();
  return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeFileName(value) {
  return (value || "project-plan").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project-plan";
}

