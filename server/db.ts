import { eq, desc, and, sql, inArray, asc, lte, gte, isNull, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, balances, transactions, bets, betItems, sportsCache, eventsCache, casinoGames, vipProfiles, banners, type InsertBanner, chatMessages, wallets, cryptoDeposits, cryptoWithdrawals, provablyFairSeeds, casinoGameSessions, responsibleGamblingSettings, responsibleGamblingLog, rtpTracking, slotSessions, slotTransactions } from "../drizzle/schema";
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

// ─── Crypto Wallet Helpers ───

export async function createWallet(userId: number, network: string, addressIndex: number, depositAddress: string) {
  const db = await getDb();
  if (!db) return null;
  const [inserted] = await db.insert(wallets).values({
    userId,
    network: network as any,
    addressIndex,
    depositAddress,
  }).$returningId();
  return inserted.id;
}

export async function getUserWallet(userId: number, network: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(wallets)
    .where(and(eq(wallets.userId, userId), eq(wallets.network, network as any)))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getUserWallets(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(wallets).where(eq(wallets.userId, userId));
}

export async function getNextAddressIndex(): Promise<number> {
  const db = await getDb();
  if (!db) return 1;
  const result = await db.select({ maxIdx: sql`MAX(${wallets.addressIndex})` }).from(wallets);
  const max = result[0]?.maxIdx;
  return (typeof max === "number" ? max : 0) + 1;
}

export async function updateWalletAddress(walletId: number, newAddressIndex: number, newAddress: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(wallets).set({
    addressIndex: newAddressIndex,
    depositAddress: newAddress,
  }).where(eq(wallets.id, walletId));
}

export async function getActiveDepositAddresses(network: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(wallets).where(eq(wallets.network, network as any));
}

// ─── Crypto Deposit Helpers ───

export async function createCryptoDeposit(data: {
  userId: number;
  walletId: number;
  network: string;
  txHash: string;
  fromAddress: string;
  amount: string;
  tokenSymbol: string;
  requiredConfirmations: number;
}) {
  const db = await getDb();
  if (!db) return null;
  // Idempotent: skip if txHash already exists
  const existing = await db.select().from(cryptoDeposits)
    .where(eq(cryptoDeposits.txHash, data.txHash)).limit(1);
  if (existing.length > 0) return existing[0].id;

  const [inserted] = await db.insert(cryptoDeposits).values({
    userId: data.userId,
    walletId: data.walletId,
    network: data.network as any,
    txHash: data.txHash,
    fromAddress: data.fromAddress,
    amount: data.amount,
    tokenSymbol: data.tokenSymbol,
    requiredConfirmations: data.requiredConfirmations,
  }).$returningId();
  return inserted.id;
}

export async function updateDepositStatus(id: number, status: string, confirmations: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(cryptoDeposits).set({
    status: status as any,
    confirmations,
  }).where(eq(cryptoDeposits.id, id));
}

export async function creditDeposit(depositId: number) {
  const db = await getDb();
  if (!db) return;

  // Atomic transaction with row lock to prevent double-credit
  await db.transaction(async (tx) => {
    // Lock the deposit row — prevents concurrent credit
    const deposit = await tx.select().from(cryptoDeposits)
      .where(eq(cryptoDeposits.id, depositId))
      .for("update")
      .limit(1);
    if (!deposit.length || deposit[0].status !== "confirmed") return;

    const dep = deposit[0];
    const usdtAmount = dep.amount;

    // Lock balance row too
    await tx.select().from(balances)
      .where(eq(balances.userId, dep.userId))
      .for("update");

    // Credit balance
    await tx.update(balances).set({ amount: sql`amount + ${usdtAmount}` })
      .where(eq(balances.userId, dep.userId));
    await tx.insert(transactions).values({
      userId: dep.userId, type: "deposit", amount: usdtAmount,
      description: `Kripto yatırma: ${dep.tokenSymbol} (${dep.network})`,
    });

    // Mark as credited — inside same transaction
    await tx.update(cryptoDeposits).set({
      status: "credited" as any,
      creditedAt: new Date(),
    }).where(eq(cryptoDeposits.id, depositId));
  });
}

export async function getPendingDeposits() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(cryptoDeposits)
    .where(
      or(
        eq(cryptoDeposits.status, "pending"),
        eq(cryptoDeposits.status, "confirming"),
      ) as any
    );
}

export async function getUserCryptoDeposits(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(cryptoDeposits)
    .where(eq(cryptoDeposits.userId, userId))
    .orderBy(desc(cryptoDeposits.createdAt));
}

