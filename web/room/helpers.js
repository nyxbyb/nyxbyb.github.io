export function safeURL(value, base = 'https://nyxbyb.github.io/web/') {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(String(value), base);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}
export function readPreference(key, fallback = '') {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
export function writePreference(key, value) {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}
export function selectBooks(graph, reading = {}) {
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes.filter(n => n?.type === 'book' && typeof n.title === 'string') : [];
  const titles = Array.isArray(reading.titles) ? reading.titles : [];
  const chosen = titles.map(title => nodes.find(n => n.title === title)).filter(Boolean);
  const limit = Math.min(6, Math.max(1, Number(reading.limit) || 3));
  return [...new Map([...chosen, ...nodes.filter(n => ['read', 'fav'].includes(n.status))].map(n => [n.title, n])).values()].slice(0, limit);
}
export function validateRoom(data) {
  if (!data || typeof data !== 'object' || data.version !== 1 || !data.intro || !data.tea || !Array.isArray(data.tea.steps) || !data.plant || !data.music) throw new Error('Invalid room configuration');
  return data;
}
