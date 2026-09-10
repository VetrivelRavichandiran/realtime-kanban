import { Server } from "socket.io";
import { prisma } from "./prisma";
import { verifyToken } from "./auth";
import { normalizePosition, needsReindex, reindex } from "./positions";
import { isAdmin } from "./permissions";
import { assignmentMessage, mentionMessage } from "./notifications";

const room = (boardId: string) => `board:${boardId}`;
const userRoom = (userId: string) => `user:${userId}`;

// boardId -> userId -> viewer (keyed by user so multiple tabs show one avatar)
const viewers = new Map<string, Map<string, { id: string; name: string }>>();

async function mem(userId: string, boardId: string) {
  const m = await prisma.membership.findUnique({
    where: { userId_boardId: { userId, boardId } }
  });
  if (!m) throw new Error("Not a member of this board");
  return m;
}

async function card(id: string) {
  const c = await prisma.card.findUnique({ where: { id }, include: { list: true } });
  if (!c) throw new Error("Card not found");
  return c;
}

const CARD_INCLUDE = {
  labels: { include: { label: true } },
  checklist: true,
  comments: true,
  attachments: true,
  assignees: true
} as const;

function shapeCard(c: any) {
  return {
    ...c,
    dueDate: c.dueDate ? c.dueDate.toISOString() : null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    labels: (c.labels ?? []).map((x: any) => x.label),
    checklistCount: (c.checklist ?? []).length,
    checklistDone: (c.checklist ?? []).filter((x: any) => x.done).length,
    commentCount: (c.comments ?? []).length,
    attachmentCount: (c.attachments ?? []).length,
    assigneeIds: (c.assignees ?? []).map((x: any) => x.userId)
  };
}

