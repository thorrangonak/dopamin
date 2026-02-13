import { fetchScores, ScoreEvent } from "./oddsApi";
import {
  getPendingBets,
  getBetItemsByBetId,
  updateBetItemResult,
  updateBetStatus,
  updateBalance,
  addTransaction,
  getOrCreateBalance,
  markEventCompleted,
} from "./db";
import { notifyOwner } from "./_core/notification";

/**
 * Settle pending bets by checking scores from The Odds API.
 * This should be called periodically (e.g., every 15 minutes).
 */
export async function settleBets() {
  const pendingBets = await getPendingBets();
  if (pendingBets.length === 0) return { settled: 0, checked: 0 };

  // Collect unique sport keys from pending bet items
  const sportKeys = new Set<string>();
  const allBetItems: Map<number, Awaited<ReturnType<typeof getBetItemsByBetId>>> = new Map();

  for (const bet of pendingBets) {
    const items = await getBetItemsByBetId(bet.id);
    allBetItems.set(bet.id, items);
    for (const item of items) {
      sportKeys.add(item.sportKey);
    }
  }

  // Fetch scores for each sport
  const scoresByEvent = new Map<string, ScoreEvent>();
  for (const sportKey of Array.from(sportKeys)) {
    try {
      const scores = await fetchScores(sportKey);
      for (const score of scores) {
        if (score.completed && score.scores) {
          scoresByEvent.set(score.id, score);
        }
      }
    } catch (err) {
      console.error(`[Settlement] Failed to fetch scores for ${sportKey}:`, err);
    }
  }

  let settledCount = 0;

  for (const bet of pendingBets) {
    const items = allBetItems.get(bet.id) ?? [];
    let allSettled = true;
    let anyLost = false;
    let allWon = true;

    for (const item of items) {
      if (item.status !== "pending") {
        if (item.status === "lost") anyLost = true;
        if (item.status !== "won") allWon = false;
        continue;
      }

      const score = scoresByEvent.get(item.eventId);
      if (!score || !score.scores) {
        allSettled = false;
        allWon = false;
        continue;
      }

      const homeScoreVal = parseInt(score.scores.find(s => s.name === item.homeTeam)?.score ?? "0");
      const awayScoreVal = parseInt(score.scores.find(s => s.name === item.awayTeam)?.score ?? "0");

      // Mark event as completed in cache
      await markEventCompleted(item.eventId, homeScoreVal, awayScoreVal);

      // Determine outcome based on market
      const won = determineOutcome(item.marketKey, item.outcomeName, item.point ? parseFloat(item.point) : undefined, homeScoreVal, awayScoreVal, item.homeTeam, item.awayTeam);

      await updateBetItemResult(item.id, won ? "won" : "lost", homeScoreVal, awayScoreVal);

      if (!won) {
        anyLost = true;
        allWon = false;
      }
    }

    // Check if all items are settled
    const updatedItems = await getBetItemsByBetId(bet.id);
    const stillPending = updatedItems.some(i => i.status === "pending");

    if (!stillPending) {
      const allItemsWon = updatedItems.every(i => i.status === "won");
      const allItemsLost = updatedItems.every(i => i.status === "lost");

      if (allItemsWon) {
        await updateBetStatus(bet.id, "won");
        // Credit winnings
        await getOrCreateBalance(bet.userId);
        await updateBalance(bet.userId, bet.potentialWin);
        await addTransaction(bet.userId, "bet_win", bet.potentialWin, `Kupon #${bet.id} kazandı`);
        // Notify owner about winning bet
        try {
          await notifyOwner({
            title: `Kupon #${bet.id} Kazandı!`,
            content: `Kullanıcı #${bet.userId} kupon #${bet.id} kazandı. Kazanc: ${bet.potentialWin} TL. Bahis: ${bet.stake} TL, Oran: ${bet.totalOdds}`,
          });
        } catch (e) { console.warn("[Settlement] Notification failed:", e); }
      } else if (allItemsLost) {
        await updateBetStatus(bet.id, "lost");
        try {
          await notifyOwner({
            title: `Kupon #${bet.id} Kaybetti`,
            content: `Kullanıcı #${bet.userId} kupon #${bet.id} kaybetti. Bahis: ${bet.stake} TL`,
          });
        } catch (e) { console.warn("[Settlement] Notification failed:", e); }
      } else {
        await updateBetStatus(bet.id, "lost");
      }
      settledCount++;
    }
  }

  return { settled: settledCount, checked: pendingBets.length };
}

function determineOutcome(
  marketKey: string,
  outcomeName: string,
  point: number | undefined,
  homeScore: number,
  awayScore: number,
  homeTeam: string,
  awayTeam: string
): boolean {
  switch (marketKey) {
    case "h2h": {
      if (outcomeName === homeTeam) return homeScore > awayScore;
      if (outcomeName === awayTeam) return awayScore > homeScore;
      if (outcomeName === "Draw") return homeScore === awayScore;
      return false;
    }
    case "spreads": {
      const spread = point ?? 0;
      if (outcomeName === homeTeam) return (homeScore + spread) > awayScore;
      if (outcomeName === awayTeam) return (awayScore + spread) > homeScore;
      return false;
    }
    case "totals": {
      const total = homeScore + awayScore;
      const line = point ?? 0;
      if (outcomeName === "Over") return total > line;
      if (outcomeName === "Under") return total < line;
      return false;
    }
    default:
      return false;
  }
}
