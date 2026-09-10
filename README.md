# ⚡ Realtime Kanban — Advanced Collaborative Workspace

A production-grade, realtime **Trello-style Kanban platform** with true multi-user collaboration, role-based access control, and a polished dark SOC-style UI.

> **Demo data is synthetic.** All seeded users, boards and cards are generated for demonstration.

---

## ✨ Features

| Area | What you get |
|---|---|
| **Realtime core** | Socket.IO live sync — open the same board in two windows/tabs and watch every change appear instantly. Live **presence** (who's viewing, green-ring avatars). |
| **Auth & teams** | JWT register/login, boards with **membership roles** (owner 👑 / admin / member), invite by email, remove members, per-role permissions on every REST + socket action. |
| **Boards** | Create with custom color, rename, recolor, **archive/unarchive**, delete, per-board card & member counts. |
| **Cards** | Rich cards: **labels** (create/toggle/delete), **due dates** (overdue = red, <48h = amber), **priority** (low→urgent), **cover colors**, **checklists** with progress bars, **assignees**, comments, attachments. |
| **Comments & mentions** | Threaded comments per card with **@Name mentions** that push a realtime notification to the mentioned member. Delete own (or admin removes any). |
| **Notifications** | Bell with unread badge — **invites, @mentions, assignments**, realtime `notification:new` push + 15s polling fallback, mark one/all read. |
| **Files** | Multipart **attachment upload/download/delete** per card (Multer + static serving). |
| **Search & filters** | Full-text card search (title/description/label) with live results dropdown; filter by **assignee, label, overdue**. |
| **Activity feed** | Per-board audit trail with actor names and relative timestamps, streamed live. |
| **Drag & drop** | HTML5 DnD with **fractional positioning** (midpoint math + reindex) — precise ordering between cards, across lists, no renumbering storms. |
| **Stats** | Per-list counts, total cards, overdue count, done-ratio, top labels — surfaced live in the board toolbar. |
| **Reliability** | Live **connection indicator** (Live / Reconnecting), auto-reconnect, precise realtime patches (no stale cards after delete/list removal), position **reindexing** when drag gaps get tight, SSR-safe sockets. |
| **Ops** | Vitest unit tests (API + web), TypeScript strict, ESLint flat configs, GitHub Actions CI (typecheck + test + build), Docker Compose with production builds, **zero-infra SQLite mode**. |

---

## 🏗 Architecture

```
┌────────────────────────┐        REST (JSON)         ┌──────────────────────────┐
│  Next.js 14 (web)      │ ─────────────────────────▶ │  Express 4 (api)         │
│  App Router + TS       │ ◀───────────────────────── │  zod validation          │
│  socket.io-client      │        Socket.IO (events)  │  JWT auth + RBAC         │
│  dark-theme UI         │ ─────────────────────────▶ │  Multer uploads          │
└────────────────────────┘ ◀───────────────────────── └────────────┬─────────────┘
                                                                   │ Prisma 5
                                                          ┌────────┴─────────┐
                                                          │  PostgreSQL 16   │  (production / docker)
                                                          │  or SQLite       │  (zero-infra dev)
                                                          └──────────────────┘
```

**Monorepo** (pnpm workspaces):

```
realtime-kanban/
├── apps/
│   ├── web/                  # Next.js 14 App Router, TypeScript, dark UI
│   │   └── src/
│   │       ├── app/          # /, /login, /register, /boards/[id]
│   │       ├── components/   # NotificationBell, Avatar, Toast
│   │       └── lib/          # api client, socket factory, storage, ui utils
│   └── api/                  # Express + Socket.IO + Prisma
│       ├── src/              # routes, socket handlers, permissions, positions
│       ├── prisma/           # schema (postgres + sqlite), seed
│       └── scripts/          # setup-sqlite.ts
├── packages/shared/          # @rk/shared — types + SocketEvents contract
├── .github/workflows/ci.yml  # typecheck + build on push/PR
├── .vscode/                  # tasks, launch, recommended extensions
└── docker-compose.yml        # db + api + web
```

---

## 🚀 Quick start

### Prerequisites
- **Node.js 20+** (LTS) — on Windows: `winget install OpenJS.NodeJS.LTS`
- **pnpm 9** — `corepack enable && corepack prepare pnpm@9.12.0 --activate`

### Option A — Zero infrastructure (SQLite, recommended to try)

```bash
pnpm install
pnpm db:setup:sqlite      # creates apps/api/prisma/dev.db + seeds demo data
```

Then two terminals:

```bash
pnpm --filter api dev     # API on http://localhost:4000
pnpm --filter web dev     # Web on http://localhost:3000
```

### Option B — Docker Compose (PostgreSQL)

```bash
pnpm install
docker compose up --build
```

### Option C — Local PostgreSQL

1. Start Postgres, create DB `kanban`.
2. Set `apps/api/.env` → `DATABASE_URL="postgresql://user:pass@localhost:5432/kanban?schema=public"`.
3. `pnpm install && pnpm db:setup:postgres`
4. Run the two dev commands from Option A.

### Demo accounts (seeded)

| Email | Password |
|---|---|
| `demo@kanban.dev` | `Password123!` |
| `ana@kanban.dev` | `Password123!` |

Open the board, then open it in a **second browser window** (log in as the other user) to see realtime sync, presence and notifications in action.

---

## 💻 Running in VS Code (Windows / PowerShell)

1. **Install Node LTS** (once): `winget install OpenJS.NodeJS.LTS` → restart VS Code.
2. **Enable pnpm**: `corepack enable` (then `corepack prepare pnpm@9.12.0 --activate` if prompted).
3. Open the `realtime-kanban` folder in VS Code.
4. **Install deps**: terminal → `pnpm install`
5. **Set up the DB**: `Ctrl+Shift+P` → **Tasks: Run Task** → `Kanban: Setup DB (SQLite)`
6. **Run the API**: `Ctrl+Shift+P` → Run Task → `Kanban: Run API` (or open the DEBUGGER panel → **Launch API** → F5)
7. **Run the web**: Run Task → `Kanban: Run Web`
8. Open **http://localhost:3000**, log in as `demo@kanban.dev` / `Password123!`.

> **PowerShell note:** if VS Code blocks script activation, run once:
> `Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned`

---

## 🔌 REST API

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| POST | `/api/auth/register` | create account, returns JWT | public |
| POST | `/api/auth/login` | login, returns JWT | public |
| GET | `/api/me` | current user | member |
| GET | `/api/boards` | my boards (counts, color, archived) | member |
| POST | `/api/boards` | create board (name, color) | any user |
| GET | `/api/boards/:id` | board + members + list counts | member |
| PATCH | `/api/boards/:id` | rename / recolor | admin+ |
| POST | `/api/boards/:id/archive` · `/unarchive` | toggle archive | admin+ |
| DELETE | `/api/boards/:id` | delete board | owner |
| POST | `/api/boards/:id/members` | invite by email `{email, role}` | admin+ |
| DELETE | `/api/boards/:id/members/:userId` | remove member | owner |
| GET | `/api/boards/:id/search?q=` | search cards by title/desc/label | member |
| GET | `/api/stats/boards/:id` | per-list counts, overdue, done-ratio | member |
| GET | `/api/cards/:id` | full card (labels, checklist, comments, attachments, assignees) | member |
| POST | `/api/cards/:id/attachments` | multipart upload (`file`) | member |
| GET | `/api/cards/:id/attachments/:aid` | download attachment | member |
| DELETE | `/api/cards/:id/attachments/:aid` | delete attachment | member |
| GET | `/api/notifications` | my notifications (50 latest) | member |
| POST | `/api/notifications/read` | mark one (`{id}`) or all read | member |

## 📡 Socket.IO events

**Client → server** (all permission-checked):
`board:join` · `list:create|rename|move|delete` · `card:create|update|move|delete` · `label:create|delete` · `card:setLabels` · `checklist:add|toggle|remove` · `card:assign` · `comment:create|delete` · `board:update`

**Server → client:**
`board:state` (full snapshot incl. members, labels, activity) · `board:patch` (lists/cards/deletedCardIds/listCards/labels/checklists/comments/members/board/activity) · `presence:update` (viewers) · `notification:new` (personal room) · `error`

---

## 🧪 Tests & CI

```bash
pnpm -r typecheck   # strict TS across packages
pnpm -r test        # vitest: positioning math, RBAC rules, notification builders
pnpm -r build       # production builds
```

GitHub Actions runs typecheck + build on every push/PR.

## ⚙️ Configuration

| Var | Where | Default |
|---|---|---|
| `DATABASE_URL` | api | postgres (docker) / sqlite (setup script overrides) |
| `JWT_SECRET` | api | change me |
| `PORT` | api | `4000` |
| `CORS_ORIGIN` | api | `http://localhost:3000` |
| `NEXT_PUBLIC_API_BASE` | web | `http://localhost:4000` |
| `NEXT_PUBLIC_SOCKET_URL` | web | `http://localhost:4000` |