export function attachSocket(io: Server) {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Missing token"));
      (socket.data as any).userId = verifyToken(token).userId;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket: any) => {
    const uid = socket.data.userId as string;
    socket.join(userRoom(uid));

    const emit = (boardId: string, p: any) => io.to(room(boardId)).emit("board:patch", p);
    const fail = (f: (p: any) => Promise<void>) => async (p: any) => {
      try {
        await f(p);
      } catch (e: any) {
        socket.emit("error", { message: e.message });
      }
    };

    const presence = (boardId: string) =>
      io.to(room(boardId)).emit("presence:update", {
        boardId,
        viewers: [...(viewers.get(boardId)?.values() ?? [])]
      });

    async function log(boardId: string, message: string) {
      const user = await prisma.user.findUnique({ where: { id: uid } });
      const a = await prisma.activity.create({ data: { boardId, actorId: uid, message } });
      io.to(room(boardId)).emit("board:patch", {
        activity: [{ ...a, createdAt: a.createdAt.toISOString(), actorName: user?.name ?? "Someone" }]
      });
    }

    socket.on(
      "board:join",
      fail(async ({ boardId }: { boardId: string }) => {
        await mem(uid, boardId);
        await socket.join(room(boardId));

        const user = await prisma.user.findUnique({ where: { id: uid } });
        const v = viewers.get(boardId) ?? new Map();
        v.set(uid, { id: uid, name: user!.name });
        viewers.set(boardId, v);
        presence(boardId);

        const board = await prisma.board.findUnique({ where: { id: boardId } });
        if (!board) throw new Error("Board not found");

        const lists = await prisma.list.findMany({ where: { boardId }, orderBy: { position: "asc" } });
        const raw = await prisma.card.findMany({ where: { list: { boardId } }, include: CARD_INCLUDE });
        const members = await prisma.membership.findMany({ where: { boardId }, include: { user: true } });
        const labels = await prisma.label.findMany({ where: { boardId } });
        const activity = await prisma.activity.findMany({
          where: { boardId },
          include: { actor: true },
          take: 20,
          orderBy: { createdAt: "desc" }
        });

        socket.emit("board:state", {
          board: { ...board, createdAt: board.createdAt.toISOString() },
          lists,
          cards: raw.map(shapeCard),
          members: members.map((x) => ({ id: x.userId, name: x.user.name, role: x.role })),
          labels,
          activity: activity.map((x) => ({
            ...x,
            createdAt: x.createdAt.toISOString(),
            actorName: x.actor.name
          }))
        });
      })
    );

    // ---------- lists ----------
    socket.on(
      "list:create",
      fail(async ({ boardId, name }: { boardId: string; name: string }) => {
        if (!name || !String(name).trim()) throw new Error("List name is required");
        await mem(uid, boardId);
        const max = await prisma.list.aggregate({ where: { boardId }, _max: { position: true } });
        const list = await prisma.list.create({
          data: { boardId, name, position: (max._max.position ?? 0) + 1000 }
        });
        emit(boardId, { lists: [list] });
        await log(boardId, `Created list "${name}"`);
      })
    );

    socket.on(
      "list:rename",
      fail(async ({ listId, name }: { listId: string; name: string }) => {
        const list = await prisma.list.findUnique({ where: { id: listId } });
        if (!list) throw new Error("List not found");
        await mem(uid, list.boardId);
        const updated = await prisma.list.update({ where: { id: listId }, data: { name } });
        emit(list.boardId, { lists: [updated] });
        await log(list.boardId, `Renamed list to "${name}"`);
      })
    );

    socket.on(
      "list:move",
      fail(async ({ listId, position }: { listId: string; position: number }) => {
        const list = await prisma.list.findUnique({ where: { id: listId } });
        if (!list) throw new Error("List not found");
        await mem(uid, list.boardId);
        const updated = await prisma.list.update({
          where: { id: listId },
          data: { position: normalizePosition(position) }
        });
        emit(list.boardId, { lists: [updated] });
        await log(list.boardId, "Reordered a list");
      })
    );

    socket.on(
      "list:delete",
      fail(async ({ listId }: { listId: string }) => {
        const list = await prisma.list.findUnique({ where: { id: listId } });
        if (!list) throw new Error("List not found");
        await mem(uid, list.boardId);
        await prisma.card.deleteMany({ where: { listId } });
        await prisma.list.delete({ where: { id: listId } });
        const lists = await prisma.list.findMany({ where: { boardId: list.boardId }, orderBy: { position: "asc" } });
        emit(list.boardId, { lists, listCards: { listId, cards: [] } });
        await log(list.boardId, "Deleted a list");
      })
    );

    // ---------- cards ----------
    socket.on(
      "card:create",
      fail(async (p: { listId: string; title: string; dueDate?: string; priority?: string; color?: string }) => {
        const list = await prisma.list.findUnique({ where: { id: p.listId } });
        if (!list) throw new Error("List not found");
        await mem(uid, list.boardId);
        const max = await prisma.card.aggregate({ where: { listId: p.listId }, _max: { position: true } });
        const created = await prisma.card.create({
          data: {
            listId: p.listId,
            title: p.title,
            position: (max._max.position ?? 0) + 1000,
            dueDate: p.dueDate ? new Date(p.dueDate) : undefined,
            priority: p.priority,
            color: p.color
          },
          include: CARD_INCLUDE
        });
        emit(list.boardId, { cards: [shapeCard(created)] });
        await log(list.boardId, `Created card "${p.title}"`);
      })
    );

    socket.on(
      "card:update",
      fail(async (p: {
        cardId: string;
        title?: string;
        description?: string | null;
        dueDate?: string | null;
        priority?: string;
        color?: string | null;
      }) => {
        const c = await card(p.cardId);
        await mem(uid, c.list.boardId);
        const updated = await prisma.card.update({
          where: { id: p.cardId },
          data: {
            ...(p.title !== undefined ? { title: p.title } : {}),
            ...(p.description !== undefined ? { description: p.description } : {}),
            ...(p.dueDate !== undefined ? { dueDate: p.dueDate ? new Date(p.dueDate) : null } : {}),
            ...(p.priority !== undefined ? { priority: p.priority } : {}),
            ...(p.color !== undefined ? { color: p.color } : {})
          },
          include: CARD_INCLUDE
        });
        emit(c.list.boardId, { cards: [shapeCard(updated)] });
        await log(c.list.boardId, "Updated a card");
      })
    );

    socket.on(
      "card:move",
      fail(async (p: { cardId: string; toListId: string; position: number }) => {
        const c = await card(p.cardId);
        const toList = await prisma.list.findUnique({ where: { id: p.toListId } });
        if (!toList) throw new Error("Target list not found");
        if (c.list.boardId !== toList.boardId) throw new Error("Cross-board move not allowed");
        await mem(uid, c.list.boardId);
        const pos = normalizePosition(p.position);
        const updated = await prisma.card.update({
          where: { id: p.cardId },
          data: { listId: p.toListId, position: pos },
          include: CARD_INCLUDE
        });
        // If the new slot is too tight, reindex the whole list to keep gaps healthy.
        const siblings = await prisma.card.findMany({
          where: { listId: p.toListId },
          orderBy: { position: "asc" }
        });
        const i = siblings.findIndex((x) => x.id === p.cardId);
        const prev = i > 0 ? siblings[i - 1].position : undefined;
        const next = i >= 0 && i < siblings.length - 1 ? siblings[i + 1].position : undefined;
        if (i >= 0 && ((prev !== undefined && needsReindex(prev, pos)) || (next !== undefined && needsReindex(pos, next)))) {
          const fixed = reindex(siblings);
          await prisma.$transaction(
            fixed.map((x) => prisma.card.update({ where: { id: x.id }, data: { position: x.position } }))
          );
          emit(c.list.boardId, { cards: (await prisma.card.findMany({ where: { list: { boardId: c.list.boardId } }, include: CARD_INCLUDE })).map(shapeCard) });
        } else {
          emit(c.list.boardId, { cards: [shapeCard(updated)] });
        }
        await log(c.list.boardId, "Moved a card");
      })
    );

    socket.on(
      "card:delete",
      fail(async ({ cardId }: { cardId: string }) => {
        const c = await card(cardId);
        await mem(uid, c.list.boardId);
        await prisma.card.delete({ where: { id: cardId } });
        emit(c.list.boardId, { deletedCardIds: [cardId] });
        await log(c.list.boardId, "Deleted a card");
      })
    );

    // ---------- labels ----------
    socket.on(
      "label:create",
      fail(async (p: { boardId: string; name: string; color: string }) => {
        await mem(uid, p.boardId);
        const label = await prisma.label.create({ data: p });
        emit(p.boardId, { labels: [label] });
        await log(p.boardId, `Created label "${p.name}"`);
      })
    );

    socket.on(
      "label:delete",
      fail(async ({ labelId }: { labelId: string }) => {
        const label = await prisma.label.findUnique({ where: { id: labelId } });
        if (!label) throw new Error("Label not found");
        await mem(uid, label.boardId);
        await prisma.cardLabel.deleteMany({ where: { labelId } });
        await prisma.label.delete({ where: { id: labelId } });
        const labels = await prisma.label.findMany({ where: { boardId: label.boardId } });
        const cards = await prisma.card.findMany({
          where: { list: { boardId: label.boardId } },
          include: CARD_INCLUDE
        });
        emit(label.boardId, { labels, cards: cards.map(shapeCard) });
      })
    );

    socket.on(
      "card:setLabels",
      fail(async ({ cardId, labelIds }: { cardId: string; labelIds: string[] }) => {
        const c = await card(cardId);
        await mem(uid, c.list.boardId);
        await prisma.cardLabel.deleteMany({ where: { cardId } });
        await prisma.cardLabel.createMany({
          data: labelIds.map((labelId) => ({ cardId, labelId }))
        });
        const updated = await prisma.card.findUnique({ where: { id: cardId }, include: CARD_INCLUDE });
        emit(c.list.boardId, { cards: [shapeCard(updated!)] });
      })
    );

    // ---------- checklists ----------
    socket.on(
      "checklist:add",
      fail(async ({ cardId, content }: { cardId: string; content: string }) => {
        const c = await card(cardId);
        await mem(uid, c.list.boardId);
        const max = await prisma.checklistItem.aggregate({ where: { cardId }, _max: { position: true } });
        await prisma.checklistItem.create({
          data: { cardId, content, position: (max._max.position ?? 0) + 1000 }
        });
        const updated = await prisma.card.findUnique({ where: { id: cardId }, include: CARD_INCLUDE });
        // Send the FULL checklist for the card so clients can replace it.
        emit(c.list.boardId, {
          checklists: updated!.checklist,
          cards: [shapeCard(updated)]
        });
      })
    );

    socket.on(
      "checklist:toggle",
      fail(async ({ itemId }: { itemId: string }) => {
        const item = await prisma.checklistItem.findUnique({ where: { id: itemId }, include: { card: { include: { list: true } } } });
        if (!item) throw new Error("Checklist item not found");
        await mem(uid, item.card.list.boardId);
        await prisma.checklistItem.update({ where: { id: itemId }, data: { done: !item.done } });
        const c = await prisma.card.findUnique({ where: { id: item.cardId }, include: CARD_INCLUDE });
        emit(item.card.list.boardId, { checklists: c!.checklist, cards: [shapeCard(c)] });
      })
    );

    socket.on(
      "checklist:remove",
      fail(async ({ itemId }: { itemId: string }) => {
        const item = await prisma.checklistItem.findUnique({ where: { id: itemId }, include: { card: { include: { list: true } } } });
        if (!item) throw new Error("Checklist item not found");
        await mem(uid, item.card.list.boardId);
        await prisma.checklistItem.delete({ where: { id: itemId } });
        const c = await prisma.card.findUnique({ where: { id: item.cardId }, include: CARD_INCLUDE });
        emit(item.card.list.boardId, { checklists: c!.checklist, cards: [shapeCard(c)] });
      })
    );

    // ---------- assignments ----------
    socket.on(
      "card:assign",
      fail(async ({ cardId, memberIds }: { cardId: string; memberIds: string[] }) => {
        const c = await card(cardId);
        await mem(uid, c.list.boardId);
        const existing = await prisma.cardAssignee.findMany({ where: { cardId } });
        const existingIds = new Set(existing.map((x) => x.userId));
        await prisma.cardAssignee.deleteMany({ where: { cardId } });
        await prisma.cardAssignee.createMany({
          data: memberIds.map((userId) => ({ cardId, userId }))
        });
        for (const userId of memberIds) {
          if (!existingIds.has(userId)) {
            const n = await prisma.notification.create({
              data: {
                userId,
                type: "assignment",
                message: assignmentMessage(c.title),
                cardId,
                boardId: c.list.boardId
              }
            });
            io.to(userRoom(userId)).emit("notification:new", { notification: n });
          }
        }
        const updated = await prisma.card.findUnique({ where: { id: cardId }, include: CARD_INCLUDE });
        emit(c.list.boardId, { cards: [shapeCard(updated!)] });
        await log(c.list.boardId, "Updated card assignees");
      })
    );

    // ---------- comments ----------
    socket.on(
      "comment:create",
      fail(async ({ cardId, body }: { cardId: string; body: string }) => {
        const c = await card(cardId);
        await mem(uid, c.list.boardId);
        const comment = await prisma.comment.create({
          data: { cardId, authorId: uid, body },
          include: { author: true }
        });
        const members = await prisma.membership.findMany({
          where: { boardId: c.list.boardId },
          include: { user: true }
        });
        for (const m of members) {
          if (m.userId !== uid && body.includes("@" + m.user.name)) {
            const n = await prisma.notification.create({
              data: {
                userId: m.userId,
                type: "mention",
                message: mentionMessage(c.title),
                cardId,
                boardId: c.list.boardId
              }
            });
            io.to(userRoom(m.userId)).emit("notification:new", { notification: n });
          }
        }
        const updated = await prisma.card.findUnique({ where: { id: cardId }, include: CARD_INCLUDE });
        emit(c.list.boardId, {
          comments: [{ ...comment, authorName: comment.author.name, createdAt: comment.createdAt.toISOString() }],
          cards: [shapeCard(updated!)]
        });
        await log(c.list.boardId, "Commented on a card");
      })
    );

    socket.on(
      "comment:delete",
      fail(async ({ commentId }: { commentId: string }) => {
        const comment = await prisma.comment.findUnique({
          where: { id: commentId },
          include: { card: { include: { list: true } } }
        });
        if (!comment) throw new Error("Comment not found");
        const m = await mem(uid, comment.card.list.boardId);
        if (comment.authorId !== uid && !isAdmin(m.role)) throw new Error("Not allowed to delete this comment");
        await prisma.comment.delete({ where: { id: commentId } });
        const remaining = await prisma.comment.findMany({
          where: { cardId: comment.cardId },
          include: { author: true },
          orderBy: { createdAt: "asc" }
        });
        const updated = await prisma.card.findUnique({ where: { id: comment.cardId }, include: CARD_INCLUDE });
        emit(comment.card.list.boardId, {
          comments: remaining.map((x) => ({
            ...x,
            authorName: x.author.name,
            createdAt: x.createdAt.toISOString()
          })),
          cards: [shapeCard(updated!)]
        });
      })
    );

    // ---------- board ----------
    socket.on(
      "board:update",
      fail(async (p: { boardId: string; name?: string; color?: string }) => {
        const m = await mem(uid, p.boardId);
        if (!isAdmin(m.role)) throw new Error("Forbidden");
        const updated = await prisma.board.update({
          where: { id: p.boardId },
          data: {
            ...(p.name !== undefined ? { name: p.name } : {}),
            ...(p.color !== undefined ? { color: p.color } : {})
          }
        });
        emit(p.boardId, { board: updated });
        await log(p.boardId, "Updated board settings");
      })
    );

    socket.on("disconnect", () => {
      for (const [boardId, v] of viewers) {
        if (v.delete(uid)) presence(boardId);
      }
    });
  });
}