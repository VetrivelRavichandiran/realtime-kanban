const KEY = "kanban_token";

export function setToken(token: string) {
  localStorage.setItem(KEY, token);
}
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY);
}
export function clearToken() {
  localStorage.removeItem(KEY);
}