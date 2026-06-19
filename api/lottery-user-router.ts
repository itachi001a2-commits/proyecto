import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { lotteryUsers } from "@db/schema";
import { eq, like, or, desc } from "drizzle-orm";

export const lotteryUserRouter = createRouter({
  // List all lottery users with optional search
  list: publicQuery
    .input(
      z.object({
        search: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const search = input?.search;
      if (search) {
        return db.select().from(lotteryUsers)
          .where(
            or(
              like(lotteryUsers.name, `%${search}%`),
              like(lotteryUsers.username, `%${search}%`)
            )
          )
          .orderBy(desc(lotteryUsers.createdAt));
      }
      return db.select().from(lotteryUsers).orderBy(desc(lotteryUsers.createdAt));
    }),

  // Get single user
  byId: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db.select().from(lotteryUsers).where(eq(lotteryUsers.id, input.id));
      return rows[0] || null;
    }),

  // Create user - auto-generates bankNumber
  create: publicQuery
    .input(
      z.object({
        bankNumber: z.string().optional(),
        name: z.string().min(1),
        username: z.string().min(1),
        password: z.string().min(1),
        phone: z.string().optional().nullable(),
        role: z.enum(["admin", "supervisor", "collector", "user"]).default("user"),
        groupId: z.number().optional().nullable(),
        credit: z.string().default("5000.00"),
        commission: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const db = getDb();
        
        // Check if username already exists
        const existing = await db.select().from(lotteryUsers).where(eq(lotteryUsers.username, input.username));
        if (existing.length > 0) {
          throw new Error("El nombre de usuario ya existe");
        }

        // Auto-generate bankNumber based on last user
        let bankNumber = input.bankNumber;
        if (!bankNumber) {
          const allUsers = await db.select().from(lotteryUsers).orderBy(desc(lotteryUsers.id));
          let maxNum = 0;
          for (const u of allUsers) {
            const match = u.bankNumber.match(/(\d+)/);
            if (match) {
              const num = parseInt(match[1]);
              if (num > maxNum) maxNum = num;
            }
          }
          bankNumber = `B-${(maxNum + 1).toString().padStart(3, "0")}`;
        }
        
        // Check if bankNumber already exists
        const existingBank = await db.select().from(lotteryUsers).where(eq(lotteryUsers.bankNumber, bankNumber));
        if (existingBank.length > 0) {
          // Generate unique one
          const allUsers = await db.select().from(lotteryUsers).orderBy(desc(lotteryUsers.id));
          let maxNum = 0;
          for (const u of allUsers) {
            const match = u.bankNumber.match(/(\d+)/);
            if (match) {
              const num = parseInt(match[1]);
              if (num > maxNum) maxNum = num;
            }
          }
          bankNumber = `B-${(maxNum + 1).toString().padStart(3, "0")}`;
        }
        
        const values: any = {
          bankNumber,
          name: input.name,
          username: input.username,
          password: input.password,
          role: input.role,
          credit: input.credit,
          commission: input.commission || "10.00",
          active: true,
        };
        
        // Only include optional fields if they have values
        if (input.phone !== undefined && input.phone !== null && input.phone !== "") {
          values.phone = input.phone;
        }
        if (input.groupId !== undefined && input.groupId !== null) {
          values.groupId = input.groupId;
        }
        
        const result = await db.insert(lotteryUsers).values(values).returning();
        return { id: result[0].id, bankNumber };
      } catch (err: any) {
        console.error("Create user error:", err);
        throw new Error(err.message || "Error al crear usuario");
      }
    }),

  // Update user
  update: publicQuery
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        username: z.string().optional(),
        password: z.string().optional(),
        phone: z.string().optional().nullable(),
        role: z.enum(["admin", "supervisor", "collector", "user"]).optional(),
        credit: z.string().optional(),
        commission: z.string().optional(),
        groupId: z.number().optional(),
        active: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      const updateData: Record<string, any> = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.username !== undefined) updateData.username = data.username;
      if (data.password !== undefined) updateData.password = data.password;
      if (data.phone !== undefined) updateData.phone = data.phone;
      if (data.role !== undefined) updateData.role = data.role;
      if (data.credit !== undefined) updateData.credit = data.credit;
      if (data.commission !== undefined) updateData.commission = data.commission;
      if (data.groupId !== undefined) updateData.groupId = data.groupId;
      if (data.active !== undefined) updateData.active = data.active;
      await db.update(lotteryUsers).set(updateData).where(eq(lotteryUsers.id, id));
      return { ok: true };
    }),

  // Toggle user active
  toggleActive: publicQuery
    .input(z.object({ id: z.number(), active: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(lotteryUsers).set({ active: input.active }).where(eq(lotteryUsers.id, input.id));
      return { ok: true };
    }),

  // Login
  login: publicQuery
    .input(
      z.object({
        username: z.string().min(1),
        password: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const rows = await db
        .select()
        .from(lotteryUsers)
        .where(eq(lotteryUsers.username, input.username));
      const user = rows[0];
      if (!user) return { success: false, error: "Usuario no encontrado" };
      if (!user.active) return { success: false, error: "Usuario bloqueado" };
      if (user.password !== input.password) return { success: false, error: "Contrasena incorrecta" };
      return {
        success: true,
        user: {
          id: user.id,
          bankNumber: user.bankNumber,
          name: user.name,
          username: user.username,
          role: user.role,
          credit: user.credit,
          commission: user.commission,
          groupId: user.groupId,
        },
      };
    }),

  // Update credit
  updateCredit: publicQuery
    .input(z.object({ id: z.number(), credit: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(lotteryUsers).set({ credit: input.credit }).where(eq(lotteryUsers.id, input.id));
      return { ok: true };
    }),

  // Delete user
  delete: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(lotteryUsers).where(eq(lotteryUsers.id, input.id));
      return { ok: true };
    }),
});