export async function getAllCryptoDeposits(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(cryptoDeposits)
    .orderBy(desc(cryptoDeposits.createdAt))
    .limit(limit);
}

// ─── Crypto Withdrawal Helpers ───

export async function createWithdrawal(data: {
  userId: number;
  network: string;
  toAddress: string;
  amount: string;
  fee: string;
  tokenSymbol: string;
}) {
  const db = await getDb();
  if (!db) return null;
  const [inserted] = await db.insert(cryptoWithdrawals).values({
    userId: data.userId,
    network: data.network as any,
    toAddress: data.toAddress,
    amount: data.amount,
    fee: data.fee,
    tokenSymbol: data.tokenSymbol,
  }).$returningId();
  return inserted.id;
}

export async function updateWithdrawalStatus(id: number, status: string, txHash?: string, reviewedBy?: number, adminNote?: string) {
  const db = await getDb();
  if (!db) return;
  const updateData: any = { status };
  if (txHash) updateData.txHash = txHash;
  if (reviewedBy) updateData.reviewedBy = reviewedBy;
  if (adminNote !== undefined) updateData.adminNote = adminNote;
  if (status === "completed" || status === "rejected" || status === "failed") {
    updateData.processedAt = new Date();
  }
  await db.update(cryptoWithdrawals).set(updateData).where(eq(cryptoWithdrawals.id, id));
}

