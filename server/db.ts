import { eq, desc, and, sql, inArray, asc, lte, gte, isNull, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, balances, transactions, bets, betItems, sportsCache, eventsCache, casinoGames, vipProfiles, banners, type InsertBanner, chatMessages } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod", "passwordHash"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Balance Helpers ───
export async function getOrCreateBalance(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const existing = await db.select().from(balances).where(eq(balances.userId, userId)).limit(1);
  if (existing.length > 0) return existing[0];
  await db.insert(balances).values({ userId, amount: "0.00" });
  const created = await db.select().from(balances).where(eq(balances.userId, userId)).limit(1);
  return created[0] ?? null;
}

export async function updateBalance(userId: number, delta: string) {
  const db = await getDb();
  if (!db) return null;
  await db.update(balances).set({ amount: sql`amount + ${delta}` }).where(eq(balances.userId, userId));
  return getOrCreateBalance(userId);
}

export async function addTransaction(userId: number, type: "deposit" | "withdraw" | "bet_place" | "bet_win" | "bet_refund", amount: string, description?: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(transactions).values({ userId, type, amount, description });
}

export async function getUserTransactions(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(transactions).where(eq(transactions.userId, userId)).orderBy(desc(transactions.createdAt)).limit(limit);
}

export async function getAllTransactions(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(transactions).orderBy(desc(transactions.createdAt)).limit(limit);
}

// ─── Bet Helpers ───
export async function createBet(userId: number, type: "single" | "combo", stake: string, totalOdds: string, potentialWin: string, items: Array<{
  eventId: string; sportKey: string; homeTeam: string; awayTeam: string;
  commenceTime: Date; marketKey: string; outcomeName: string; outcomePrice: string; point?: string;
}>) {
  const db = await getDb();
  if (!db) return null;
  const [inserted] = await db.insert(bets).values({ userId, type, stake, totalOdds, potentialWin }).$returningId();
  const betId = inserted.id;
  for (const item of items) {
    await db.insert(betItems).values({ betId, ...item });
  }
  return betId;
}

export async function getUserBets(userId: number, status?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(bets.userId, userId)];
  if (status && status !== "all") {
    conditions.push(eq(bets.status, status as any));
  }
  return db.select().from(bets).where(and(...conditions)).orderBy(desc(bets.createdAt));
}

export async function getBetWithItems(betId: number) {
  const db = await getDb();
  if (!db) return null;
  const bet = await db.select().from(bets).where(eq(bets.id, betId)).limit(1);
  if (bet.length === 0) return null;
  const items = await db.select().from(betItems).where(eq(betItems.betId, betId));
  return { ...bet[0], items };
}

export async function getAllBets(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(bets).orderBy(desc(bets.createdAt)).limit(limit);
}

export async function getPendingBets() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(bets).where(eq(bets.status, "pending"));
}

export async function getPendingBetItems() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(betItems).where(eq(betItems.status, "pending"));
}

export async function updateBetItemResult(itemId: number, status: "won" | "lost" | "refunded", homeScore?: number, awayScore?: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(betItems).set({ status, homeScore, awayScore, settledAt: new Date() }).where(eq(betItems.id, itemId));
}

export async function updateBetStatus(betId: number, status: "won" | "lost" | "partial" | "refunded") {
  const db = await getDb();
  if (!db) return;
  await db.update(bets).set({ status, settledAt: new Date() }).where(eq(bets.id, betId));
}

export async function getBetItemsByBetId(betId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(betItems).where(eq(betItems.betId, betId));
}

// ─── Sports Cache Helpers ───
export async function upsertSport(sport: { sportKey: string; groupName: string; title: string; description?: string; active: number; hasOutrights: number }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(sportsCache).values(sport).onDuplicateKeyUpdate({
    set: { groupName: sport.groupName, title: sport.title, description: sport.description, active: sport.active, hasOutrights: sport.hasOutrights },
  });
}

