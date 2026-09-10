"use client";

import { useEffect, useMemo, useState } from "react";
import { Api } from "../lib/api";
import { clearToken, getToken } from "../lib/storage";
import { avatarColor, initials } from "../lib/ui";
import Link from "next/link";
import { useNotifications } from "../lib/useNotifications";
import { NotificationBell } from "../components/common";

type BoardRow = {
  id: string;
  name: string;
  color: string;
  archived: boolean;
  createdAt: string;
  cardCount?: number;
  memberCount?: number;
};

export default function HomePage() {
  const [user, setUser] = useState<{ id: string; email: string; name: string } | null>(null);
  const [boards, setBoards] = useState<BoardRow[]>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#14b8a6");
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const { notifications, unread, markRead } = useNotifications();

  const authed = !!getToken();

  useEffect(() => {
    if (!authed) {
      location.href = "/login";
      return;
    }
    Api.me()
      .then((r) => setUser(r.user))
      .catch(() => {
        clearToken();
        location.href = "/login";
      });
  }, [authed]);

  async function loadBoards() {
    try {
      const r = await Api.boards();
      setBoards(r.boards as BoardRow[]);
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    if (authed) loadBoards();
  }, [authed]);

  async function createBoard() {
    if (name.trim().length < 2) return;
    setError(null);
    try {
      const r = await Api.createBoard({ name: name.trim(), color });
      setName("");
      await loadBoards();
      location.href = `/boards/${r.board.id}`;
    } catch (e: any) {
      setError(e.message);
    }
  }

  const visible = useMemo(
    () => boards.filter((b) => showArchived ? true : !b.archived),
    [boards, showArchived]
  );
  const archived = useMemo(() => boards.filter((b) => b.archived), [boards]);

  if (!authed) return null;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="logo">K</span> Kanban
        </div>

        <div>
          <div className="side-label">Boards</div>
          <nav className="board-list">
            {visible.map((b) => (
              <Link key={b.id} href={`/boards/${b.id}`} className="board-item">
                <span className="dot" style={{ background: b.color }} />
                <span>{b.name}</span>
                {typeof b.cardCount === "number" && <span className="count">{b.cardCount}</span>}
              </Link>
            ))}
            {visible.length === 0 && (
              <div style={{ padding: "6px 10px", color: "var(--faint)", fontSize: 13 }}>
                No boards yet — create one below.
              </div>
            )}
          </nav>
        </div>

        <div className="new-board">
          <div className="row">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New board name…"
              onKeyDown={(e) => e.key === "Enter" && createBoard()}
            />
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} title="Board color" />
          </div>
          <button className="primary" onClick={createBoard} disabled={name.trim().length < 2}>
            Create board
          </button>
        </div>

        {archived.length > 0 && (
          <div>
            <div className="side-label" style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Archived</span>
              <button className="ghost tiny" onClick={() => setShowArchived((s) => !s)}>
                {showArchived ? "Hide" : "Show"}
              </button>
            </div>
            {showArchived &&
              archived.map((b) => (
                <Link key={b.id} href={`/boards/${b.id}`} className="board-item archived">
                  <span className="dot" style={{ background: b.color }} />
                  <span>{b.name}</span>
                </Link>
              ))}
          </div>
        )}

        {user && (
          <div className="side-footer">
            <span className="avatar" style={{ background: avatarColor(user.name) }}>
              {initials(user.name)}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="who">{user.name}</div>
              <div className="mail">{user.email}</div>
            </div>
            <button className="ghost tiny" onClick={() => { clearToken(); location.href = "/login"; }}>
              Logout
            </button>
          </div>
        )}
      </aside>

      <div className="main">
        <header className="topbar">
          <h1>Dashboard</h1>
          <span className="spacer" />
          <NotificationBell notifications={notifications} unread={unread} onRead={markRead} />
        </header>

        <main className="dash">
          <h2>Good to see you{user ? `, ${user.name.split(" ")[0]}` : ""}</h2>
          <p className="sub">Pick a board to start collaborating in real time.</p>

          <div className="stat-grid">
            <div className="stat">
              <div className="k">Active boards</div>
              <div className="v accent">{boards.filter((b) => !b.archived).length}</div>
            </div>
            <div className="stat">
              <div className="k">Total cards</div>
              <div className="v">{boards.reduce((a, b) => a + (b.cardCount ?? 0), 0)}</div>
            </div>
            <div className="stat">
              <div className="k">Team members across boards</div>
              <div className="v">{boards.reduce((a, b) => a + (b.memberCount ?? 0), 0)}</div>
            </div>
            <div className="stat">
              <div className="k">Unread notifications</div>
              <div className="v" style={{ color: unread ? "var(--warn)" : "var(--ok)" }}>{unread}</div>
            </div>
          </div>

          <div className="side-label">Your boards</div>
          <div className="board-cards">
            {visible.map((b) => (
              <Link key={b.id} href={`/boards/${b.id}`} className="board-card">
                <div className="head">
                  <span className="dot" style={{ background: b.color, width: 12, height: 12, borderRadius: 4 }} />
                  {b.name}
                </div>
                <div className="meta">
                  <span>🗂 {b.cardCount ?? 0} cards</span>
                  <span>👥 {b.memberCount ?? 1}</span>
                  {b.archived && <span>archived</span>}
                </div>
              </Link>
            ))}
          </div>

          {error && <p style={{ color: "var(--danger)", marginTop: 16 }}>{error}</p>}
        </main>
      </div>
    </div>
  );
}

