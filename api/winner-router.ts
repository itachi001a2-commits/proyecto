import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { winners, tickets, plays, lotteryUsers, prizes } from "@db/schema";
import { eq, desc, and } from "drizzle-orm";

export const winnerRouter = createRouter({
  list: publicQuery
    .input(z.object({
      lotteryId: z.number().optional(),
      drawDate: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      if (input?.lotteryId && input?.drawDate) {
        return db.select().from(winners)
          .where(and(eq(winners.lotteryId, input.lotteryId), eq(winners.drawDate, input.drawDate)))
          .orderBy(desc(winners.createdAt));
      }
      if (input?.lotteryId) {
        return db.select().from(winners)
          .where(eq(winners.lotteryId, input.lotteryId))
          .orderBy(desc(winners.createdAt));
      }
      return db.select().from(winners).orderBy(desc(winners.createdAt));
    }),

  create: publicQuery
    .input(z.object({
      lotteryId: z.number(),
      firstPrize: z.string().min(1),
      secondPrize: z.string().min(1),
      thirdPrize: z.string().min(1),
      drawDate: z.string().min(1),
      createdBy: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();

      // Insert winner
      const result = await db.insert(winners).values({
        lotteryId: input.lotteryId,
        firstPrize: input.firstPrize,
        secondPrize: input.secondPrize,
        thirdPrize: input.thirdPrize,
        drawDate: input.drawDate,
        createdBy: input.createdBy || null,
      }).returning();
      const winnerId = result[0].id;

      // Auto-calculate prizes for matching tickets
      const allTickets = await db.select().from(tickets)
        .where(and(
          eq(tickets.lotteryId, input.lotteryId),
          eq(tickets.status, "active")
        ));

      const prizeConfigs = await db.select().from(prizes);
      const winningNumbers = [input.firstPrize, input.secondPrize, input.thirdPrize];
      const winningResults: Array<{
        ticketId: number;
        ticketCode: string;
        userId: number;
        totalPrize: number;
        details: string[];
      }> = [];

      for (const ticket of allTickets) {
        const ticketPlays = await db.select().from(plays).where(eq(plays.ticketId, ticket.id));
        let ticketPrize = 0;
        const details: string[] = [];

        for (const play of ticketPlays) {
          const prizeConfig = prizeConfigs.find(p => p.playType === play.type);
          if (!prizeConfig) continue;

          const playNums = play.number.split("+").map(n => n.trim());
          let matched = false;
          let multiplier = 0;

          switch (play.type) {
            case "directo": {
              const playNum = play.number;
              if (playNum === winningNumbers[0]) { multiplier = Number(prizeConfig.firstPrizeMultiplier); matched = true; }
              else if (playNum === winningNumbers[1]) { multiplier = Number(prizeConfig.secondPrizeMultiplier); matched = true; }
              else if (playNum === winningNumbers[2]) { multiplier = Number(prizeConfig.thirdPrizeMultiplier); matched = true; }
              break;
            }
            case "pale": {
              if (playNums.length === 2) {
                const sorted = [...playNums].sort().join("+");
                const w12 = [winningNumbers[0], winningNumbers[1]].sort().join("+");
                const w13 = [winningNumbers[0], winningNumbers[2]].sort().join("+");
                const w23 = [winningNumbers[1], winningNumbers[2]].sort().join("+");
                if (sorted === w12) { multiplier = Number(prizeConfig.paleFirstSecondMultiplier); matched = true; }
                else if (sorted === w13) { multiplier = Number(prizeConfig.paleFirstThirdMultiplier); matched = true; }
                else if (sorted === w23) { multiplier = Number(prizeConfig.paleSecondThirdMultiplier); matched = true; }
              }
              break;
            }
            case "tripleta": {
              const sorted = [...playNums].sort().join("+");
              const winSorted = [...winningNumbers].sort().join("+");
              if (sorted === winSorted) { multiplier = Number(prizeConfig.fixedMultiplier); matched = true; }
              break;
            }
            case "terna": {
              const playDigits = play.number.replace(/[^0-9]/g, "");
              const winDigits = winningNumbers.join("").replace(/[^0-9]/g, "");
              if (playDigits.length === 3) {
                const sortedPlay = playDigits.split("").sort().join("");
                // Check if all 3 digits are in the winning numbers
                const winSet = new Set(winDigits.split(""));
                if (playDigits.split("").every(d => winSet.has(d))) {
                  multiplier = Number(prizeConfig.fixedMultiplier); matched = true;
                }
              }
              break;
            }
            case "cuatrena": {
              const playDigits = play.number.replace(/[^0-9]/g, "");
              const winDigits = winningNumbers.join("").replace(/[^0-9]/g, "");
              if (playDigits.length === 4) {
                const winSet = new Set(winDigits.split(""));
                if (playDigits.split("").every(d => winSet.has(d))) {
                  multiplier = Number(prizeConfig.fixedMultiplier); matched = true;
                }
              }
              break;
            }
          }

          if (matched && multiplier > 0) {
            const prize = Number(play.amount) * multiplier;
            ticketPrize += prize;
            details.push(`${play.number} (${play.type}) x${multiplier} = $${prize.toFixed(2)}`);
          }
        }

        if (ticketPrize > 0) {
          // Mark ticket as winner
          await db.update(tickets).set({ status: "winner" }).where(eq(tickets.id, ticket.id));
          // Add prize to seller's credit
          const seller = await db.select().from(lotteryUsers).where(eq(lotteryUsers.id, ticket.userId));
          if (seller.length > 0) {
            const currentCredit = Number(seller[0].credit) || 0;
            const newCredit = currentCredit + ticketPrize;
            await db.update(lotteryUsers)
              .set({ credit: newCredit.toFixed(2) })
              .where(eq(lotteryUsers.id, ticket.userId));
          }
          winningResults.push({
            ticketId: ticket.id,
            ticketCode: ticket.code,
            userId: ticket.userId,
            totalPrize: ticketPrize,
            details,
          });
        }
      }

      return { id: winnerId, processed: winningResults.length, winners: winningResults };
    }),

  // Report: losses/gains per ticket
  report: publicQuery
    .input(z.object({
      drawDate: z.string(),
      lotteryId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const db = getDb();
      const winnerList = await db.select().from(winners)
        .where(
          input.lotteryId
            ? and(eq(winners.drawDate, input.drawDate), eq(winners.lotteryId, input.lotteryId))
            : eq(winners.drawDate, input.drawDate)
        );

      const report: Array<{
        lotteryId: number;
        drawDate: string;
        winningNumbers: string[];
        totalSales: number;
        totalPrizes: number;
        netResult: number;
        winningTickets: Array<{
          ticketCode: string;
          sellerName: string;
          prize: number;
          plays: string[];
        }>;
      }> = [];

      for (const w of winnerList) {
        const ticketsWithPlays = await db.select().from(tickets)
          .where(and(eq(tickets.lotteryId, w.lotteryId), eq(tickets.status, "winner")));

        let totalSales = 0;
        let totalPrizes = 0;
        const winningTickets: Array<{ ticketCode: string; sellerName: string; prize: number; plays: string[] }> = [];

        for (const t of ticketsWithPlays) {
          totalSales += Number(t.total) || 0;
          const tPlays = await db.select().from(plays).where(eq(plays.ticketId, t.id));
          const seller = await db.select().from(lotteryUsers).where(eq(lotteryUsers.id, t.userId));
          const sellerName = seller.length > 0 ? seller[0].name : `ID:${t.userId}`;

          // Recalculate prize
          const prizeConfigs = await db.select().from(prizes);
          let ticketPrize = 0;
          const playDetails: string[] = [];
          const winNums = [w.firstPrize, w.secondPrize, w.thirdPrize];

          for (const p of tPlays) {
            const pc = prizeConfigs.find(x => x.playType === p.type);
            if (!pc) continue;
            let mult = 0;
            if (p.type === "directo") {
              if (p.number === winNums[0]) mult = Number(pc.firstPrizeMultiplier);
              else if (p.number === winNums[1]) mult = Number(pc.secondPrizeMultiplier);
              else if (p.number === winNums[2]) mult = Number(pc.thirdPrizeMultiplier);
            } else if (p.type === "pale") {
              const pn = [...p.number.split("+").map(s=>s.trim())].sort().join("+");
              if (pn === [winNums[0], winNums[1]].sort().join("+")) mult = Number(pc.paleFirstSecondMultiplier);
              else if (pn === [winNums[0], winNums[2]].sort().join("+")) mult = Number(pc.paleFirstThirdMultiplier);
              else if (pn === [winNums[1], winNums[2]].sort().join("+")) mult = Number(pc.paleSecondThirdMultiplier);
            } else {
              mult = Number(pc.fixedMultiplier);
            }
            if (mult > 0) {
              const pr = Number(p.amount) * mult;
              ticketPrize += pr;
              playDetails.push(`${p.number} (${p.type}) x${mult} = $${pr.toFixed(2)}`);
            }
          }

          totalPrizes += ticketPrize;
          if (ticketPrize > 0) {
            winningTickets.push({ ticketCode: t.code, sellerName, prize: ticketPrize, plays: playDetails });
          }
        }

        report.push({
          lotteryId: w.lotteryId,
          drawDate: w.drawDate,
          winningNumbers: [w.firstPrize, w.secondPrize, w.thirdPrize],
          totalSales,
          totalPrizes,
          netResult: totalSales - totalPrizes,
          winningTickets,
        });
      }

      return report;
    }),

  delete: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(winners).where(eq(winners.id, input.id));
      return { ok: true };
    }),
});