export async function getActiveSports() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sportsCache).where(eq(sportsCache.active, 1));
}

// ─── Events Cache Helpers ───
export async function upsertEvent(event: { eventId: string; sportKey: string; homeTeam: string; awayTeam: string; commenceTime: Date; oddsJson?: any }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(eventsCache).values(event).onDuplicateKeyUpdate({
    set: { homeTeam: event.homeTeam, awayTeam: event.awayTeam, commenceTime: event.commenceTime, oddsJson: event.oddsJson },
  });
}

export async function getEventsBySport(sportKey: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(eventsCache).where(and(eq(eventsCache.sportKey, sportKey), eq(eventsCache.completed, 0))).orderBy(eventsCache.commenceTime);
}

export async function markEventCompleted(eventId: string, homeScore: number, awayScore: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(eventsCache).set({ completed: 1, homeScore, awayScore }).where(eq(eventsCache.eventId, eventId));
}

// ─── Live Scores Helpers ───
export async function getLiveEvents() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(eventsCache).where(eq(eventsCache.isLive, 1)).orderBy(eventsCache.commenceTime);
}

export async function getEventsWithScores(sportKey?: string) {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  const conditions = [
    sql`${eventsCache.commenceTime} <= ${now}`,
    sql`${eventsCache.commenceTime} >= ${fourHoursAgo}`,
  ];
  if (sportKey) {
    conditions.push(eq(eventsCache.sportKey, sportKey) as any);
  }
  return db.select().from(eventsCache).where(and(...conditions)).orderBy(eventsCache.commenceTime);
}

export async function updateEventScores(eventId: string, scores: any, isLive: boolean, completed: boolean, homeScore?: number, awayScore?: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(eventsCache).set({
    scoresJson: scores,
    isLive: isLive ? 1 : 0,
    completed: completed ? 1 : 0,
    homeScore: homeScore ?? null,
    awayScore: awayScore ?? null,
  }).where(eq(eventsCache.eventId, eventId));
}

export async function getActiveEventSportKeys() {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  const results = await db.selectDistinct({ sportKey: eventsCache.sportKey })
    .from(eventsCache)
    .where(and(
      eq(eventsCache.completed, 0),
      sql`${eventsCache.commenceTime} <= ${now}`,
      sql`${eventsCache.commenceTime} >= ${sixHoursAgo}`,
    ));
  return results.map(r => r.sportKey);
}

