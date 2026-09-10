"use client";

import { useState } from "react";
import { avatarColor, initials } from "../lib/ui";
import type { Notif } from "../lib/useNotifications";

export function NotificationBell({
  notifications,
  unread,
  onRead
}: {
  notifications: Notif[];
  unread: number;
  onRead: (id?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bell">
      <button onClick={() => setOpen((o) => !o)} title="Notifications">
        🔔 {unread > 0 && <span className="badge">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && (
        <div className="notif-panel">
          {notifications.length === 0 && <div className="notif-empty">No notifications yet</div>}
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`notif-item ${n.read ? "" : "unread"}`}
              onClick={() => {
                onRead(n.id);
                setOpen(false);
                if (n.boardId) location.href = `/boards/${n.boardId}`;
              }}
            >
              <div className="msg">{n.message}</div>
              <div className="time">{new Date(n.createdAt).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Avatar({ name, size }: { name: string; size?: number }) {
  return (
    <span
      className="avatar"
      style={{ background: avatarColor(name), width: size, height: size, fontSize: (size ?? 32) * 0.36 }}
      title={name}
    >
      {initials(name)}
    </span>
  );
}

export function Toast({ message }: { message: string }) {
  return <div className="toast">{message}</div>;
}