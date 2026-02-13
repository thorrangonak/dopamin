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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CasinoGame = typeof casinoGames.$inferSelect;

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