// ─── Event Detail Helper ───
export async function getEventById(eventId: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(eventsCache).where(eq(eventsCache.eventId, eventId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

// ─── Casino Game Helpers ───
export async function createCasinoGame(userId: number, gameType: string, stake: string, multiplier: string, payout: string, result: "win" | "loss", details?: any) {
  const db = await getDb();
  if (!db) return null;
  const [inserted] = await db.insert(casinoGames).values({ userId, gameType, stake, multiplier, payout, result, details }).$returningId();
  return inserted.id;
}

export async function getUserCasinoHistory(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(casinoGames).where(eq(casinoGames.userId, userId)).orderBy(desc(casinoGames.createdAt)).limit(limit);
}

// ─── Profile Stats Helpers ───
export async function getUserBetStats(userId: number) {
  const db = await getDb();
  if (!db) return { totalBets: 0, wonBets: 0, lostBets: 0, pendingBets: 0, totalStaked: 0, totalWon: 0, winRate: 0 };
  const allBets = await db.select().from(bets).where(eq(bets.userId, userId));
  const totalBets = allBets.length;
  const wonBets = allBets.filter(b => b.status === "won").length;
  const lostBets = allBets.filter(b => b.status === "lost").length;
  const pendingBets = allBets.filter(b => b.status === "pending").length;
  const totalStaked = allBets.reduce((sum, b) => sum + parseFloat(b.stake), 0);
  const totalWon = allBets.filter(b => b.status === "won").reduce((sum, b) => sum + parseFloat(b.potentialWin), 0);
  const winRate = totalBets > 0 ? (wonBets / (wonBets + lostBets)) * 100 : 0;
  return { totalBets, wonBets, lostBets, pendingBets, totalStaked, totalWon, winRate: isNaN(winRate) ? 0 : winRate };
}

export async function getUserSportDistribution(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const userBetItems = await db.select().from(betItems)
    .innerJoin(bets, eq(betItems.betId, bets.id))
    .where(eq(bets.userId, userId));
  const sportCounts: Record<string, number> = {};
  for (const row of userBetItems) {
    const sport = row.bet_items.sportKey;
    sportCounts[sport] = (sportCounts[sport] || 0) + 1;
  }
  return Object.entries(sportCounts)
    .map(([sportKey, count]) => ({ sportKey, count }))
    .sort((a, b) => b.count - a.count);
}

export async function getUserCasinoStats(userId: number) {
  const db = await getDb();
  if (!db) return { totalGames: 0, wonGames: 0, lostGames: 0, totalStaked: 0, totalPayout: 0, winRate: 0 };
  const games = await db.select().from(casinoGames).where(eq(casinoGames.userId, userId));
  const totalGames = games.length;
  const wonGames = games.filter(g => g.result === "win").length;
  const lostGames = games.filter(g => g.result === "loss").length;
  const totalStaked = games.reduce((sum, g) => sum + parseFloat(g.stake), 0);
  const totalPayout = games.reduce((sum, g) => sum + parseFloat(g.payout), 0);
  const winRate = totalGames > 0 ? (wonGames / totalGames) * 100 : 0;
  return { totalGames, wonGames, lostGames, totalStaked, totalPayout, winRate };
}

export async function getUserBalanceHistory(userId: number, limit = 30) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: transactions.id,
    type: transactions.type,
    amount: transactions.amount,
    description: transactions.description,
    createdAt: transactions.createdAt,
  }).from(transactions).where(eq(transactions.userId, userId)).orderBy(transactions.createdAt).limit(limit * 5);
}

// ─── Admin Helpers ───
export async function getAllUsers(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt)).limit(limit);
}

export async function getAllBalances() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(balances);
}

// ─── VIP Tier Helpers ───

export const VIP_TIERS = [
  { name: "bronze" as const, label: "Bronze", minXp: 0, cashbackRate: 0.005, bonusMultiplier: 1.0, color: "#CD7F32", benefits: ["0.5% Cashback", "Standart Oranlar"] },
  { name: "silver" as const, label: "Silver", minXp: 1000, cashbackRate: 0.01, bonusMultiplier: 1.05, color: "#C0C0C0", benefits: ["1% Cashback", "1.05x Bonus Çarpanı", "Haftalık Bonus"] },
  { name: "gold" as const, label: "Gold", minXp: 5000, cashbackRate: 0.02, bonusMultiplier: 1.10, color: "#FFD700", benefits: ["2% Cashback", "1.10x Bonus Çarpanı", "Günlük Bonus", "Özel Promosyonlar"] },
  { name: "platinum" as const, label: "Platinum", minXp: 15000, cashbackRate: 0.035, bonusMultiplier: 1.20, color: "#E5E4E2", benefits: ["3.5% Cashback", "1.20x Bonus Çarpanı", "VIP Destek", "Yüksek Limitler"] },
  { name: "diamond" as const, label: "Diamond", minXp: 50000, cashbackRate: 0.05, bonusMultiplier: 1.35, color: "#B9F2FF", benefits: ["5% Cashback", "1.35x Bonus Çarpanı", "Kişisel Menajer", "Aylık Hediyeler"] },
  { name: "elite" as const, label: "VIP Elite", minXp: 150000, cashbackRate: 0.08, bonusMultiplier: 1.50, color: "#FF4500", benefits: ["8% Cashback", "1.50x Bonus Çarpanı", "Tam VIP Paket", "Sınırsız Limitler", "Davet Etkinlikleri"] },
] as const;

