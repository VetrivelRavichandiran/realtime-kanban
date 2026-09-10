const PALETTE = ["#14b8a6", "#6366f1", "#f59e0b", "#ec4899", "#22c55e", "#0ea5e9", "#ef4444", "#a855f7"];

export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function relTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function dueState(iso: string | null): { text: string; cls: string } | null {
  if (!iso) return null;
  const due = new Date(iso);
  const now = new Date();
  const days = (due.getTime() - now.getTime()) / 86400000;
  const text = due.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (days < 0) return { text: `Overdue · ${text}`, cls: "overdue" };
  if (days < 2) return { text: `Due ${text}`, cls: "soon" };
  return { text, cls: "" };
}

export function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(v: string): string | null {
  if (!v) return null;
  return new Date(v).toISOString();
}