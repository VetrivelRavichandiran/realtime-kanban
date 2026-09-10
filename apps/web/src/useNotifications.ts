"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Api } from "./api";
import { getToken } from "./storage";
import { createSocket } from "./socket";

export type Notif = {
  id: string;
  userId: string;
  type: string;
  message: string;
  cardId?: string | null;
  boardId?: string | null;
  read: boolean;
  createdAt: string;
};

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notif[]>([]);
  const socketRef = useRef<ReturnType<typeof createSocket> | null>(null);

  const refresh = useCallback(async () => {
    if (!getToken()) return;
    try {
      const r = await Api.notifications();
      setNotifications(r.notifications as Notif[]);
    } catch {
      /* ignore polling errors */
    }
  }, []);

  useEffect(() => {
    if (!getToken()) return;
    refresh();
    const poll = setInterval(refresh, 15000);

    const socket = createSocket();
    socketRef.current = socket;
    socket.on("notification:new", ({ notification }) => {
      setNotifications((prev) => [notification, ...prev].slice(0, 50));
    });
    socket.on("connect", () => refresh());

    return () => {
      clearInterval(poll);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [refresh]);

  const markRead = useCallback(async (id?: string) => {
    try {
      await Api.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (id ? (n.id === id ? { ...n, read: true } : n) : { ...n, read: true }))
      );
    } catch {
      /* ignore */
    }
  }, []);

  const unread = notifications.filter((n) => !n.read).length;

  return { notifications, unread, markRead, refresh };
}