export function getTierByXp(xp: number) {
  let tier = VIP_TIERS[0] as (typeof VIP_TIERS)[number];
  for (const t of VIP_TIERS) {
    if (xp >= t.minXp) tier = t;
  }
  return tier;
}

export function getNextTier(currentTierName: string) {
  const idx = VIP_TIERS.findIndex(t => t.name === currentTierName);
  if (idx < 0 || idx >= VIP_TIERS.length - 1) return null;
  return VIP_TIERS[idx + 1];
}

export async function getOrCreateVipProfile(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const existing = await db.select().from(vipProfiles).where(eq(vipProfiles.userId, userId)).limit(1);
  if (existing.length > 0) return existing[0];
  await db.insert(vipProfiles).values({ userId });
  const created = await db.select().from(vipProfiles).where(eq(vipProfiles.userId, userId)).limit(1);
  return created[0] ?? null;
}

export async function addVipXp(userId: number, xpAmount: number, wagerAmount: number) {
  const db = await getDb();
  if (!db) return null;
  const profile = await getOrCreateVipProfile(userId);
  if (!profile) return null;

  const newXp = profile.totalXp + xpAmount;
  const newWagered = parseFloat(profile.totalWagered) + wagerAmount;
  const newBets = profile.totalBets + 1;
  const newTier = getTierByXp(newXp);
  const tierChanged = newTier.name !== profile.currentTier;

  await db.update(vipProfiles).set({
    totalXp: newXp,
    totalWagered: newWagered.toFixed(2),
    totalBets: newBets,
    currentTier: newTier.name,
    cashbackRate: newTier.cashbackRate.toFixed(4),
    bonusMultiplier: newTier.bonusMultiplier.toFixed(2),
    ...(tierChanged ? { lastTierUp: new Date() } : {}),
  }).where(eq(vipProfiles.userId, userId));

  return { ...profile, totalXp: newXp, currentTier: newTier.name, tierChanged, newTier };
}

export async function getAllVipProfiles(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(vipProfiles).orderBy(desc(vipProfiles.totalXp)).limit(limit);
}

// ─── Banner Helpers ───

export async function getActiveBanners(section: "sports" | "casino") {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  return db.select().from(banners).where(
    and(
      eq(banners.isActive, 1),
      or(eq(banners.section, section), eq(banners.section, "both")),
      or(isNull(banners.startsAt), lte(banners.startsAt, now)),
      or(isNull(banners.endsAt), gte(banners.endsAt, now)),
    )
  ).orderBy(asc(banners.sortOrder));
}

export async function getAllBanners() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(banners).orderBy(asc(banners.sortOrder));
}

export async function getBannerById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(banners).where(eq(banners.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function createBanner(data: Omit<InsertBanner, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) return null;
  const [inserted] = await db.insert(banners).values(data).$returningId();
  return inserted.id;
}

export async function updateBanner(id: number, data: Partial<Omit<InsertBanner, "id" | "createdAt" | "updatedAt">>) {
  const db = await getDb();
  if (!db) return;
  await db.update(banners).set(data).where(eq(banners.id, id));
}

export async function deleteBanner(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(banners).where(eq(banners.id, id));
}

export async function reorderBanners(orderedIds: number[]) {
  const db = await getDb();
  if (!db) return;
  for (let i = 0; i < orderedIds.length; i++) {
    await db.update(banners).set({ sortOrder: i + 1 }).where(eq(banners.id, orderedIds[i]));
  }
}

// ─── Chat Message Helpers ───

export async function getChatHistory(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(chatMessages)
    .where(eq(chatMessages.userId, userId))
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit);
}

export async function addChatMessage(userId: number, role: "user" | "assistant", content: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(chatMessages).values({ userId, role, content });
}

export async function clearChatHistory(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(chatMessages).where(eq(chatMessages.userId, userId));
}