export async function getWithdrawalById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(cryptoWithdrawals)
    .where(eq(cryptoWithdrawals.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getPendingWithdrawals() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(cryptoWithdrawals)
    .where(eq(cryptoWithdrawals.status, "pending"))
    .orderBy(desc(cryptoWithdrawals.createdAt));
}

export async function getUserWithdrawals(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(cryptoWithdrawals)
    .where(eq(cryptoWithdrawals.userId, userId))
    .orderBy(desc(cryptoWithdrawals.createdAt));
}

// Atomic balance deduction with row lock — prevents race condition on withdrawals
export async function atomicDeductBalance(
  userId: number,
  totalCost: number,
  description: string
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "DB unavailable" };

  try {
    await db.transaction(async (tx) => {
      // Lock the balance row
      const bal = await tx.select().from(balances)
        .where(eq(balances.userId, userId))
        .for("update")
        .limit(1);

      if (!bal.length || parseFloat(bal[0].amount) < totalCost) {
        throw new Error("Yetersiz bakiye");
      }

      // Deduct inside the lock
      await tx.update(balances)
        .set({ amount: sql`amount - ${totalCost.toFixed(2)}` })
        .where(eq(balances.userId, userId));

      await tx.insert(transactions).values({
        userId, type: "withdraw", amount: totalCost.toFixed(2), description,
      });
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Transaction failed" };
  }
}

export async function getUserDailyWithdrawalTotal(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
    .from(cryptoWithdrawals)
    .where(and(
      eq(cryptoWithdrawals.userId, userId),
      gte(cryptoWithdrawals.createdAt, sql`DATE_SUB(NOW(), INTERVAL 24 HOUR)`),
      // Count all non-rejected withdrawals
      sql`${cryptoWithdrawals.status} != 'rejected'`,
      sql`${cryptoWithdrawals.status} != 'failed'`,
    ));
  return parseFloat(result[0]?.total || "0");
}

export async function getAllWithdrawals(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(cryptoWithdrawals)
    .orderBy(desc(cryptoWithdrawals.createdAt))
    .limit(limit);
}

// ─── Provably Fair Seed Helpers ───

export async function createProvablyFairSeed(userId: number, serverSeed: string, serverSeedHash: string, clientSeed: string) {
  const db = await getDb();
  if (!db) return null;
  const [inserted] = await db.insert(provablyFairSeeds).values({
    userId, serverSeed, serverSeedHash, clientSeed,
  }).$returningId();
  return inserted.id;
}

export async function getActiveSeed(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(provablyFairSeeds)
    .where(and(eq(provablyFairSeeds.userId, userId), eq(provablyFairSeeds.status, "active")))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function incrementSeedNonce(seedId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  await db.update(provablyFairSeeds)
    .set({ nonce: sql`nonce + 1` })
    .where(eq(provablyFairSeeds.id, seedId));
  const updated = await db.select({ nonce: provablyFairSeeds.nonce })
    .from(provablyFairSeeds)
    .where(eq(provablyFairSeeds.id, seedId))
    .limit(1);
  return updated[0]?.nonce ?? 0;
}

export async function updateSeedClientSeed(seedId: number, clientSeed: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(provablyFairSeeds)
    .set({ clientSeed })
    .where(eq(provablyFairSeeds.id, seedId));
}

export async function revealSeed(seedId: number) {
  const db = await getDb();
  if (!db) return null;
  await db.update(provablyFairSeeds)
    .set({ status: "revealed", revealedAt: new Date() })
    .where(eq(provablyFairSeeds.id, seedId));
  return db.select().from(provablyFairSeeds).where(eq(provablyFairSeeds.id, seedId)).limit(1).then(r => r[0] ?? null);
}

export async function getSeedById(seedId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(provablyFairSeeds).where(eq(provablyFairSeeds.id, seedId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

// ─── Casino Game Session Helpers ───

export async function createGameSession(data: {
  userId: number;
  gameType: string;
  stake: string;
  serverSeedId: number;
  nonce: number;
  gameData: any;
  commitHash: string;
}) {
  const db = await getDb();
  if (!db) return null;
  const [inserted] = await db.insert(casinoGameSessions).values({
    userId: data.userId,
    gameType: data.gameType,
    stake: data.stake,
    serverSeedId: data.serverSeedId,
    nonce: data.nonce,
    gameData: data.gameData,
    commitHash: data.commitHash,
  }).$returningId();
  return inserted.id;
}

export async function getActiveGameSession(userId: number, gameType: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(casinoGameSessions)
    .where(and(
      eq(casinoGameSessions.userId, userId),
      eq(casinoGameSessions.gameType, gameType),
      eq(casinoGameSessions.status, "active"),
    ))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getGameSessionById(sessionId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(casinoGameSessions).where(eq(casinoGameSessions.id, sessionId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function completeGameSession(sessionId: number, result: "win" | "loss", multiplier: string, payout: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(casinoGameSessions).set({
    status: "completed",
    result,
    multiplier,
    payout,
    completedAt: new Date(),
  }).where(eq(casinoGameSessions.id, sessionId));
}

export async function cancelGameSession(sessionId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(casinoGameSessions).set({
    status: "cancelled",
    completedAt: new Date(),
  }).where(eq(casinoGameSessions.id, sessionId));
}

// ─── Responsible Gambling Helpers ───

export async function getResponsibleGamblingSettings(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(responsibleGamblingSettings)
    .where(eq(responsibleGamblingSettings.userId, userId))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function upsertResponsibleGamblingSettings(userId: number, data: Partial<{
  selfExclusionUntil: Date | null;
  selfExclusionType: "24h" | "7d" | "30d" | "permanent" | null;
  depositLimitDaily: string | null;
  depositLimitWeekly: string | null;
  depositLimitMonthly: string | null;
  lossLimitDaily: string | null;
  lossLimitWeekly: string | null;
  lossLimitMonthly: string | null;
  wagerLimitDaily: string | null;
  wagerLimitWeekly: string | null;
  wagerLimitMonthly: string | null;
  sessionReminderMinutes: number | null;
  realityCheckMinutes: number | null;
}>) {
  const db = await getDb();
  if (!db) return;

  const existing = await getResponsibleGamblingSettings(userId);
  if (existing) {
    await db.update(responsibleGamblingSettings)
      .set(data as any)
      .where(eq(responsibleGamblingSettings.userId, userId));
  } else {
    await db.insert(responsibleGamblingSettings).values({ userId, ...data } as any);
  }
}

export async function addResponsibleGamblingLog(userId: number, action: string, details?: any) {
  const db = await getDb();
  if (!db) return;
  await db.insert(responsibleGamblingLog).values({ userId, action, details });
}

export async function getResponsibleGamblingLogs(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(responsibleGamblingLog)
    .where(eq(responsibleGamblingLog.userId, userId))
    .orderBy(desc(responsibleGamblingLog.createdAt))
    .limit(limit);
}

/** Get user's total wager in the last N hours */
export async function getUserWagerTotal(userId: number, hours: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({
    total: sql<string>`COALESCE(SUM(${casinoGames.stake}), 0)`,
  }).from(casinoGames).where(and(
    eq(casinoGames.userId, userId),
    gte(casinoGames.createdAt, sql`DATE_SUB(NOW(), INTERVAL ${hours} HOUR)`),
  ));
  return parseFloat(result[0]?.total || "0");
}

/** Get user's net loss in the last N hours */
export async function getUserLossTotal(userId: number, hours: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({
    totalStaked: sql<string>`COALESCE(SUM(${casinoGames.stake}), 0)`,
    totalPayout: sql<string>`COALESCE(SUM(${casinoGames.payout}), 0)`,
  }).from(casinoGames).where(and(
    eq(casinoGames.userId, userId),
    gte(casinoGames.createdAt, sql`DATE_SUB(NOW(), INTERVAL ${hours} HOUR)`),
  ));
  const staked = parseFloat(result[0]?.totalStaked || "0");
  const payout = parseFloat(result[0]?.totalPayout || "0");
  return Math.max(0, staked - payout);
}

// ─── RTP Tracking Helpers ───

export async function updateRtpTracking(gameType: string, wagered: number, paidOut: number) {
  const db = await getDb();
  if (!db) return;

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // start of day
  const periodEnd = new Date(periodStart.getTime() + 24 * 60 * 60 * 1000);

  // Try to find existing record for this game + today
  const existing = await db.select().from(rtpTracking).where(and(
    eq(rtpTracking.gameType, gameType),
    eq(rtpTracking.periodStart, periodStart),
  )).limit(1);

  if (existing.length > 0) {
    const rec = existing[0];
    const newWagered = parseFloat(rec.totalWagered) + wagered;
    const newPaidOut = parseFloat(rec.totalPaidOut) + paidOut;
    const newGames = rec.totalGames + 1;
    const newRtp = newWagered > 0 ? (newPaidOut / newWagered) * 100 : 0;
    await db.update(rtpTracking).set({
      totalWagered: newWagered.toFixed(2),
      totalPaidOut: newPaidOut.toFixed(2),
      totalGames: newGames,
      rtp: newRtp.toFixed(4),
    }).where(eq(rtpTracking.id, rec.id));
  } else {
    const rtp = wagered > 0 ? (paidOut / wagered) * 100 : 0;
    await db.insert(rtpTracking).values({
      gameType,
      periodStart,
      periodEnd,
      totalWagered: wagered.toFixed(2),
      totalPaidOut: paidOut.toFixed(2),
      totalGames: 1,
      rtp: rtp.toFixed(4),
    });
  }
}

export async function getRtpReport(days = 30) {
  const db = await getDb();
  if (!db) return [];
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return db.select().from(rtpTracking)
    .where(gte(rtpTracking.periodStart, since))
    .orderBy(desc(rtpTracking.periodStart));
}

export async function getRtpSummary() {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select({
    gameType: rtpTracking.gameType,
    totalWagered: sql<string>`SUM(${rtpTracking.totalWagered})`,
    totalPaidOut: sql<string>`SUM(${rtpTracking.totalPaidOut})`,
    totalGames: sql<number>`SUM(${rtpTracking.totalGames})`,
  }).from(rtpTracking)
    .groupBy(rtpTracking.gameType);

  return result.map(r => ({
    gameType: r.gameType,
    totalWagered: parseFloat(r.totalWagered || "0"),
    totalPaidOut: parseFloat(r.totalPaidOut || "0"),
    totalGames: Number(r.totalGames || 0),
    rtp: parseFloat(r.totalWagered || "0") > 0
      ? (parseFloat(r.totalPaidOut || "0") / parseFloat(r.totalWagered || "0")) * 100
      : 0,
  }));
}

export async function getAllCasinoGames(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(casinoGames).orderBy(desc(casinoGames.createdAt)).limit(limit);
}

// ─── Slot Session & Transaction Helpers (BLAS345) ───

export async function createSlotSession(userId: number, gameId: string) {
  const db = await getDb();
  if (!db) return null;
  const [inserted] = await db.insert(slotSessions).values({ userId, gameId }).$returningId();
  return inserted.id;
}

export async function getActiveSlotSession(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(slotSessions)
    .where(and(eq(slotSessions.userId, userId), eq(slotSessions.status, "active")))
    .orderBy(desc(slotSessions.createdAt))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function closeSlotSession(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(slotSessions).set({ status: "closed", closedAt: new Date() })
    .where(and(eq(slotSessions.userId, userId), eq(slotSessions.status, "active")));
}

export async function createSlotTransaction(data: {
  userId: number;
  sessionId: number | null;
  blas345StatId: string;
  gameId: string;
  type: number;
  bet: string;
  win: string;
  balanceBefore: string;
  balanceAfter: string;
}) {
  const db = await getDb();
  if (!db) return null;
  const [inserted] = await db.insert(slotTransactions).values(data).$returningId();
  return inserted.id;
}
