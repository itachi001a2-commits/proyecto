import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { tickets, plays } from "@db/schema";
import { eq, desc, and } from "drizzle-orm";

export const ticketRouter = createRouter({
  create: publicQuery
    .input(z.object({
      code: z.string().min(1),
      userId: z.number(),
      lotteryId: z.number(),
      total: z.string(),
      commission: z.string().optional(),
      netDeduction: z.string().optional(),
      validDays: z.number().optional(),
      playList: z.array(z.object({
        number: z.string(),
        amount: z.string(),
        type: z.enum(["directo", "pale", "tripleta", "cuatrena", "terna"]),
        lotteryId: z.number(),
      })),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const ticketResult = await db.insert(tickets).values({
        code: input.code,
        userId: input.userId,
        lotteryId: input.lotteryId,
        total: input.total,
        commission: input.commission || "10.00",
        netDeduction: input.netDeduction || input.total,
        status: "active",
      }).returning();
      const ticketId = ticketResult[0].id;

      for (const play of input.playList) {
        await db.insert(plays).values({
          ticketId,
          number: play.number,
          amount: play.amount,
          type: play.type,
          lotteryId: play.lotteryId,
        });
      }
      return { ticketId, code: input.code };
    }),

  list: publicQuery
    .input(z.object({
      userId: z.number().optional(),
      status: z.enum(["active", "cancelled", "paid", "winner"]).optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      if (input?.userId) {
        return db.select().from(tickets)
          .where(eq(tickets.userId, input.userId))
          .orderBy(desc(tickets.createdAt));
      }
      return db.select().from(tickets).orderBy(desc(tickets.createdAt));
    }),

  withPlays: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const ticketRows = await db.select().from(tickets).where(eq(tickets.id, input.id));
      const playRows = await db.select().from(plays).where(eq(plays.ticketId, input.id));
      return { ticket: ticketRows[0] || null, plays: playRows };
    }),

  byCode: publicQuery
    .input(z.object({ code: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = getDb();
      const ticketRows = await db.select().from(tickets).where(eq(tickets.code, input.code));
      if (ticketRows.length === 0) return { ticket: null, plays: [] };
      const playRows = await db.select().from(plays).where(eq(plays.ticketId, ticketRows[0].id));
      return { ticket: ticketRows[0], plays: playRows };
    }),

  validate: publicQuery
    .input(z.object({ code: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = getDb();
      const ticketRows = await db.select().from(tickets).where(eq(tickets.code, input.code));
      if (ticketRows.length === 0) return { valid: false, reason: "Ticket no encontrado" };
      const ticket = ticketRows[0];
      if (ticket.status === "cancelled") return { valid: false, reason: "Ticket anulado" };
      if (ticket.status === "paid") return { valid: false, reason: "Ticket ya fue pagado" };
      const createdAt = new Date(ticket.createdAt);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > 30) return { valid: false, reason: `Ticket expirado (${diffDays} dias)` };
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      if (createdAt < todayStart) return { valid: true, ticket, warning: `Ticket de hace ${diffDays} dias` };
      return { valid: true, ticket };
    }),

  annul: publicQuery
    .input(z.object({ id: z.number(), annulledBy: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(tickets).set({
        status: "cancelled",
        annulledBy: input.annulledBy,
        annulledAt: new Date(),
      }).where(eq(tickets.id, input.id));
      return { ok: true };
    }),

  updateStatus: publicQuery
    .input(z.object({ id: z.number(), status: z.enum(["active", "paid", "winner"]) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(tickets).set({ status: input.status }).where(eq(tickets.id, input.id));
      return { ok: true };
    }),
});