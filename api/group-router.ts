import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { groups, lotteryUsers } from "@db/schema";
import { eq, desc } from "drizzle-orm";

export const groupRouter = createRouter({
  list: publicQuery.query(async () => {
    const db = getDb();
    return db.select().from(groups).orderBy(desc(groups.createdAt));
  }),

  create: publicQuery
    .input(z.object({
      name: z.string().min(1),
      maxSalesPerDay: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const result = await db.insert(groups).values({
        name: input.name,
        maxSalesPerDay: input.maxSalesPerDay || "50000.00",
        active: true,
      }).returning();
      return { id: result[0].id };
    }),

  update: publicQuery
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      maxSalesPerDay: z.string().optional(),
      active: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      await db.update(groups).set(data).where(eq(groups.id, id));
      return { ok: true };
    }),

  delete: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(groups).where(eq(groups.id, input.id));
      return { ok: true };
    }),

  members: publicQuery
    .input(z.object({ groupId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db.select().from(lotteryUsers).where(eq(lotteryUsers.groupId, input.groupId));
    }),
});
