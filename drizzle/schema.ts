import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, json } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 256 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Balances ───
export const balances = mysqlTable("balances", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull().default("0.00"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Balance = typeof balances.$inferSelect;

// ─── Transactions ───
export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["deposit", "withdraw", "bet_place", "bet_win", "bet_refund"]).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Transaction = typeof transactions.$inferSelect;

// ─── Bets (Kuponlar) ───
export const bets = mysqlTable("bets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["single", "combo"]).notNull(),
  stake: decimal("stake", { precision: 12, scale: 2 }).notNull(),
  totalOdds: decimal("totalOdds", { precision: 10, scale: 4 }).notNull(),
  potentialWin: decimal("potentialWin", { precision: 12, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["pending", "won", "lost", "partial", "refunded"]).default("pending").notNull(),
  settledAt: timestamp("settledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Bet = typeof bets.$inferSelect;

// ─── Bet Items (Kupon Detayları) ───
export const betItems = mysqlTable("bet_items", {
  id: int("id").autoincrement().primaryKey(),
  betId: int("betId").notNull(),
  eventId: varchar("eventId", { length: 128 }).notNull(),
  sportKey: varchar("sportKey", { length: 128 }).notNull(),
  homeTeam: varchar("homeTeam", { length: 256 }).notNull(),
  awayTeam: varchar("awayTeam", { length: 256 }).notNull(),
  commenceTime: timestamp("commenceTime").notNull(),
  marketKey: varchar("marketKey", { length: 64 }).notNull(),
  outcomeName: varchar("outcomeName", { length: 256 }).notNull(),
  outcomePrice: decimal("outcomePrice", { precision: 10, scale: 4 }).notNull(),
  point: decimal("point", { precision: 8, scale: 2 }),
  status: mysqlEnum("status", ["pending", "won", "lost", "refunded"]).default("pending").notNull(),
  homeScore: int("homeScore"),
  awayScore: int("awayScore"),
  settledAt: timestamp("settledAt"),
});

export type BetItem = typeof betItems.$inferSelect;

// ─── Sports Cache ───
export const sportsCache = mysqlTable("sports_cache", {
  id: int("id").autoincrement().primaryKey(),
  sportKey: varchar("sportKey", { length: 128 }).notNull().unique(),
  groupName: varchar("groupName", { length: 128 }).notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description"),
  active: int("active").notNull().default(1),
  hasOutrights: int("hasOutrights").notNull().default(0),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SportsCache = typeof sportsCache.$inferSelect;

// ─── Events Cache ───
export const eventsCache = mysqlTable("events_cache", {
  id: int("id").autoincrement().primaryKey(),
  eventId: varchar("eventId", { length: 128 }).notNull().unique(),
  sportKey: varchar("sportKey", { length: 128 }).notNull(),
  homeTeam: varchar("homeTeam", { length: 256 }).notNull(),
  awayTeam: varchar("awayTeam", { length: 256 }).notNull(),
  commenceTime: timestamp("commenceTime").notNull(),
  completed: int("completed").notNull().default(0),
  homeScore: int("homeScore"),
  awayScore: int("awayScore"),
  oddsJson: json("oddsJson"),
  scoresJson: json("scoresJson"),
  isLive: int("isLive").notNull().default(0),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EventsCache = typeof eventsCache.$inferSelect;

// ─── Provably Fair Seeds ───
export const provablyFairSeeds = mysqlTable("provably_fair_seeds", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  serverSeed: varchar("serverSeed", { length: 64 }).notNull(),
  serverSeedHash: varchar("serverSeedHash", { length: 64 }).notNull(),
  clientSeed: varchar("clientSeed", { length: 64 }).notNull(),
  nonce: int("nonce").notNull().default(0),
  status: mysqlEnum("status", ["active", "revealed", "expired"]).default("active").notNull(),
  revealedAt: timestamp("revealedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProvablyFairSeed = typeof provablyFairSeeds.$inferSelect;

// ─── Casino Games ───
export const casinoGames = mysqlTable("casino_games", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  gameType: varchar("gameType", { length: 64 }).notNull(),
  stake: decimal("stake", { precision: 12, scale: 2 }).notNull(),
  multiplier: decimal("multiplier", { precision: 10, scale: 4 }).notNull(),
  payout: decimal("payout", { precision: 12, scale: 2 }).notNull().default("0.00"),
  result: mysqlEnum("result", ["win", "loss"]).notNull(),
  details: json("details"),
  // Provably fair fields
  serverSeedHash: varchar("serverSeedHash", { length: 64 }),
  clientSeed: varchar("clientSeed_pf", { length: 64 }),
  nonce: int("nonce_pf"),
  hmacResult: varchar("hmacResult", { length: 64 }),
  sessionId: int("sessionId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CasinoGame = typeof casinoGames.$inferSelect;

// ─── Casino Game Sessions (Mines, etc.) ───
export const casinoGameSessions = mysqlTable("casino_game_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  gameType: varchar("gameType", { length: 64 }).notNull(),
  stake: decimal("stake", { precision: 12, scale: 2 }).notNull(),
  serverSeedId: int("serverSeedId").notNull(),
  nonce: int("nonce").notNull(),
  gameData: json("gameData"), // e.g. mine positions for Mines
  commitHash: varchar("commitHash", { length: 64 }),
  status: mysqlEnum("status", ["active", "completed", "cancelled"]).default("active").notNull(),
  result: mysqlEnum("result", ["win", "loss"]),
  multiplier: decimal("multiplier", { precision: 10, scale: 4 }),
  payout: decimal("payout", { precision: 12, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type CasinoGameSession = typeof casinoGameSessions.$inferSelect;

// ─── Responsible Gambling Settings ───
export const responsibleGamblingSettings = mysqlTable("responsible_gambling_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  selfExclusionUntil: timestamp("selfExclusionUntil"),
  selfExclusionType: mysqlEnum("selfExclusionType", ["24h", "7d", "30d", "permanent"]),
  depositLimitDaily: decimal("depositLimitDaily", { precision: 12, scale: 2 }),
  depositLimitWeekly: decimal("depositLimitWeekly", { precision: 12, scale: 2 }),
  depositLimitMonthly: decimal("depositLimitMonthly", { precision: 12, scale: 2 }),
  lossLimitDaily: decimal("lossLimitDaily", { precision: 12, scale: 2 }),
  lossLimitWeekly: decimal("lossLimitWeekly", { precision: 12, scale: 2 }),
  lossLimitMonthly: decimal("lossLimitMonthly", { precision: 12, scale: 2 }),
  wagerLimitDaily: decimal("wagerLimitDaily", { precision: 12, scale: 2 }),
  wagerLimitWeekly: decimal("wagerLimitWeekly", { precision: 12, scale: 2 }),
  wagerLimitMonthly: decimal("wagerLimitMonthly", { precision: 12, scale: 2 }),
  sessionReminderMinutes: int("sessionReminderMinutes"),
  realityCheckMinutes: int("realityCheckMinutes"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ResponsibleGamblingSettings = typeof responsibleGamblingSettings.$inferSelect;

// ─── Responsible Gambling Log ───
export const responsibleGamblingLog = mysqlTable("responsible_gambling_log", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  action: varchar("action", { length: 128 }).notNull(),
  details: json("details"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ResponsibleGamblingLog = typeof responsibleGamblingLog.$inferSelect;

// ─── RTP Tracking ───
export const rtpTracking = mysqlTable("rtp_tracking", {
  id: int("id").autoincrement().primaryKey(),
  gameType: varchar("gameType", { length: 64 }).notNull(),
  periodStart: timestamp("periodStart").notNull(),
  periodEnd: timestamp("periodEnd").notNull(),
  totalWagered: decimal("totalWagered", { precision: 14, scale: 2 }).notNull().default("0.00"),
  totalPaidOut: decimal("totalPaidOut", { precision: 14, scale: 2 }).notNull().default("0.00"),
  totalGames: int("totalGames").notNull().default(0),
  rtp: decimal("rtp", { precision: 8, scale: 4 }).notNull().default("0.0000"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type RtpTracking = typeof rtpTracking.$inferSelect;

// ─── VIP Tiers ───
export const vipProfiles = mysqlTable("vip_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  totalXp: int("totalXp").notNull().default(0),
  currentTier: mysqlEnum("currentTier", ["bronze", "silver", "gold", "platinum", "diamond", "elite"]).default("bronze").notNull(),
  totalWagered: decimal("totalWagered", { precision: 14, scale: 2 }).notNull().default("0.00"),
  totalBets: int("totalBets").notNull().default(0),
  cashbackRate: decimal("cashbackRate", { precision: 5, scale: 4 }).notNull().default("0.0050"),
  bonusMultiplier: decimal("bonusMultiplier", { precision: 5, scale: 2 }).notNull().default("1.00"),
  lastTierUp: timestamp("lastTierUp"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type VipProfile = typeof vipProfiles.$inferSelect;

// ─── Banners ───
export const banners = mysqlTable("banners", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 256 }).notNull(),
  imageUrl: text("imageUrl").notNull(),
  ctaLink: varchar("ctaLink", { length: 512 }).notNull().default("/"),
  section: mysqlEnum("section", ["sports", "casino", "both"]).notNull().default("both"),
  sortOrder: int("sortOrder").notNull().default(0),
  isActive: int("isActive").notNull().default(1),
  startsAt: timestamp("startsAt"),
  endsAt: timestamp("endsAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Banner = typeof banners.$inferSelect;
export type InsertBanner = typeof banners.$inferInsert;

// ─── Chat Messages (AI Assistant) ───
export const chatMessages = mysqlTable("chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;

// ─── Crypto Wallets ───
export const wallets = mysqlTable("wallets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  network: mysqlEnum("network", ["tron", "ethereum", "bsc", "polygon", "solana", "bitcoin"]).notNull(),
  addressIndex: int("addressIndex").notNull(),
  depositAddress: varchar("depositAddress", { length: 128 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Wallet = typeof wallets.$inferSelect;

// ─── Crypto Deposits ───
export const cryptoDeposits = mysqlTable("crypto_deposits", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  walletId: int("walletId").notNull(),
  network: mysqlEnum("network", ["tron", "ethereum", "bsc", "polygon", "solana", "bitcoin"]).notNull(),
  txHash: varchar("txHash", { length: 128 }).notNull().unique(),
  fromAddress: varchar("fromAddress", { length: 128 }),
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  tokenSymbol: varchar("tokenSymbol", { length: 10 }).notNull(),
  confirmations: int("confirmations").notNull().default(0),
  requiredConfirmations: int("requiredConfirmations").notNull(),
  status: mysqlEnum("status", ["pending", "confirming", "confirmed", "credited", "failed"]).default("pending").notNull(),
  creditedAt: timestamp("creditedAt"),
  sweepTxHash: varchar("sweepTxHash", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CryptoDeposit = typeof cryptoDeposits.$inferSelect;

// ─── Crypto Withdrawals ───
export const cryptoWithdrawals = mysqlTable("crypto_withdrawals", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  network: mysqlEnum("network", ["tron", "ethereum", "bsc", "polygon", "solana", "bitcoin"]).notNull(),
  toAddress: varchar("toAddress", { length: 128 }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  fee: decimal("fee", { precision: 12, scale: 2 }).notNull(),
  tokenSymbol: varchar("tokenSymbol", { length: 10 }).notNull(),
  status: mysqlEnum("status", ["pending", "approved", "processing", "completed", "rejected", "failed"]).default("pending").notNull(),
  txHash: varchar("txHash", { length: 128 }),
  reviewedBy: int("reviewedBy"),
  adminNote: text("adminNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  processedAt: timestamp("processedAt"),
});

export type CryptoWithdrawal = typeof cryptoWithdrawals.$inferSelect;

// ─── Slot Sessions (BLAS345) ───
export const slotSessions = mysqlTable("slot_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  gameId: varchar("gameId", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["active", "closed"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  closedAt: timestamp("closedAt"),
});

export type SlotSession = typeof slotSessions.$inferSelect;

// ─── Slot Transactions (BLAS345 callbacks) ───
export const slotTransactions = mysqlTable("slot_transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  sessionId: int("sessionId"),
  blas345StatId: varchar("blas345StatId", { length: 64 }),
  gameId: varchar("gameId", { length: 64 }).notNull(),
  type: int("type").notNull(), // 1=spin, 2=gamble, 3=bonus
  bet: decimal("bet", { precision: 12, scale: 2 }).notNull(),
  win: decimal("win", { precision: 12, scale: 2 }).notNull(),
  balanceBefore: decimal("balanceBefore", { precision: 12, scale: 2 }).notNull(),
  balanceAfter: decimal("balanceAfter", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SlotTransaction = typeof slotTransactions.$inferSelect;