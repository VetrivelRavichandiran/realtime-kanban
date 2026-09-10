import { getToken } from "./storage";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

async function request(path: string, init?: RequestInit) {
  const token = getToken();
  const res = await fetch(`${API}/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {})
    }
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message ?? `Request failed (${res.status})`);
  return data;
}

export const Api = {
  health: () => request("/health"),

  register: (body: { email: string; name: string; password: string }) =>
    request("/auth/register", { method: "POST", body: JSON.stringify(body) }),

  login: (body: { email: string; password: string }) =>
    request("/auth/login", { method: "POST", body: JSON.stringify(body) }),

  me: () => request("/me"),

  boards: () => request("/boards"),
  createBoard: (body: { name: string; color?: string }) =>
    request("/boards", { method: "POST", body: JSON.stringify(body) }),

  board: (id: string) => request(`/boards/${id}`),
  updateBoard: (id: string, body: { name?: string; color?: string }) =>
    request(`/boards/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  archiveBoard: (id: string, archived: boolean) =>
    request(`/boards/${id}/${archived ? "archive" : "unarchive"}`, { method: "POST" }),
  deleteBoard: (id: string) => request(`/boards/${id}`, { method: "DELETE" }),

  inviteMember: (id: string, body: { email: string; role: "admin" | "member" }) =>
    request(`/boards/${id}/members`, { method: "POST", body: JSON.stringify(body) }),
  removeMember: (boardId: string, userId: string) =>
    request(`/boards/${boardId}/members/${userId}`, { method: "DELETE" }),

  search: (id: string, q: string) => request(`/boards/${id}/search?q=${encodeURIComponent(q)}`),

  card: (id: string) => request(`/cards/${id}`),

  uploadAttachment: async (cardId: string, file: File) => {
    const token = getToken();
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API}/api/cards/${cardId}/attachments`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message ?? "Upload failed");
    return data;
  },
  attachmentUrl: (cardId: string, attachmentId: string) =>
    `${API}/api/cards/${cardId}/attachments/${attachmentId}`,
  deleteAttachment: (cardId: string, attachmentId: string) =>
    request(`/cards/${cardId}/attachments/${attachmentId}`, { method: "DELETE" }),

  notifications: () => request("/notifications"),
  markRead: (id?: string) =>
    request("/notifications/read", { method: "POST", body: JSON.stringify(id ? { id } : {}) }),

  stats: (boardId: string) => request(`/stats/boards/${boardId}`)
};