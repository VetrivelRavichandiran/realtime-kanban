import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const p = new PrismaClient();

const DAY = 86400000;
const day = (offset: number) => new Date(Date.now() + offset * DAY);

async function main() {
  const password = await bcrypt.hash("Password123!", 10);

  const demo = await p.user.upsert({
    where: { email: "demo@kanban.dev" },
    update: {},
    create: { email: "demo@kanban.dev", name: "Demo User", password }
  });
  const ana = await p.user.upsert({
    where: { email: "ana@kanban.dev" },
    update: {},
    create: { email: "ana@kanban.dev", name: "Ana Silva", password }
  });

  // ---------- demo board ----------
  let board = await p.board.findFirst({ where: { name: "Realtime Kanban Demo" } });
  if (!board) {
    board = await p.board.create({
      data: {
        name: "Realtime Kanban Demo",
        color: "#0f766e",
        memberships: {
          create: [
            { userId: demo.id, role: "owner" },
            { userId: ana.id, role: "member" }
          ]
        },
        lists: {
          create: [
            { name: "Backlog", position: 1000 },
            { name: "In Progress", position: 2000 },
            { name: "Review", position: 3000 },
            { name: "Done", position: 4000 }
          ]
        }
      }
    });
    console.log("Created demo board");
  }

  const lists = await p.list.findMany({ where: { boardId: board.id }, orderBy: { position: "asc" } });
  const byName = (n: string) => lists.find((l) => l.name === n)!;

  if (!(await p.card.count({ where: { list: { boardId: board.id } } }))) {
    const [urgent, design, backend] = await Promise.all(
      [
        ["Urgent", "#ef4444"],
        ["Design", "#a855f7"],
        ["Backend", "#3b82f6"],
        ["Docs", "#f59e0b"]
      ].map(([name, color]) => p.label.create({ data: { boardId: board.id, name, color } }))
    );

    // Backlog
    const c1 = await p.card.create({
      data: {
        listId: byName("Backlog").id,
        title: "Design polished board",
        position: 1000,
        priority: "high",
        dueDate: day(-1),
        description: "Round the corners, tighten spacing, add the activity feed."
      }
    });
    await p.cardLabel.createMany({
      data: [
        { cardId: c1.id, labelId: urgent.id },
        { cardId: c1.id, labelId: design.id }
      ]
    });
    await p.checklistItem.createMany({
      data: [
        { cardId: c1.id, content: "Review mockup", position: 1000 },
        { cardId: c1.id, content: "Ship", position: 2000 }
      ]
    });
    await p.comment.create({
      data: { cardId: c1.id, authorId: ana.id, body: "Looks great @Demo User — can you add the stats chips?" }
    });

    const c2 = await p.card.create({
      data: {
        listId: byName("Backlog").id,
        title: "Write onboarding docs",
        position: 2000,
        priority: "medium",
        dueDate: day(6),
        description: "Quick-start guide for new teammates."
      }
    });
    await p.cardLabel.create({ data: { cardId: c2.id, labelId: docs.id } });
    await p.cardAssignee.create({ data: { cardId: c2.id, userId: ana.id } });

    // In Progress
    const c3 = await p.card.create({
      data: {
        listId: byName("In Progress").id,
        title: "Realtime presence indicators",
        position: 1000,
        priority: "urgent",
        dueDate: day(1),
        description: "Green-ring avatars for everyone viewing the board right now."
      }
    });
    await p.cardLabel.create({ data: { cardId: c3.id, labelId: backend.id } });
    await p.cardAssignee.create({ data: { cardId: c3.id, userId: demo.id } });
    await p.checklistItem.createMany({
      data: [
        { cardId: c3.id, content: "Socket join/leave", position: 1000, done: true },
        { cardId: c3.id, content: "Presence broadcast", position: 2000, done: true },
        { cardId: c3.id, content: "Avatar stack in topbar", position: 3000 }
      ]
    });
    await p.comment.create({
      data: { cardId: c3.id, authorId: demo.id, body: "Presence is live in staging — @Ana Silva can you verify in a second tab?" }
    });

    const c4 = await p.card.create({
      data: {
        listId: byName("In Progress").id,
        title: "Fractional positioning for drag & drop",
        position: 2000,
        priority: "high",
        dueDate: day(3),
        description: "Midpoint math + reindex when gaps get tight."
      }
    });
    await p.cardLabel.create({ data: { cardId: c4.id, labelId: backend.id } });

    // Review
    const c5 = await p.card.create({
      data: {
        listId: byName("Review").id,
        title: "Notification bell + @mentions",
        position: 1000,
        priority: "medium",
        dueDate: day(2),
        description: "Realtime notification:new push with a 15s polling fallback."
      }
    });
    await p.cardLabel.createMany({
      data: [
        { cardId: c5.id, labelId: design.id },
        { cardId: c5.id, labelId: backend.id }
      ]
    });
    await p.cardAssignee.create({ data: { cardId: c5.id, userId: ana.id } });
    await p.checklistItem.createMany({
      data: [
        { cardId: c5.id, content: "Unread badge", position: 1000, done: true },
        { cardId: c5.id, content: "Mark all read", position: 2000, done: true },
        { cardId: c5.id, content: "Deep-link to card", position: 3000, done: true }
      ]
    });

    // Done
    const c6 = await p.card.create({
      data: {
        listId: byName("Done").id,
        title: "JWT auth + board roles",
        position: 1000,
        priority: "none",
        dueDate: day(-3),
        description: "Register/login, owner/admin/member RBAC on every action."
      }
    });
    await p.cardLabel.create({ data: { cardId: c6.id, labelId: backend.id } });
    await p.checklistItem.createMany({
      data: [
        { cardId: c6.id, content: "Sign in", position: 1000, done: true },
        { cardId: c6.id, content: "Role checks", position: 2000, done: true }
      ]
    });

    // Demo attachment
    const up = path.join(process.cwd(), "uploads");
    fs.mkdirSync(up, { recursive: true });
    fs.writeFileSync(path.join(up, "seed-placeholder.txt"), "Demo attachment");
    await p.attachment.create({
      data: {
        cardId: c1.id,
        fileName: "seed-placeholder.txt",
        storedName: "seed-placeholder.txt",
        mimeType: "text/plain",
        size: 15,
        uploadedById: demo.id
      }
    });

    // Activity trail
    await p.activity.createMany({
      data: [
        { boardId: board.id, actorId: demo.id, message: 'Created list "Done"' },
        { boardId: board.id, actorId: ana.id, message: 'Commented on card "Design polished board"' },
        { boardId: board.id, actorId: demo.id, message: 'Created card "Realtime presence indicators"' }
      ]
    });

    console.log("Seeded demo cards");
  }

  // ---------- second board (analytics) ----------
  let board2 = await p.board.findFirst({ where: { name: "Product Analytics" } });
  if (!board2) {
    board2 = await p.board.create({
      data: {
        name: "Product Analytics",
        color: "#6366f1",
        memberships: {
          create: [
            { userId: demo.id, role: "admin" },
            { userId: ana.id, role: "member" }
          ]
        },
        lists: {
          create: [
            { name: "Ideas", position: 1000 },
            { name: "This sprint", position: 2000 },
            { name: "Done", position: 3000 }
          ]
        }
      }
    });
    const l2 = await p.list.findMany({ where: { boardId: board2.id }, orderBy: { position: "asc" } });
    const a1 = await p.card.create({
      data: {
        listId: l2[0].id,
        title: "Weekly retention report",
        position: 1000,
        priority: "medium",
        dueDate: day(4),
        description: "Cohort view for the last 8 weeks."
      }
    });
    await p.cardAssignee.create({ data: { cardId: a1.id, userId: ana.id } });
    await p.card.create({
      data: {
        listId: l2[1].id,
        title: "Funnel: signup → first board",
        position: 1000,
        priority: "high",
        dueDate: day(2)
      }
    });
    await p.card.create({
      data: {
        listId: l2[2].id,
        title: "Event schema v2",
        position: 1000,
        priority: "none",
        dueDate: day(-2)
      }
    });
    await p.activity.create({
      data: { boardId: board2.id, actorId: demo.id, message: 'Created board "Product Analytics"' }
    });
    console.log("Created analytics board");
  }

  console.log("Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());