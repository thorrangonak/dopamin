var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// server/vercel/trpc-handler.ts
import "dotenv/config";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import express from "express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  const secure = isSecureRequest(req);
  return {
    httpOnly: true,
    path: "/",
    sameSite: secure ? "none" : "lax",
    secure
  };
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  theOddsApiKey: process.env.THE_ODDS_API_KEY ?? ""
};

// server/_core/notification.ts
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
    console.warn("[Notification] Service not configured, skipping notification.");
    return false;
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";

// server/db.ts
import { eq, desc, and, sql, asc, lte, gte, isNull, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

// drizzle/schema.ts
import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, json } from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 256 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var balances = mysqlTable("balances", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull().default("0.00"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["deposit", "withdraw", "bet_place", "bet_win", "bet_refund"]).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var bets = mysqlTable("bets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["single", "combo"]).notNull(),
  stake: decimal("stake", { precision: 12, scale: 2 }).notNull(),
  totalOdds: decimal("totalOdds", { precision: 10, scale: 4 }).notNull(),
  potentialWin: decimal("potentialWin", { precision: 12, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["pending", "won", "lost", "partial", "refunded"]).default("pending").notNull(),
  settledAt: timestamp("settledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var betItems = mysqlTable("bet_items", {
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
  settledAt: timestamp("settledAt")
});
var sportsCache = mysqlTable("sports_cache", {
  id: int("id").autoincrement().primaryKey(),
  sportKey: varchar("sportKey", { length: 128 }).notNull().unique(),
  groupName: varchar("groupName", { length: 128 }).notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description"),
  active: int("active").notNull().default(1),
  hasOutrights: int("hasOutrights").notNull().default(0),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var eventsCache = mysqlTable("events_cache", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var casinoGames = mysqlTable("casino_games", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  gameType: varchar("gameType", { length: 64 }).notNull(),
  stake: decimal("stake", { precision: 12, scale: 2 }).notNull(),
  multiplier: decimal("multiplier", { precision: 10, scale: 4 }).notNull(),
  payout: decimal("payout", { precision: 12, scale: 2 }).notNull().default("0.00"),
  result: mysqlEnum("result", ["win", "loss"]).notNull(),
  details: json("details"),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var vipProfiles = mysqlTable("vip_profiles", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var banners = mysqlTable("banners", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var chatMessages = mysqlTable("chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var wallets = mysqlTable("wallets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  network: mysqlEnum("network", ["tron", "ethereum", "bsc", "polygon", "solana", "bitcoin"]).notNull(),
  addressIndex: int("addressIndex").notNull(),
  depositAddress: varchar("depositAddress", { length: 128 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var cryptoDeposits = mysqlTable("crypto_deposits", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var cryptoWithdrawals = mysqlTable("crypto_withdrawals", {
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
  processedAt: timestamp("processedAt")
});

// server/db.ts
var _db = null;
async function getDb() {
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
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values = {
      openId: user.openId
    };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod", "passwordHash"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = /* @__PURE__ */ new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return void 0;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function getUserByEmail(email) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function getOrCreateBalance(userId) {
  const db = await getDb();
  if (!db) return null;
  const existing = await db.select().from(balances).where(eq(balances.userId, userId)).limit(1);
  if (existing.length > 0) return existing[0];
  await db.insert(balances).values({ userId, amount: "0.00" });
  const created = await db.select().from(balances).where(eq(balances.userId, userId)).limit(1);
  return created[0] ?? null;
}
async function updateBalance(userId, delta) {
  const db = await getDb();
  if (!db) return null;
  await db.update(balances).set({ amount: sql`amount + ${delta}` }).where(eq(balances.userId, userId));
  return getOrCreateBalance(userId);
}
async function addTransaction(userId, type, amount, description) {
  const db = await getDb();
  if (!db) return;
  await db.insert(transactions).values({ userId, type, amount, description });
}
async function getUserTransactions(userId, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(transactions).where(eq(transactions.userId, userId)).orderBy(desc(transactions.createdAt)).limit(limit);
}
async function getAllTransactions(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(transactions).orderBy(desc(transactions.createdAt)).limit(limit);
}
async function createBet(userId, type, stake, totalOdds, potentialWin, items) {
  const db = await getDb();
  if (!db) return null;
  const [inserted] = await db.insert(bets).values({ userId, type, stake, totalOdds, potentialWin }).$returningId();
  const betId = inserted.id;
  for (const item of items) {
    await db.insert(betItems).values({ betId, ...item });
  }
  return betId;
}
async function getUserBets(userId, status) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(bets.userId, userId)];
  if (status && status !== "all") {
    conditions.push(eq(bets.status, status));
  }
  return db.select().from(bets).where(and(...conditions)).orderBy(desc(bets.createdAt));
}
async function getBetWithItems(betId) {
  const db = await getDb();
  if (!db) return null;
  const bet = await db.select().from(bets).where(eq(bets.id, betId)).limit(1);
  if (bet.length === 0) return null;
  const items = await db.select().from(betItems).where(eq(betItems.betId, betId));
  return { ...bet[0], items };
}
async function getAllBets(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(bets).orderBy(desc(bets.createdAt)).limit(limit);
}
async function getPendingBets() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(bets).where(eq(bets.status, "pending"));
}
async function updateBetItemResult(itemId, status, homeScore, awayScore) {
  const db = await getDb();
  if (!db) return;
  await db.update(betItems).set({ status, homeScore, awayScore, settledAt: /* @__PURE__ */ new Date() }).where(eq(betItems.id, itemId));
}
async function updateBetStatus(betId, status) {
  const db = await getDb();
  if (!db) return;
  await db.update(bets).set({ status, settledAt: /* @__PURE__ */ new Date() }).where(eq(bets.id, betId));
}
async function getBetItemsByBetId(betId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(betItems).where(eq(betItems.betId, betId));
}
async function upsertSport(sport) {
  const db = await getDb();
  if (!db) return;
  await db.insert(sportsCache).values(sport).onDuplicateKeyUpdate({
    set: { groupName: sport.groupName, title: sport.title, description: sport.description, active: sport.active, hasOutrights: sport.hasOutrights }
  });
}
async function getActiveSports() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sportsCache).where(eq(sportsCache.active, 1));
}
async function upsertEvent(event) {
  const db = await getDb();
  if (!db) return;
  await db.insert(eventsCache).values(event).onDuplicateKeyUpdate({
    set: { homeTeam: event.homeTeam, awayTeam: event.awayTeam, commenceTime: event.commenceTime, oddsJson: event.oddsJson }
  });
}
async function getEventsBySport(sportKey) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(eventsCache).where(and(eq(eventsCache.sportKey, sportKey), eq(eventsCache.completed, 0))).orderBy(eventsCache.commenceTime);
}
async function markEventCompleted(eventId, homeScore, awayScore) {
  const db = await getDb();
  if (!db) return;
  await db.update(eventsCache).set({ completed: 1, homeScore, awayScore }).where(eq(eventsCache.eventId, eventId));
}
async function getLiveEvents() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(eventsCache).where(eq(eventsCache.isLive, 1)).orderBy(eventsCache.commenceTime);
}
async function getEventsWithScores(sportKey) {
  const db = await getDb();
  if (!db) return [];
  const now = /* @__PURE__ */ new Date();
  const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1e3);
  const conditions = [
    sql`${eventsCache.commenceTime} <= ${now}`,
    sql`${eventsCache.commenceTime} >= ${fourHoursAgo}`
  ];
  if (sportKey) {
    conditions.push(eq(eventsCache.sportKey, sportKey));
  }
  return db.select().from(eventsCache).where(and(...conditions)).orderBy(eventsCache.commenceTime);
}
async function updateEventScores(eventId, scores, isLive, completed, homeScore, awayScore) {
  const db = await getDb();
  if (!db) return;
  await db.update(eventsCache).set({
    scoresJson: scores,
    isLive: isLive ? 1 : 0,
    completed: completed ? 1 : 0,
    homeScore: homeScore ?? null,
    awayScore: awayScore ?? null
  }).where(eq(eventsCache.eventId, eventId));
}
async function getActiveEventSportKeys() {
  const db = await getDb();
  if (!db) return [];
  const now = /* @__PURE__ */ new Date();
  const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1e3);
  const results = await db.selectDistinct({ sportKey: eventsCache.sportKey }).from(eventsCache).where(and(
    eq(eventsCache.completed, 0),
    sql`${eventsCache.commenceTime} <= ${now}`,
    sql`${eventsCache.commenceTime} >= ${sixHoursAgo}`
  ));
  return results.map((r) => r.sportKey);
}
async function getEventById(eventId) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(eventsCache).where(eq(eventsCache.eventId, eventId)).limit(1);
  return result.length > 0 ? result[0] : null;
}
async function createCasinoGame(userId, gameType, stake, multiplier, payout, result, details) {
  const db = await getDb();
  if (!db) return null;
  const [inserted] = await db.insert(casinoGames).values({ userId, gameType, stake, multiplier, payout, result, details }).$returningId();
  return inserted.id;
}
async function getUserCasinoHistory(userId, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(casinoGames).where(eq(casinoGames.userId, userId)).orderBy(desc(casinoGames.createdAt)).limit(limit);
}
async function getUserBetStats(userId) {
  const db = await getDb();
  if (!db) return { totalBets: 0, wonBets: 0, lostBets: 0, pendingBets: 0, totalStaked: 0, totalWon: 0, winRate: 0 };
  const allBets = await db.select().from(bets).where(eq(bets.userId, userId));
  const totalBets = allBets.length;
  const wonBets = allBets.filter((b) => b.status === "won").length;
  const lostBets = allBets.filter((b) => b.status === "lost").length;
  const pendingBets = allBets.filter((b) => b.status === "pending").length;
  const totalStaked = allBets.reduce((sum, b) => sum + parseFloat(b.stake), 0);
  const totalWon = allBets.filter((b) => b.status === "won").reduce((sum, b) => sum + parseFloat(b.potentialWin), 0);
  const winRate = totalBets > 0 ? wonBets / (wonBets + lostBets) * 100 : 0;
  return { totalBets, wonBets, lostBets, pendingBets, totalStaked, totalWon, winRate: isNaN(winRate) ? 0 : winRate };
}
async function getUserSportDistribution(userId) {
  const db = await getDb();
  if (!db) return [];
  const userBetItems = await db.select().from(betItems).innerJoin(bets, eq(betItems.betId, bets.id)).where(eq(bets.userId, userId));
  const sportCounts = {};
  for (const row of userBetItems) {
    const sport = row.bet_items.sportKey;
    sportCounts[sport] = (sportCounts[sport] || 0) + 1;
  }
  return Object.entries(sportCounts).map(([sportKey, count]) => ({ sportKey, count })).sort((a, b) => b.count - a.count);
}
async function getUserCasinoStats(userId) {
  const db = await getDb();
  if (!db) return { totalGames: 0, wonGames: 0, lostGames: 0, totalStaked: 0, totalPayout: 0, winRate: 0 };
  const games = await db.select().from(casinoGames).where(eq(casinoGames.userId, userId));
  const totalGames = games.length;
  const wonGames = games.filter((g) => g.result === "win").length;
  const lostGames = games.filter((g) => g.result === "loss").length;
  const totalStaked = games.reduce((sum, g) => sum + parseFloat(g.stake), 0);
  const totalPayout = games.reduce((sum, g) => sum + parseFloat(g.payout), 0);
  const winRate = totalGames > 0 ? wonGames / totalGames * 100 : 0;
  return { totalGames, wonGames, lostGames, totalStaked, totalPayout, winRate };
}
async function getUserBalanceHistory(userId, limit = 30) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: transactions.id,
    type: transactions.type,
    amount: transactions.amount,
    description: transactions.description,
    createdAt: transactions.createdAt
  }).from(transactions).where(eq(transactions.userId, userId)).orderBy(transactions.createdAt).limit(limit * 5);
}
async function getAllUsers(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt)).limit(limit);
}
async function getAllBalances() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(balances);
}
var VIP_TIERS = [
  { name: "bronze", label: "Bronze", minXp: 0, cashbackRate: 5e-3, bonusMultiplier: 1, color: "#CD7F32", benefits: ["0.5% Cashback", "Standart Oranlar"] },
  { name: "silver", label: "Silver", minXp: 1e3, cashbackRate: 0.01, bonusMultiplier: 1.05, color: "#C0C0C0", benefits: ["1% Cashback", "1.05x Bonus \xC7arpan\u0131", "Haftal\u0131k Bonus"] },
  { name: "gold", label: "Gold", minXp: 5e3, cashbackRate: 0.02, bonusMultiplier: 1.1, color: "#FFD700", benefits: ["2% Cashback", "1.10x Bonus \xC7arpan\u0131", "G\xFCnl\xFCk Bonus", "\xD6zel Promosyonlar"] },
  { name: "platinum", label: "Platinum", minXp: 15e3, cashbackRate: 0.035, bonusMultiplier: 1.2, color: "#E5E4E2", benefits: ["3.5% Cashback", "1.20x Bonus \xC7arpan\u0131", "VIP Destek", "Y\xFCksek Limitler"] },
  { name: "diamond", label: "Diamond", minXp: 5e4, cashbackRate: 0.05, bonusMultiplier: 1.35, color: "#B9F2FF", benefits: ["5% Cashback", "1.35x Bonus \xC7arpan\u0131", "Ki\u015Fisel Menajer", "Ayl\u0131k Hediyeler"] },
  { name: "elite", label: "VIP Elite", minXp: 15e4, cashbackRate: 0.08, bonusMultiplier: 1.5, color: "#FF4500", benefits: ["8% Cashback", "1.50x Bonus \xC7arpan\u0131", "Tam VIP Paket", "S\u0131n\u0131rs\u0131z Limitler", "Davet Etkinlikleri"] }
];
function getTierByXp(xp) {
  let tier = VIP_TIERS[0];
  for (const t2 of VIP_TIERS) {
    if (xp >= t2.minXp) tier = t2;
  }
  return tier;
}
function getNextTier(currentTierName) {
  const idx = VIP_TIERS.findIndex((t2) => t2.name === currentTierName);
  if (idx < 0 || idx >= VIP_TIERS.length - 1) return null;
  return VIP_TIERS[idx + 1];
}
async function getOrCreateVipProfile(userId) {
  const db = await getDb();
  if (!db) return null;
  const existing = await db.select().from(vipProfiles).where(eq(vipProfiles.userId, userId)).limit(1);
  if (existing.length > 0) return existing[0];
  await db.insert(vipProfiles).values({ userId });
  const created = await db.select().from(vipProfiles).where(eq(vipProfiles.userId, userId)).limit(1);
  return created[0] ?? null;
}
async function addVipXp(userId, xpAmount, wagerAmount) {
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
    ...tierChanged ? { lastTierUp: /* @__PURE__ */ new Date() } : {}
  }).where(eq(vipProfiles.userId, userId));
  return { ...profile, totalXp: newXp, currentTier: newTier.name, tierChanged, newTier };
}
async function getAllVipProfiles(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(vipProfiles).orderBy(desc(vipProfiles.totalXp)).limit(limit);
}
async function getActiveBanners(section) {
  const db = await getDb();
  if (!db) return [];
  const now = /* @__PURE__ */ new Date();
  return db.select().from(banners).where(
    and(
      eq(banners.isActive, 1),
      or(eq(banners.section, section), eq(banners.section, "both")),
      or(isNull(banners.startsAt), lte(banners.startsAt, now)),
      or(isNull(banners.endsAt), gte(banners.endsAt, now))
    )
  ).orderBy(asc(banners.sortOrder));
}
async function getAllBanners() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(banners).orderBy(asc(banners.sortOrder));
}
async function getBannerById(id) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(banners).where(eq(banners.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}
async function createBanner(data) {
  const db = await getDb();
  if (!db) return null;
  const [inserted] = await db.insert(banners).values(data).$returningId();
  return inserted.id;
}
async function updateBanner(id, data) {
  const db = await getDb();
  if (!db) return;
  await db.update(banners).set(data).where(eq(banners.id, id));
}
async function deleteBanner(id) {
  const db = await getDb();
  if (!db) return;
  await db.delete(banners).where(eq(banners.id, id));
}
async function reorderBanners(orderedIds) {
  const db = await getDb();
  if (!db) return;
  for (let i = 0; i < orderedIds.length; i++) {
    await db.update(banners).set({ sortOrder: i + 1 }).where(eq(banners.id, orderedIds[i]));
  }
}
async function getChatHistory(userId, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(chatMessages).where(eq(chatMessages.userId, userId)).orderBy(desc(chatMessages.createdAt)).limit(limit);
}
async function addChatMessage(userId, role, content) {
  const db = await getDb();
  if (!db) return;
  await db.insert(chatMessages).values({ userId, role, content });
}
async function clearChatHistory(userId) {
  const db = await getDb();
  if (!db) return;
  await db.delete(chatMessages).where(eq(chatMessages.userId, userId));
}
async function createWallet(userId, network, addressIndex, depositAddress) {
  const db = await getDb();
  if (!db) return null;
  const [inserted] = await db.insert(wallets).values({
    userId,
    network,
    addressIndex,
    depositAddress
  }).$returningId();
  return inserted.id;
}
async function getUserWallet(userId, network) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(wallets).where(and(eq(wallets.userId, userId), eq(wallets.network, network))).limit(1);
  return result.length > 0 ? result[0] : null;
}
async function getUserWallets(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(wallets).where(eq(wallets.userId, userId));
}
async function getNextAddressIndex() {
  const db = await getDb();
  if (!db) return 1;
  const result = await db.select({ maxIdx: sql`MAX(${wallets.addressIndex})` }).from(wallets);
  const max = result[0]?.maxIdx;
  return (typeof max === "number" ? max : 0) + 1;
}
async function updateWalletAddress(walletId, newAddressIndex, newAddress) {
  const db = await getDb();
  if (!db) return;
  await db.update(wallets).set({
    addressIndex: newAddressIndex,
    depositAddress: newAddress
  }).where(eq(wallets.id, walletId));
}
async function getActiveDepositAddresses(network) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(wallets).where(eq(wallets.network, network));
}
async function getUserCryptoDeposits(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(cryptoDeposits).where(eq(cryptoDeposits.userId, userId)).orderBy(desc(cryptoDeposits.createdAt));
}
async function getAllCryptoDeposits(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(cryptoDeposits).orderBy(desc(cryptoDeposits.createdAt)).limit(limit);
}
async function createWithdrawal(data) {
  const db = await getDb();
  if (!db) return null;
  const [inserted] = await db.insert(cryptoWithdrawals).values({
    userId: data.userId,
    network: data.network,
    toAddress: data.toAddress,
    amount: data.amount,
    fee: data.fee,
    tokenSymbol: data.tokenSymbol
  }).$returningId();
  return inserted.id;
}
async function updateWithdrawalStatus(id, status, txHash, reviewedBy, adminNote) {
  const db = await getDb();
  if (!db) return;
  const updateData = { status };
  if (txHash) updateData.txHash = txHash;
  if (reviewedBy) updateData.reviewedBy = reviewedBy;
  if (adminNote !== void 0) updateData.adminNote = adminNote;
  if (status === "completed" || status === "rejected" || status === "failed") {
    updateData.processedAt = /* @__PURE__ */ new Date();
  }
  await db.update(cryptoWithdrawals).set(updateData).where(eq(cryptoWithdrawals.id, id));
}
async function getWithdrawalById(id) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(cryptoWithdrawals).where(eq(cryptoWithdrawals.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}
async function getPendingWithdrawals() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(cryptoWithdrawals).where(eq(cryptoWithdrawals.status, "pending")).orderBy(desc(cryptoWithdrawals.createdAt));
}
async function getUserWithdrawals(userId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(cryptoWithdrawals).where(eq(cryptoWithdrawals.userId, userId)).orderBy(desc(cryptoWithdrawals.createdAt));
}
async function atomicDeductBalance(userId, totalCost, description) {
  const db = await getDb();
  if (!db) return { success: false, error: "DB unavailable" };
  try {
    await db.transaction(async (tx) => {
      const bal = await tx.select().from(balances).where(eq(balances.userId, userId)).for("update").limit(1);
      if (!bal.length || parseFloat(bal[0].amount) < totalCost) {
        throw new Error("Yetersiz bakiye");
      }
      await tx.update(balances).set({ amount: sql`amount - ${totalCost.toFixed(2)}` }).where(eq(balances.userId, userId));
      await tx.insert(transactions).values({
        userId,
        type: "withdraw",
        amount: totalCost.toFixed(2),
        description
      });
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message || "Transaction failed" };
  }
}
async function getUserDailyWithdrawalTotal(userId) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ total: sql`COALESCE(SUM(amount), 0)` }).from(cryptoWithdrawals).where(and(
    eq(cryptoWithdrawals.userId, userId),
    gte(cryptoWithdrawals.createdAt, sql`DATE_SUB(NOW(), INTERVAL 24 HOUR)`),
    // Count all non-rejected withdrawals
    sql`${cryptoWithdrawals.status} != 'rejected'`,
    sql`${cryptoWithdrawals.status} != 'failed'`
  ));
  return parseFloat(result[0]?.total || "0");
}
async function getAllWithdrawals(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(cryptoWithdrawals).orderBy(desc(cryptoWithdrawals.createdAt)).limit(limit);
}

// server/_core/sdk.ts
var isNonEmptyString2 = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    if (ENV.oAuthServerUrl) {
      console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    } else {
      console.log("[OAuth] OAUTH_SERVER_URL not configured. Use /dev-login for local development.");
    }
  }
  decodeState(state) {
    const redirectUri = atob(state);
    return redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString2(openId) || !isNonEmptyString2(appId) || !isNonEmptyString2(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var sdk = new SDKServer();

// server/_core/password.ts
import { randomBytes, pbkdf2Sync } from "crypto";
var ITERATIONS = 1e5;
var KEY_LENGTH = 64;
var DIGEST = "sha512";
function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString("hex");
  return `${salt}:${hash}`;
}
function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const verify = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString("hex");
  return hash === verify;
}

// server/routers.ts
import { z as z2 } from "zod";

// server/oddsApi.ts
import axios2 from "axios";
var BASE_URL = "https://api.the-odds-api.com/v4";
function apiKey() {
  return ENV.theOddsApiKey;
}
async function fetchSports() {
  const { data } = await axios2.get(`${BASE_URL}/sports`, {
    params: { apiKey: apiKey() }
  });
  return data;
}
async function fetchOdds(sportKey, markets = "h2h,spreads,totals", regions = "us,eu,uk") {
  const { data } = await axios2.get(`${BASE_URL}/sports/${sportKey}/odds`, {
    params: {
      apiKey: apiKey(),
      regions,
      markets,
      oddsFormat: "decimal"
    }
  });
  return data;
}
async function fetchScores(sportKey, daysFrom = 3) {
  const { data } = await axios2.get(`${BASE_URL}/sports/${sportKey}/scores`, {
    params: {
      apiKey: apiKey(),
      daysFrom
    }
  });
  return data;
}

// server/demoData.ts
function hoursFromNow(h) {
  return new Date(Date.now() + h * 36e5).toISOString();
}
function minutesAgo(m) {
  return new Date(Date.now() - m * 6e4).toISOString();
}
function makeBookmaker(markets) {
  return [
    {
      key: "dopamin",
      title: "Dopamin",
      last_update: (/* @__PURE__ */ new Date()).toISOString(),
      markets: markets.map((m) => ({
        key: m.key,
        last_update: (/* @__PURE__ */ new Date()).toISOString(),
        outcomes: m.outcomes
      }))
    }
  ];
}
function getDemoSports() {
  return [
    // Futbol
    { id: 1, sportKey: "soccer_turkey_super_league", groupName: "Soccer", title: "T\xFCrkiye S\xFCper Lig", description: "T\xFCrkiye birinci futbol ligi", active: 1, hasOutrights: 0, updatedAt: /* @__PURE__ */ new Date() },
    { id: 2, sportKey: "soccer_epl", groupName: "Soccer", title: "\u0130ngiltere Premier Lig", description: "\u0130ngiltere birinci futbol ligi", active: 1, hasOutrights: 0, updatedAt: /* @__PURE__ */ new Date() },
    { id: 3, sportKey: "soccer_spain_la_liga", groupName: "Soccer", title: "\u0130spanya La Liga", description: "\u0130spanya birinci futbol ligi", active: 1, hasOutrights: 0, updatedAt: /* @__PURE__ */ new Date() },
    { id: 4, sportKey: "soccer_germany_bundesliga", groupName: "Soccer", title: "Almanya Bundesliga", description: "Almanya birinci futbol ligi", active: 1, hasOutrights: 0, updatedAt: /* @__PURE__ */ new Date() },
    { id: 5, sportKey: "soccer_italy_serie_a", groupName: "Soccer", title: "\u0130talya Serie A", description: "\u0130talya birinci futbol ligi", active: 1, hasOutrights: 0, updatedAt: /* @__PURE__ */ new Date() },
    { id: 6, sportKey: "soccer_uefa_champs_league", groupName: "Soccer", title: "UEFA \u015Eampiyonlar Ligi", description: "Avrupa kul\xFCpler aras\u0131 \u015Fampiyonas\u0131", active: 1, hasOutrights: 0, updatedAt: /* @__PURE__ */ new Date() },
    { id: 7, sportKey: "soccer_france_ligue_one", groupName: "Soccer", title: "Fransa Ligue 1", description: "Fransa birinci futbol ligi", active: 1, hasOutrights: 0, updatedAt: /* @__PURE__ */ new Date() },
    // Basketbol
    { id: 8, sportKey: "basketball_nba", groupName: "Basketball", title: "NBA", description: "Amerika Ulusal Basketbol Ligi", active: 1, hasOutrights: 0, updatedAt: /* @__PURE__ */ new Date() },
    { id: 9, sportKey: "basketball_euroleague", groupName: "Basketball", title: "EuroLeague", description: "Avrupa Basketbol Ligi", active: 1, hasOutrights: 0, updatedAt: /* @__PURE__ */ new Date() },
    { id: 10, sportKey: "basketball_turkey_bsl", groupName: "Basketball", title: "T\xFCrkiye BSL", description: "T\xFCrkiye Basketbol S\xFCper Ligi", active: 1, hasOutrights: 0, updatedAt: /* @__PURE__ */ new Date() },
    // Tenis
    { id: 11, sportKey: "tennis_atp_aus_open", groupName: "Tennis", title: "ATP Avustralya A\xE7\u0131k", description: "Grand Slam turnuvas\u0131", active: 1, hasOutrights: 0, updatedAt: /* @__PURE__ */ new Date() },
    { id: 12, sportKey: "tennis_wta_aus_open", groupName: "Tennis", title: "WTA Avustralya A\xE7\u0131k", description: "Kad\u0131nlar Grand Slam turnuvas\u0131", active: 1, hasOutrights: 0, updatedAt: /* @__PURE__ */ new Date() },
    // Amerikan Futbolu
    { id: 13, sportKey: "americanfootball_nfl", groupName: "American Football", title: "NFL", description: "Amerika Ulusal Futbol Ligi", active: 1, hasOutrights: 0, updatedAt: /* @__PURE__ */ new Date() },
    // Buz Hokeyi
    { id: 14, sportKey: "icehockey_nhl", groupName: "Ice Hockey", title: "NHL", description: "Amerika Ulusal Hokey Ligi", active: 1, hasOutrights: 0, updatedAt: /* @__PURE__ */ new Date() },
    // MMA
    { id: 15, sportKey: "mma_mixed_martial_arts", groupName: "Mixed Martial Arts", title: "UFC / MMA", description: "Karma d\xF6v\xFC\u015F sanatlar\u0131", active: 1, hasOutrights: 0, updatedAt: /* @__PURE__ */ new Date() },
    // E-Spor
    { id: 16, sportKey: "esports_lol", groupName: "Esports", title: "League of Legends", description: "LoL e-spor m\xFCsabakalar\u0131", active: 1, hasOutrights: 0, updatedAt: /* @__PURE__ */ new Date() },
    { id: 17, sportKey: "esports_csgo", groupName: "Esports", title: "CS2", description: "Counter-Strike 2 m\xFCsabakalar\u0131", active: 1, hasOutrights: 0, updatedAt: /* @__PURE__ */ new Date() }
  ];
}
function getDemoEvents(sportKey) {
  const events = {
    // ── Süper Lig ──
    soccer_turkey_super_league: [
      {
        id: "demo_tsl_1",
        sport_key: "soccer_turkey_super_league",
        sport_title: "T\xFCrkiye S\xFCper Lig",
        commence_time: hoursFromNow(3),
        home_team: "Galatasaray",
        away_team: "Fenerbah\xE7e",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Galatasaray", price: 2.15 }, { name: "Draw", price: 3.4 }, { name: "Fenerbah\xE7e", price: 3.1 }] },
          { key: "spreads", outcomes: [{ name: "Galatasaray", price: 1.9, point: -0.5 }, { name: "Fenerbah\xE7e", price: 1.95, point: 0.5 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.85, point: 2.5 }, { name: "Under", price: 1.95, point: 2.5 }] }
        ])
      },
      {
        id: "demo_tsl_2",
        sport_key: "soccer_turkey_super_league",
        sport_title: "T\xFCrkiye S\xFCper Lig",
        commence_time: hoursFromNow(6),
        home_team: "Be\u015Fikta\u015F",
        away_team: "Trabzonspor",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Be\u015Fikta\u015F", price: 1.85 }, { name: "Draw", price: 3.5 }, { name: "Trabzonspor", price: 4.2 }] },
          { key: "spreads", outcomes: [{ name: "Be\u015Fikta\u015F", price: 1.88, point: -1 }, { name: "Trabzonspor", price: 1.97, point: 1 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.92, point: 2.5 }, { name: "Under", price: 1.88, point: 2.5 }] }
        ])
      },
      {
        id: "demo_tsl_3",
        sport_key: "soccer_turkey_super_league",
        sport_title: "T\xFCrkiye S\xFCper Lig",
        commence_time: hoursFromNow(26),
        home_team: "Ba\u015Fak\u015Fehir",
        away_team: "Adana Demirspor",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Ba\u015Fak\u015Fehir", price: 1.7 }, { name: "Draw", price: 3.6 }, { name: "Adana Demirspor", price: 5 }] },
          { key: "spreads", outcomes: [{ name: "Ba\u015Fak\u015Fehir", price: 1.92, point: -1.5 }, { name: "Adana Demirspor", price: 1.92, point: 1.5 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.8, point: 2.5 }, { name: "Under", price: 2, point: 2.5 }] }
        ])
      },
      {
        id: "demo_tsl_4",
        sport_key: "soccer_turkey_super_league",
        sport_title: "T\xFCrkiye S\xFCper Lig",
        commence_time: hoursFromNow(28),
        home_team: "Samsunspor",
        away_team: "Kayserispor",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Samsunspor", price: 2.1 }, { name: "Draw", price: 3.3 }, { name: "Kayserispor", price: 3.5 }] },
          { key: "spreads", outcomes: [{ name: "Samsunspor", price: 1.85, point: -0.5 }, { name: "Kayserispor", price: 2, point: 0.5 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 2.1, point: 2.5 }, { name: "Under", price: 1.75, point: 2.5 }] }
        ])
      },
      {
        id: "demo_tsl_5",
        sport_key: "soccer_turkey_super_league",
        sport_title: "T\xFCrkiye S\xFCper Lig",
        commence_time: hoursFromNow(50),
        home_team: "Antalyaspor",
        away_team: "Sivasspor",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Antalyaspor", price: 2.4 }, { name: "Draw", price: 3.2 }, { name: "Sivasspor", price: 3 }] },
          { key: "spreads", outcomes: [{ name: "Antalyaspor", price: 1.95, point: -0.5 }, { name: "Sivasspor", price: 1.9, point: 0.5 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.9, point: 2 }, { name: "Under", price: 1.9, point: 2 }] }
        ])
      }
    ],
    // ── Premier Lig ──
    soccer_epl: [
      {
        id: "demo_epl_1",
        sport_key: "soccer_epl",
        sport_title: "\u0130ngiltere Premier Lig",
        commence_time: hoursFromNow(5),
        home_team: "Arsenal",
        away_team: "Manchester City",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Arsenal", price: 2.3 }, { name: "Draw", price: 3.4 }, { name: "Manchester City", price: 2.9 }] },
          { key: "spreads", outcomes: [{ name: "Arsenal", price: 1.92, point: -0.5 }, { name: "Manchester City", price: 1.92, point: 0.5 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.85, point: 2.5 }, { name: "Under", price: 1.95, point: 2.5 }] }
        ])
      },
      {
        id: "demo_epl_2",
        sport_key: "soccer_epl",
        sport_title: "\u0130ngiltere Premier Lig",
        commence_time: hoursFromNow(8),
        home_team: "Liverpool",
        away_team: "Chelsea",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Liverpool", price: 1.75 }, { name: "Draw", price: 3.8 }, { name: "Chelsea", price: 4.5 }] },
          { key: "spreads", outcomes: [{ name: "Liverpool", price: 1.85, point: -1 }, { name: "Chelsea", price: 2, point: 1 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.8, point: 3 }, { name: "Under", price: 2, point: 3 }] }
        ])
      },
      {
        id: "demo_epl_3",
        sport_key: "soccer_epl",
        sport_title: "\u0130ngiltere Premier Lig",
        commence_time: hoursFromNow(30),
        home_team: "Manchester United",
        away_team: "Tottenham",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Manchester United", price: 2.5 }, { name: "Draw", price: 3.3 }, { name: "Tottenham", price: 2.8 }] },
          { key: "spreads", outcomes: [{ name: "Manchester United", price: 1.9, point: -0.5 }, { name: "Tottenham", price: 1.95, point: 0.5 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.75, point: 2.5 }, { name: "Under", price: 2.1, point: 2.5 }] }
        ])
      },
      {
        id: "demo_epl_4",
        sport_key: "soccer_epl",
        sport_title: "\u0130ngiltere Premier Lig",
        commence_time: hoursFromNow(52),
        home_team: "Aston Villa",
        away_team: "Newcastle",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Aston Villa", price: 2.2 }, { name: "Draw", price: 3.4 }, { name: "Newcastle", price: 3.2 }] },
          { key: "spreads", outcomes: [{ name: "Aston Villa", price: 1.88, point: -0.5 }, { name: "Newcastle", price: 1.97, point: 0.5 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.87, point: 2.5 }, { name: "Under", price: 1.93, point: 2.5 }] }
        ])
      }
    ],
    // ── La Liga ──
    soccer_spain_la_liga: [
      {
        id: "demo_liga_1",
        sport_key: "soccer_spain_la_liga",
        sport_title: "\u0130spanya La Liga",
        commence_time: hoursFromNow(4),
        home_team: "Real Madrid",
        away_team: "Barcelona",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Real Madrid", price: 2.4 }, { name: "Draw", price: 3.5 }, { name: "Barcelona", price: 2.7 }] },
          { key: "spreads", outcomes: [{ name: "Real Madrid", price: 1.9, point: -0.5 }, { name: "Barcelona", price: 1.95, point: 0.5 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.7, point: 2.5 }, { name: "Under", price: 2.15, point: 2.5 }] }
        ])
      },
      {
        id: "demo_liga_2",
        sport_key: "soccer_spain_la_liga",
        sport_title: "\u0130spanya La Liga",
        commence_time: hoursFromNow(24),
        home_team: "Atletico Madrid",
        away_team: "Sevilla",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Atletico Madrid", price: 1.65 }, { name: "Draw", price: 3.8 }, { name: "Sevilla", price: 5.5 }] },
          { key: "spreads", outcomes: [{ name: "Atletico Madrid", price: 1.92, point: -1.5 }, { name: "Sevilla", price: 1.92, point: 1.5 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 2, point: 2.5 }, { name: "Under", price: 1.82, point: 2.5 }] }
        ])
      }
    ],
    // ── Bundesliga ──
    soccer_germany_bundesliga: [
      {
        id: "demo_bun_1",
        sport_key: "soccer_germany_bundesliga",
        sport_title: "Almanya Bundesliga",
        commence_time: hoursFromNow(7),
        home_team: "Bayern M\xFCnchen",
        away_team: "Borussia Dortmund",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Bayern M\xFCnchen", price: 1.55 }, { name: "Draw", price: 4.2 }, { name: "Borussia Dortmund", price: 5.5 }] },
          { key: "spreads", outcomes: [{ name: "Bayern M\xFCnchen", price: 1.85, point: -1.5 }, { name: "Borussia Dortmund", price: 2, point: 1.5 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.65, point: 3 }, { name: "Under", price: 2.25, point: 3 }] }
        ])
      },
      {
        id: "demo_bun_2",
        sport_key: "soccer_germany_bundesliga",
        sport_title: "Almanya Bundesliga",
        commence_time: hoursFromNow(30),
        home_team: "RB Leipzig",
        away_team: "Bayer Leverkusen",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "RB Leipzig", price: 2.6 }, { name: "Draw", price: 3.4 }, { name: "Bayer Leverkusen", price: 2.6 }] },
          { key: "spreads", outcomes: [{ name: "RB Leipzig", price: 1.92, point: -0.5 }, { name: "Bayer Leverkusen", price: 1.92, point: 0.5 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.75, point: 2.5 }, { name: "Under", price: 2.1, point: 2.5 }] }
        ])
      }
    ],
    // ── Serie A ──
    soccer_italy_serie_a: [
      {
        id: "demo_ser_1",
        sport_key: "soccer_italy_serie_a",
        sport_title: "\u0130talya Serie A",
        commence_time: hoursFromNow(5),
        home_team: "Inter Milan",
        away_team: "AC Milan",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Inter Milan", price: 1.8 }, { name: "Draw", price: 3.6 }, { name: "AC Milan", price: 4.3 }] },
          { key: "spreads", outcomes: [{ name: "Inter Milan", price: 1.87, point: -1 }, { name: "AC Milan", price: 1.97, point: 1 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.92, point: 2.5 }, { name: "Under", price: 1.88, point: 2.5 }] }
        ])
      },
      {
        id: "demo_ser_2",
        sport_key: "soccer_italy_serie_a",
        sport_title: "\u0130talya Serie A",
        commence_time: hoursFromNow(28),
        home_team: "Juventus",
        away_team: "Napoli",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Juventus", price: 2.25 }, { name: "Draw", price: 3.3 }, { name: "Napoli", price: 3.1 }] },
          { key: "spreads", outcomes: [{ name: "Juventus", price: 1.9, point: -0.5 }, { name: "Napoli", price: 1.95, point: 0.5 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 2.05, point: 2.5 }, { name: "Under", price: 1.8, point: 2.5 }] }
        ])
      }
    ],
    // ── Champions League ──
    soccer_uefa_champs_league: [
      {
        id: "demo_ucl_1",
        sport_key: "soccer_uefa_champs_league",
        sport_title: "UEFA \u015Eampiyonlar Ligi",
        commence_time: hoursFromNow(10),
        home_team: "Real Madrid",
        away_team: "Bayern M\xFCnchen",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Real Madrid", price: 2.35 }, { name: "Draw", price: 3.4 }, { name: "Bayern M\xFCnchen", price: 2.9 }] },
          { key: "spreads", outcomes: [{ name: "Real Madrid", price: 1.9, point: -0.5 }, { name: "Bayern M\xFCnchen", price: 1.95, point: 0.5 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.72, point: 2.5 }, { name: "Under", price: 2.15, point: 2.5 }] }
        ])
      },
      {
        id: "demo_ucl_2",
        sport_key: "soccer_uefa_champs_league",
        sport_title: "UEFA \u015Eampiyonlar Ligi",
        commence_time: hoursFromNow(10),
        home_team: "Manchester City",
        away_team: "Paris Saint-Germain",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Manchester City", price: 1.7 }, { name: "Draw", price: 3.8 }, { name: "Paris Saint-Germain", price: 4.8 }] },
          { key: "spreads", outcomes: [{ name: "Manchester City", price: 1.85, point: -1 }, { name: "Paris Saint-Germain", price: 2, point: 1 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.8, point: 2.5 }, { name: "Under", price: 2, point: 2.5 }] }
        ])
      }
    ],
    // ── Ligue 1 ──
    soccer_france_ligue_one: [
      {
        id: "demo_l1_1",
        sport_key: "soccer_france_ligue_one",
        sport_title: "Fransa Ligue 1",
        commence_time: hoursFromNow(9),
        home_team: "Paris Saint-Germain",
        away_team: "Olympique Marseille",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Paris Saint-Germain", price: 1.4 }, { name: "Draw", price: 4.8 }, { name: "Olympique Marseille", price: 7.5 }] },
          { key: "spreads", outcomes: [{ name: "Paris Saint-Germain", price: 1.9, point: -2 }, { name: "Olympique Marseille", price: 1.95, point: 2 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.65, point: 3 }, { name: "Under", price: 2.25, point: 3 }] }
        ])
      }
    ],
    // ── NBA ──
    basketball_nba: [
      {
        id: "demo_nba_1",
        sport_key: "basketball_nba",
        sport_title: "NBA",
        commence_time: hoursFromNow(4),
        home_team: "Los Angeles Lakers",
        away_team: "Boston Celtics",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Los Angeles Lakers", price: 2.1 }, { name: "Boston Celtics", price: 1.75 }] },
          { key: "spreads", outcomes: [{ name: "Los Angeles Lakers", price: 1.91, point: 3.5 }, { name: "Boston Celtics", price: 1.91, point: -3.5 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.9, point: 224.5 }, { name: "Under", price: 1.9, point: 224.5 }] }
        ])
      },
      {
        id: "demo_nba_2",
        sport_key: "basketball_nba",
        sport_title: "NBA",
        commence_time: hoursFromNow(7),
        home_team: "Golden State Warriors",
        away_team: "Milwaukee Bucks",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Golden State Warriors", price: 1.95 }, { name: "Milwaukee Bucks", price: 1.87 }] },
          { key: "spreads", outcomes: [{ name: "Golden State Warriors", price: 1.92, point: 1.5 }, { name: "Milwaukee Bucks", price: 1.92, point: -1.5 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.85, point: 230.5 }, { name: "Under", price: 1.95, point: 230.5 }] }
        ])
      },
      {
        id: "demo_nba_3",
        sport_key: "basketball_nba",
        sport_title: "NBA",
        commence_time: hoursFromNow(28),
        home_team: "Phoenix Suns",
        away_team: "Denver Nuggets",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Phoenix Suns", price: 2.25 }, { name: "Denver Nuggets", price: 1.65 }] },
          { key: "spreads", outcomes: [{ name: "Phoenix Suns", price: 1.9, point: 4.5 }, { name: "Denver Nuggets", price: 1.9, point: -4.5 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.92, point: 221.5 }, { name: "Under", price: 1.88, point: 221.5 }] }
        ])
      }
    ],
    // ── EuroLeague ──
    basketball_euroleague: [
      {
        id: "demo_el_1",
        sport_key: "basketball_euroleague",
        sport_title: "EuroLeague",
        commence_time: hoursFromNow(6),
        home_team: "Fenerbah\xE7e Beko",
        away_team: "Real Madrid",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Fenerbah\xE7e Beko", price: 1.85 }, { name: "Real Madrid", price: 1.95 }] },
          { key: "spreads", outcomes: [{ name: "Fenerbah\xE7e Beko", price: 1.9, point: -2.5 }, { name: "Real Madrid", price: 1.9, point: 2.5 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.88, point: 162.5 }, { name: "Under", price: 1.92, point: 162.5 }] }
        ])
      },
      {
        id: "demo_el_2",
        sport_key: "basketball_euroleague",
        sport_title: "EuroLeague",
        commence_time: hoursFromNow(24),
        home_team: "Anadolu Efes",
        away_team: "Barcelona",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Anadolu Efes", price: 2.3 }, { name: "Barcelona", price: 1.6 }] },
          { key: "spreads", outcomes: [{ name: "Anadolu Efes", price: 1.92, point: 5.5 }, { name: "Barcelona", price: 1.92, point: -5.5 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.85, point: 158.5 }, { name: "Under", price: 1.95, point: 158.5 }] }
        ])
      }
    ],
    // ── Türkiye BSL ──
    basketball_turkey_bsl: [
      {
        id: "demo_bsl_1",
        sport_key: "basketball_turkey_bsl",
        sport_title: "T\xFCrkiye BSL",
        commence_time: hoursFromNow(5),
        home_team: "Galatasaray Nef",
        away_team: "Be\u015Fikta\u015F Emlakjet",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Galatasaray Nef", price: 1.5 }, { name: "Be\u015Fikta\u015F Emlakjet", price: 2.55 }] },
          { key: "spreads", outcomes: [{ name: "Galatasaray Nef", price: 1.9, point: -6.5 }, { name: "Be\u015Fikta\u015F Emlakjet", price: 1.9, point: 6.5 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.87, point: 155.5 }, { name: "Under", price: 1.93, point: 155.5 }] }
        ])
      }
    ],
    // ── Tenis ──
    tennis_atp_aus_open: [
      {
        id: "demo_atp_1",
        sport_key: "tennis_atp_aus_open",
        sport_title: "ATP Avustralya A\xE7\u0131k",
        commence_time: hoursFromNow(3),
        home_team: "Novak Djokovic",
        away_team: "Carlos Alcaraz",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Novak Djokovic", price: 1.9 }, { name: "Carlos Alcaraz", price: 1.9 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.85, point: 38.5 }, { name: "Under", price: 1.95, point: 38.5 }] }
        ])
      },
      {
        id: "demo_atp_2",
        sport_key: "tennis_atp_aus_open",
        sport_title: "ATP Avustralya A\xE7\u0131k",
        commence_time: hoursFromNow(8),
        home_team: "Jannik Sinner",
        away_team: "Daniil Medvedev",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Jannik Sinner", price: 1.55 }, { name: "Daniil Medvedev", price: 2.45 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.9, point: 36.5 }, { name: "Under", price: 1.9, point: 36.5 }] }
        ])
      }
    ],
    tennis_wta_aus_open: [
      {
        id: "demo_wta_1",
        sport_key: "tennis_wta_aus_open",
        sport_title: "WTA Avustralya A\xE7\u0131k",
        commence_time: hoursFromNow(4),
        home_team: "Aryna Sabalenka",
        away_team: "Iga Swiatek",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Aryna Sabalenka", price: 1.75 }, { name: "Iga Swiatek", price: 2.1 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.88, point: 21.5 }, { name: "Under", price: 1.92, point: 21.5 }] }
        ])
      }
    ],
    // ── NFL ──
    americanfootball_nfl: [
      {
        id: "demo_nfl_1",
        sport_key: "americanfootball_nfl",
        sport_title: "NFL",
        commence_time: hoursFromNow(24),
        home_team: "Kansas City Chiefs",
        away_team: "Philadelphia Eagles",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Kansas City Chiefs", price: 1.8 }, { name: "Philadelphia Eagles", price: 2.05 }] },
          { key: "spreads", outcomes: [{ name: "Kansas City Chiefs", price: 1.91, point: -2.5 }, { name: "Philadelphia Eagles", price: 1.91, point: 2.5 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.87, point: 48.5 }, { name: "Under", price: 1.93, point: 48.5 }] }
        ])
      },
      {
        id: "demo_nfl_2",
        sport_key: "americanfootball_nfl",
        sport_title: "NFL",
        commence_time: hoursFromNow(48),
        home_team: "San Francisco 49ers",
        away_team: "Dallas Cowboys",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "San Francisco 49ers", price: 1.6 }, { name: "Dallas Cowboys", price: 2.35 }] },
          { key: "spreads", outcomes: [{ name: "San Francisco 49ers", price: 1.92, point: -4.5 }, { name: "Dallas Cowboys", price: 1.92, point: 4.5 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.9, point: 46.5 }, { name: "Under", price: 1.9, point: 46.5 }] }
        ])
      }
    ],
    // ── NHL ──
    icehockey_nhl: [
      {
        id: "demo_nhl_1",
        sport_key: "icehockey_nhl",
        sport_title: "NHL",
        commence_time: hoursFromNow(6),
        home_team: "Toronto Maple Leafs",
        away_team: "Montreal Canadiens",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Toronto Maple Leafs", price: 1.65 }, { name: "Montreal Canadiens", price: 2.25 }] },
          { key: "spreads", outcomes: [{ name: "Toronto Maple Leafs", price: 1.9, point: -1.5 }, { name: "Montreal Canadiens", price: 1.9, point: 1.5 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.88, point: 6 }, { name: "Under", price: 1.92, point: 6 }] }
        ])
      }
    ],
    // ── MMA ──
    mma_mixed_martial_arts: [
      {
        id: "demo_mma_1",
        sport_key: "mma_mixed_martial_arts",
        sport_title: "UFC / MMA",
        commence_time: hoursFromNow(48),
        home_team: "Islam Makhachev",
        away_team: "Charles Oliveira",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Islam Makhachev", price: 1.45 }, { name: "Charles Oliveira", price: 2.8 }] }
        ])
      },
      {
        id: "demo_mma_2",
        sport_key: "mma_mixed_martial_arts",
        sport_title: "UFC / MMA",
        commence_time: hoursFromNow(48),
        home_team: "Alex Pereira",
        away_team: "Ji\u0159\xED Proch\xE1zka",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Alex Pereira", price: 1.55 }, { name: "Ji\u0159\xED Proch\xE1zka", price: 2.45 }] }
        ])
      }
    ],
    // ── Esports ──
    esports_lol: [
      {
        id: "demo_lol_1",
        sport_key: "esports_lol",
        sport_title: "League of Legends",
        commence_time: hoursFromNow(3),
        home_team: "T1",
        away_team: "Gen.G",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "T1", price: 1.8 }, { name: "Gen.G", price: 2 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.85, point: 2.5 }, { name: "Under", price: 1.95, point: 2.5 }] }
        ])
      }
    ],
    esports_csgo: [
      {
        id: "demo_cs_1",
        sport_key: "esports_csgo",
        sport_title: "CS2",
        commence_time: hoursFromNow(5),
        home_team: "NAVI",
        away_team: "FaZe Clan",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "NAVI", price: 1.7 }, { name: "FaZe Clan", price: 2.15 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.9, point: 2.5 }, { name: "Under", price: 1.9, point: 2.5 }] }
        ])
      }
    ]
  };
  return events[sportKey] || [];
}
function getDemoLiveEvents() {
  return [
    // Live matches (currently playing)
    {
      eventId: "demo_live_1",
      sportKey: "soccer_turkey_super_league",
      homeTeam: "Galatasaray",
      awayTeam: "Be\u015Fikta\u015F",
      homeScore: 2,
      awayScore: 1,
      isLive: 1,
      completed: 0,
      commenceTime: minutesAgo(65),
      scoresJson: [{ name: "Galatasaray", score: "2" }, { name: "Be\u015Fikta\u015F", score: "1" }]
    },
    {
      eventId: "demo_live_2",
      sportKey: "soccer_epl",
      homeTeam: "Arsenal",
      awayTeam: "Liverpool",
      homeScore: 1,
      awayScore: 1,
      isLive: 1,
      completed: 0,
      commenceTime: minutesAgo(38),
      scoresJson: [{ name: "Arsenal", score: "1" }, { name: "Liverpool", score: "1" }]
    },
    {
      eventId: "demo_live_3",
      sportKey: "basketball_nba",
      homeTeam: "Los Angeles Lakers",
      awayTeam: "Golden State Warriors",
      homeScore: 78,
      awayScore: 82,
      isLive: 1,
      completed: 0,
      commenceTime: minutesAgo(90),
      scoresJson: [{ name: "Los Angeles Lakers", score: "78" }, { name: "Golden State Warriors", score: "82" }]
    },
    {
      eventId: "demo_live_4",
      sportKey: "basketball_euroleague",
      homeTeam: "Fenerbah\xE7e Beko",
      awayTeam: "Olympiacos",
      homeScore: 45,
      awayScore: 42,
      isLive: 1,
      completed: 0,
      commenceTime: minutesAgo(50),
      scoresJson: [{ name: "Fenerbah\xE7e Beko", score: "45" }, { name: "Olympiacos", score: "42" }]
    },
    {
      eventId: "demo_live_5",
      sportKey: "soccer_spain_la_liga",
      homeTeam: "Real Madrid",
      away_team: "Valencia",
      homeScore: 3,
      awayScore: 0,
      isLive: 1,
      completed: 0,
      commenceTime: minutesAgo(72),
      scoresJson: [{ name: "Real Madrid", score: "3" }, { name: "Valencia", score: "0" }]
    },
    // In-progress (started but not marked live yet)
    {
      eventId: "demo_prog_1",
      sportKey: "soccer_germany_bundesliga",
      homeTeam: "Bayern M\xFCnchen",
      awayTeam: "Wolfsburg",
      homeScore: 1,
      awayScore: 0,
      isLive: 0,
      completed: 0,
      commenceTime: minutesAgo(25),
      scoresJson: [{ name: "Bayern M\xFCnchen", score: "1" }, { name: "Wolfsburg", score: "0" }]
    },
    {
      eventId: "demo_prog_2",
      sportKey: "icehockey_nhl",
      homeTeam: "Toronto Maple Leafs",
      awayTeam: "New York Rangers",
      homeScore: 2,
      awayScore: 3,
      isLive: 0,
      completed: 0,
      commenceTime: minutesAgo(100),
      scoresJson: [{ name: "Toronto Maple Leafs", score: "2" }, { name: "New York Rangers", score: "3" }]
    },
    // Completed matches
    {
      eventId: "demo_done_1",
      sportKey: "soccer_turkey_super_league",
      homeTeam: "Fenerbah\xE7e",
      awayTeam: "Trabzonspor",
      homeScore: 3,
      awayScore: 1,
      isLive: 0,
      completed: 1,
      commenceTime: minutesAgo(150),
      scoresJson: [{ name: "Fenerbah\xE7e", score: "3" }, { name: "Trabzonspor", score: "1" }]
    },
    {
      eventId: "demo_done_2",
      sportKey: "basketball_nba",
      homeTeam: "Boston Celtics",
      awayTeam: "Miami Heat",
      homeScore: 112,
      awayScore: 98,
      isLive: 0,
      completed: 1,
      commenceTime: minutesAgo(180),
      scoresJson: [{ name: "Boston Celtics", score: "112" }, { name: "Miami Heat", score: "98" }]
    },
    {
      eventId: "demo_done_3",
      sportKey: "soccer_epl",
      homeTeam: "Manchester City",
      awayTeam: "Tottenham",
      homeScore: 2,
      awayScore: 2,
      isLive: 0,
      completed: 1,
      commenceTime: minutesAgo(200),
      scoresJson: [{ name: "Manchester City", score: "2" }, { name: "Tottenham", score: "2" }]
    },
    {
      eventId: "demo_done_4",
      sportKey: "soccer_italy_serie_a",
      homeTeam: "AC Milan",
      awayTeam: "Roma",
      homeScore: 1,
      awayScore: 0,
      isLive: 0,
      completed: 1,
      commenceTime: minutesAgo(160),
      scoresJson: [{ name: "AC Milan", score: "1" }, { name: "Roma", score: "0" }]
    }
  ];
}
function getDemoLiveEventsClean() {
  return getDemoLiveEvents().map((e) => ({
    eventId: e.eventId,
    sportKey: e.sportKey,
    homeTeam: e.homeTeam,
    awayTeam: e.awayTeam || e.away_team,
    homeScore: e.homeScore,
    awayScore: e.awayScore,
    isLive: e.isLive,
    completed: e.completed,
    commenceTime: e.commenceTime,
    scoresJson: e.scoresJson
  }));
}

// server/lib/wallet/hdDerivation.ts
import * as bip39 from "bip39";
import { createHash } from "crypto";
function getMnemonic() {
  const mnemonic = process.env.WALLET_MNEMONIC;
  if (!mnemonic) throw new Error("WALLET_MNEMONIC not set in environment");
  if (!bip39.validateMnemonic(mnemonic)) throw new Error("Invalid WALLET_MNEMONIC");
  return mnemonic;
}
async function getSeedBuffer() {
  return bip39.mnemonicToSeed(getMnemonic());
}
async function deriveEvmAddress(userIndex) {
  const { ethers } = await import("ethers");
  const mnemonic = getMnemonic();
  const path = `m/44'/60'/${userIndex}'/0/0`;
  const wallet = ethers.HDNodeWallet.fromMnemonic(ethers.Mnemonic.fromPhrase(mnemonic), path);
  return { address: wallet.address, path };
}
async function getEvmPrivateKey(userIndex) {
  const { ethers } = await import("ethers");
  const mnemonic = getMnemonic();
  const path = `m/44'/60'/${userIndex}'/0/0`;
  const wallet = ethers.HDNodeWallet.fromMnemonic(ethers.Mnemonic.fromPhrase(mnemonic), path);
  return wallet.privateKey;
}
function base58Encode(buffer) {
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const digits = [0];
  for (let i = 0; i < buffer.length; i++) {
    let carry = buffer[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = carry / 58 | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = carry / 58 | 0;
    }
  }
  let result = "";
  for (let i = 0; i < buffer.length && buffer[i] === 0; i++) {
    result += "1";
  }
  for (let i = digits.length - 1; i >= 0; i--) {
    result += ALPHABET[digits[i]];
  }
  return result;
}
function ethAddressToTron(ethAddress) {
  const hex = ethAddress.slice(2);
  const tronHex = "41" + hex;
  const bytes = Buffer.from(tronHex, "hex");
  const hash1 = createHash("sha256").update(bytes).digest();
  const hash2 = createHash("sha256").update(hash1).digest();
  const checksum = hash2.slice(0, 4);
  const addressBytes = Buffer.concat([bytes, checksum]);
  return base58Encode(addressBytes);
}
async function deriveTronAddress(userIndex) {
  const { ethers } = await import("ethers");
  const mnemonic = getMnemonic();
  const path = `m/44'/195'/${userIndex}'/0/0`;
  const wallet = ethers.HDNodeWallet.fromMnemonic(ethers.Mnemonic.fromPhrase(mnemonic), path);
  const tronAddress = ethAddressToTron(wallet.address);
  return { address: tronAddress, path };
}
async function getTronPrivateKey(userIndex) {
  const { ethers } = await import("ethers");
  const mnemonic = getMnemonic();
  const path = `m/44'/195'/${userIndex}'/0/0`;
  const wallet = ethers.HDNodeWallet.fromMnemonic(ethers.Mnemonic.fromPhrase(mnemonic), path);
  return wallet.privateKey.slice(2);
}
async function deriveSolanaAddress(userIndex) {
  const { derivePath } = await import("ed25519-hd-key");
  const { Keypair } = await import("@solana/web3.js");
  const seed = await getSeedBuffer();
  const path = `m/44'/501'/${userIndex}'/0'`;
  const derived = derivePath(path, seed.toString("hex"));
  const keypair = Keypair.fromSeed(derived.key);
  return { address: keypair.publicKey.toBase58(), path };
}
async function getSolanaKeypair(userIndex) {
  const { derivePath } = await import("ed25519-hd-key");
  const { Keypair } = await import("@solana/web3.js");
  const seed = await getSeedBuffer();
  const path = `m/44'/501'/${userIndex}'/0'`;
  const derived = derivePath(path, seed.toString("hex"));
  return Keypair.fromSeed(derived.key);
}
async function deriveBitcoinAddress(userIndex) {
  const bitcoin = await import("bitcoinjs-lib");
  const ecc = await import("tiny-secp256k1");
  const { BIP32Factory } = await import("bip32");
  const bip32 = BIP32Factory(ecc);
  const seed = await getSeedBuffer();
  const path = `m/44'/0'/${userIndex}'/0/0`;
  const root = bip32.fromSeed(seed, bitcoin.networks.bitcoin);
  const child = root.derivePath(path);
  const { address } = bitcoin.payments.p2wpkh({
    pubkey: Buffer.from(child.publicKey),
    network: bitcoin.networks.bitcoin
  });
  if (!address) throw new Error("Failed to derive Bitcoin address");
  return { address, path };
}
async function generateAddress(network, userIndex) {
  switch (network) {
    case "tron":
      return deriveTronAddress(userIndex);
    case "ethereum":
    case "bsc":
    case "polygon":
      return deriveEvmAddress(userIndex);
    case "solana":
      return deriveSolanaAddress(userIndex);
    case "bitcoin":
      return deriveBitcoinAddress(userIndex);
    default:
      throw new Error(`Unsupported network: ${network}`);
  }
}
async function getPrivateKey(network, userIndex) {
  switch (network) {
    case "tron":
      return getTronPrivateKey(userIndex);
    case "ethereum":
    case "bsc":
    case "polygon":
      return getEvmPrivateKey(userIndex);
    case "solana":
      return getSolanaKeypair(userIndex);
    case "bitcoin":
      throw new Error("Use bitcoin module for private key operations");
    default:
      throw new Error(`Unsupported network: ${network}`);
  }
}

// server/lib/wallet/index.ts
var NETWORKS = {
  tron: {
    id: "tron",
    name: "TRON",
    symbol: "TRX",
    token: "USDT TRC-20",
    coinType: 195,
    confirmations: 20,
    rpcUrl: process.env.TRON_FULL_NODE || "https://api.trongrid.io",
    explorerUrl: "https://tronscan.org",
    minDeposit: 1,
    withdrawalFee: 1,
    usdtContract: process.env.TRON_USDT_CONTRACT || "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
    icon: "\u20AE",
    color: "text-red-500",
    bg: "bg-red-500/10",
    recommended: true
  },
  ethereum: {
    id: "ethereum",
    name: "Ethereum",
    symbol: "ETH",
    token: "USDT ERC-20",
    coinType: 60,
    confirmations: 12,
    rpcUrl: process.env.ETH_RPC_URL || "https://eth.llamarpc.com",
    explorerUrl: "https://etherscan.io",
    minDeposit: 10,
    withdrawalFee: 5,
    usdtContract: process.env.ETH_USDT_CONTRACT || "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    icon: "\u039E",
    color: "text-blue-400",
    bg: "bg-blue-400/10"
  },
  bsc: {
    id: "bsc",
    name: "BSC",
    symbol: "BNB",
    token: "USDT BEP-20",
    coinType: 60,
    confirmations: 15,
    rpcUrl: process.env.BSC_RPC_URL || "https://bsc-dataseed1.binance.org",
    explorerUrl: "https://bscscan.com",
    minDeposit: 1,
    withdrawalFee: 0.5,
    usdtContract: process.env.BSC_USDT_CONTRACT || "0x55d398326f99059fF775485246999027B3197955",
    icon: "\u25C6",
    color: "text-yellow-500",
    bg: "bg-yellow-500/10"
  },
  polygon: {
    id: "polygon",
    name: "Polygon",
    symbol: "POL",
    token: "USDT",
    coinType: 60,
    confirmations: 128,
    rpcUrl: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
    explorerUrl: "https://polygonscan.com",
    minDeposit: 1,
    withdrawalFee: 0.5,
    usdtContract: process.env.POLYGON_USDT_CONTRACT || "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    icon: "\u2B21",
    color: "text-purple-500",
    bg: "bg-purple-500/10"
  },
  solana: {
    id: "solana",
    name: "Solana",
    symbol: "SOL",
    token: "USDT SPL",
    coinType: 501,
    confirmations: 32,
    rpcUrl: process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
    explorerUrl: "https://explorer.solana.com",
    minDeposit: 1,
    withdrawalFee: 0.5,
    usdtContract: process.env.SOLANA_USDT_MINT || "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    icon: "\u25CE",
    color: "text-green-400",
    bg: "bg-green-400/10"
  },
  bitcoin: {
    id: "bitcoin",
    name: "Bitcoin",
    symbol: "BTC",
    token: "BTC",
    coinType: 0,
    confirmations: 6,
    rpcUrl: "",
    explorerUrl: "https://blockstream.info",
    minDeposit: 1e-4,
    withdrawalFee: 1e-4,
    icon: "\u20BF",
    color: "text-orange-500",
    bg: "bg-orange-500/10"
  }
};
var NETWORK_IDS = Object.keys(NETWORKS);
function getAutoApproveLimit() {
  return parseFloat(process.env.AUTO_APPROVE_LIMIT || "100");
}
var WITHDRAWAL_LIMITS = {
  perTransaction: 5e3,
  // Max single withdrawal (USDT)
  dailyTotal: 1e4
  // Max daily total (USDT)
};

// server/lib/wallet/networks/tron.ts
function getTronWeb() {
  const TronWeb = __require("tronweb").default;
  const config = NETWORKS.tron;
  return new TronWeb({
    fullHost: config.rpcUrl,
    headers: process.env.TRON_API_KEY ? { "TRON-PRO-API-KEY": process.env.TRON_API_KEY } : void 0
  });
}
async function getTronBalance(address) {
  const tronWeb = getTronWeb();
  const config = NETWORKS.tron;
  const trxBalance = await tronWeb.trx.getBalance(address);
  const trx = trxBalance / 1e6;
  let usdt = 0;
  if (config.usdtContract) {
    try {
      const contract = await tronWeb.contract().at(config.usdtContract);
      const result = await contract.balanceOf(address).call();
      usdt = Number(result) / 1e6;
    } catch (err) {
      console.error("[TRON] Failed to get USDT balance:", err);
    }
  }
  return { trx, usdt };
}
async function sendTRC20(privateKey, toAddress, amount) {
  const TronWeb = __require("tronweb").default;
  const config = NETWORKS.tron;
  const tronWeb = new TronWeb({
    fullHost: config.rpcUrl,
    privateKey,
    headers: process.env.TRON_API_KEY ? { "TRON-PRO-API-KEY": process.env.TRON_API_KEY } : void 0
  });
  if (!config.usdtContract) throw new Error("TRON USDT contract not configured");
  const contract = await tronWeb.contract().at(config.usdtContract);
  const amountInSun = Math.floor(amount * 1e6);
  const result = await contract.transfer(toAddress, amountInSun).send();
  return result;
}

// server/lib/wallet/networks/evm.ts
var ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];
async function getProvider(networkId) {
  const { ethers } = await import("ethers");
  const config = NETWORKS[networkId];
  return new ethers.JsonRpcProvider(config.rpcUrl);
}
async function getEvmBalance(networkId, address) {
  const { ethers } = await import("ethers");
  const provider = await getProvider(networkId);
  const config = NETWORKS[networkId];
  const nativeBal = await provider.getBalance(address);
  const native = parseFloat(ethers.formatEther(nativeBal));
  let usdt = 0;
  if (config.usdtContract) {
    try {
      const contract = new ethers.Contract(config.usdtContract, ERC20_ABI, provider);
      const decimals = await contract.decimals();
      const balance = await contract.balanceOf(address);
      usdt = parseFloat(ethers.formatUnits(balance, decimals));
    } catch (err) {
      console.error(`[${networkId.toUpperCase()}] Failed to get USDT balance:`, err);
    }
  }
  return { native, usdt };
}
async function sendERC20(networkId, privateKey, toAddress, amount) {
  const { ethers } = await import("ethers");
  const provider = await getProvider(networkId);
  const config = NETWORKS[networkId];
  if (!config.usdtContract) throw new Error(`${networkId} USDT contract not configured`);
  const wallet = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(config.usdtContract, ERC20_ABI, wallet);
  const decimals = await contract.decimals();
  const amountInUnits = ethers.parseUnits(amount.toString(), decimals);
  const tx = await contract.transfer(toAddress, amountInUnits);
  const receipt = await tx.wait();
  return receipt.hash;
}

// server/lib/wallet/networks/bitcoin.ts
var BLOCKSTREAM_BASE = "https://blockstream.info/api";
async function getBtcBalance(address) {
  try {
    const res = await fetch(`${BLOCKSTREAM_BASE}/address/${address}`);
    if (!res.ok) throw new Error(`Blockstream API error: ${res.status}`);
    const data = await res.json();
    const confirmed = (data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum) / 1e8;
    const unconfirmed = (data.mempool_stats.funded_txo_sum - data.mempool_stats.spent_txo_sum) / 1e8;
    return { confirmed, unconfirmed, total: confirmed + unconfirmed };
  } catch (err) {
    console.error("[BTC] Failed to get balance:", err);
    return { confirmed: 0, unconfirmed: 0, total: 0 };
  }
}
async function sendBtc(userIndex, toAddress, amountBtc) {
  const bitcoin = await import("bitcoinjs-lib");
  const ecc = await import("tiny-secp256k1");
  const { BIP32Factory } = await import("bip32");
  const bip392 = await import("bip39");
  const bip32 = BIP32Factory(ecc);
  const mnemonic = process.env.WALLET_MNEMONIC;
  if (!mnemonic) throw new Error("WALLET_MNEMONIC not set");
  const seed = await bip392.mnemonicToSeed(mnemonic);
  const root = bip32.fromSeed(seed, bitcoin.networks.bitcoin);
  const path = `m/44'/0'/${userIndex}'/0/0`;
  const child = root.derivePath(path);
  const { address: fromAddress } = bitcoin.payments.p2wpkh({
    pubkey: Buffer.from(child.publicKey),
    network: bitcoin.networks.bitcoin
  });
  if (!fromAddress) throw new Error("Failed to derive source address");
  const utxoRes = await fetch(`${BLOCKSTREAM_BASE}/address/${fromAddress}/utxo`);
  const utxos = await utxoRes.json();
  if (!utxos.length) throw new Error("No UTXOs available");
  const amountSats = Math.floor(amountBtc * 1e8);
  const feeSats = 5e3;
  let inputSum = 0;
  const selectedUtxos = [];
  for (const utxo of utxos) {
    selectedUtxos.push(utxo);
    inputSum += utxo.value;
    if (inputSum >= amountSats + feeSats) break;
  }
  if (inputSum < amountSats + feeSats) throw new Error("Insufficient BTC balance");
  const psbt = new bitcoin.Psbt({ network: bitcoin.networks.bitcoin });
  for (const utxo of selectedUtxos) {
    const txHexRes = await fetch(`${BLOCKSTREAM_BASE}/tx/${utxo.txid}/hex`);
    const txHex2 = await txHexRes.text();
    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: bitcoin.payments.p2wpkh({
          pubkey: Buffer.from(child.publicKey),
          network: bitcoin.networks.bitcoin
        }).output,
        value: BigInt(utxo.value)
      }
    });
  }
  psbt.addOutput({ address: toAddress, value: BigInt(amountSats) });
  const change = inputSum - amountSats - feeSats;
  if (change > 546) {
    psbt.addOutput({ address: fromAddress, value: BigInt(change) });
  }
  for (let i = 0; i < selectedUtxos.length; i++) {
    psbt.signInput(i, {
      publicKey: Buffer.from(child.publicKey),
      privateKey: Buffer.from(child.privateKey),
      sign: (hash) => {
        return Buffer.from(ecc.sign(hash, child.privateKey));
      }
    });
  }
  psbt.finalizeAllInputs();
  const txHex = psbt.extractTransaction().toHex();
  const broadcastRes = await fetch(`${BLOCKSTREAM_BASE}/tx`, {
    method: "POST",
    body: txHex
  });
  if (!broadcastRes.ok) {
    const errText = await broadcastRes.text();
    throw new Error(`Broadcast failed: ${errText}`);
  }
  return await broadcastRes.text();
}

// server/lib/wallet/networks/solana.ts
async function getConnection() {
  const { Connection } = await import("@solana/web3.js");
  return new Connection(NETWORKS.solana.rpcUrl, "confirmed");
}
async function getSolBalance(address) {
  const { PublicKey } = await import("@solana/web3.js");
  const connection = await getConnection();
  let sol = 0;
  let usdt = 0;
  try {
    const pubkey = new PublicKey(address);
    const lamports = await connection.getBalance(pubkey);
    sol = lamports / 1e9;
    const mintAddress = NETWORKS.solana.usdtContract;
    if (mintAddress) {
      const mint = new PublicKey(mintAddress);
      const tokenAccounts = await connection.getTokenAccountsByOwner(pubkey, { mint });
      for (const { account } of tokenAccounts.value) {
        const data = account.data;
        const amount = data.readBigUInt64LE(64);
        usdt += Number(amount) / 1e6;
      }
    }
  } catch (err) {
    console.error("[SOL] Failed to get balance:", err);
  }
  return { sol, usdt };
}
async function sendSplToken(keypairBytes, toAddress, mintAddress, amount) {
  const {
    PublicKey,
    Keypair,
    Transaction,
    SystemProgram
  } = await import("@solana/web3.js");
  const connection = await getConnection();
  const fromKeypair = Keypair.fromSecretKey(keypairBytes);
  const toPubkey = new PublicKey(toAddress);
  const mint = new PublicKey(mintAddress);
  const amountInDecimals = Math.floor(amount * 1e6);
  const transaction = new Transaction();
  transaction.add(
    SystemProgram.transfer({
      fromPubkey: fromKeypair.publicKey,
      toPubkey,
      lamports: Math.floor(amount * 1e9)
    })
  );
  const signature = await connection.sendTransaction(transaction, [fromKeypair]);
  await connection.confirmTransaction(signature, "confirmed");
  return signature;
}

// server/lib/wallet/hotWallet.ts
function getHotWalletAddress(network) {
  switch (network) {
    case "tron":
      return process.env.HOT_WALLET_TRON || "";
    case "ethereum":
    case "bsc":
    case "polygon":
      return process.env.HOT_WALLET_EVM || "";
    case "solana":
      return process.env.HOT_WALLET_SOLANA || "";
    case "bitcoin":
      return process.env.HOT_WALLET_BITCOIN || "";
  }
}
async function getAllDepositBalances() {
  const results = [];
  const networks = ["tron", "ethereum", "bsc", "polygon", "solana", "bitcoin"];
  for (const network of networks) {
    const wallets2 = await getActiveDepositAddresses(network);
    for (const wallet of wallets2) {
      try {
        let balance = 0;
        let nativeBalance;
        switch (network) {
          case "tron": {
            const bal = await getTronBalance(wallet.depositAddress);
            balance = bal.usdt;
            nativeBalance = bal.trx;
            break;
          }
          case "ethereum":
          case "bsc":
          case "polygon": {
            const bal = await getEvmBalance(network, wallet.depositAddress);
            balance = bal.usdt;
            nativeBalance = bal.native;
            break;
          }
          case "solana": {
            const bal = await getSolBalance(wallet.depositAddress);
            balance = bal.usdt;
            nativeBalance = bal.sol;
            break;
          }
          case "bitcoin": {
            const bal = await getBtcBalance(wallet.depositAddress);
            balance = bal.total;
            break;
          }
        }
        results.push({
          walletId: wallet.id,
          userId: wallet.userId,
          network,
          address: wallet.depositAddress,
          addressIndex: wallet.addressIndex,
          balance,
          nativeBalance
        });
      } catch (err) {
        console.error(`[HotWallet] Failed to get balance for ${wallet.depositAddress}:`, err);
      }
    }
  }
  return results;
}
async function sweepWallet(network, walletId, address, addressIndex, amount) {
  const hotWallet = getHotWalletAddress(network);
  if (!hotWallet) {
    return { walletId, network, address, amount, error: "Hot wallet adresi ayarlanmam\u0131\u015F" };
  }
  try {
    let txHash;
    switch (network) {
      case "tron": {
        const privateKey = await getPrivateKey("tron", addressIndex);
        txHash = await sendTRC20(privateKey, hotWallet, amount);
        break;
      }
      case "ethereum":
      case "bsc":
      case "polygon": {
        const privateKey = await getPrivateKey(network, addressIndex);
        txHash = await sendERC20(network, privateKey, hotWallet, amount);
        break;
      }
      case "solana": {
        const keypair = await getPrivateKey("solana", addressIndex);
        const mint = NETWORKS.solana.usdtContract;
        if (!mint) throw new Error("Solana USDT mint adresi ayarlanmam\u0131\u015F");
        txHash = await sendSplToken(keypair.secretKey, hotWallet, mint, amount);
        break;
      }
      case "bitcoin": {
        txHash = await sendBtc(addressIndex, hotWallet, amount);
        break;
      }
      default:
        return { walletId, network, address, amount, error: "Desteklenmeyen a\u011F" };
    }
    return { walletId, network, address, amount, txHash };
  } catch (err) {
    return { walletId, network, address, amount, error: err.message || "Sweep ba\u015Far\u0131s\u0131z" };
  }
}
async function sweepAll() {
  const balances2 = await getAllDepositBalances();
  const results = [];
  let totalSwept = 0;
  for (const wallet of balances2) {
    if (wallet.balance <= 0) continue;
    const result = await sweepWallet(
      wallet.network,
      wallet.walletId,
      wallet.address,
      wallet.addressIndex,
      wallet.balance
    );
    results.push(result);
    if (result.txHash) {
      totalSwept += wallet.balance;
    }
  }
  return { results, totalSwept };
}
async function getHotWalletBalances() {
  const results = [];
  const networks = ["tron", "ethereum", "bsc", "polygon", "solana", "bitcoin"];
  for (const network of networks) {
    const address = getHotWalletAddress(network);
    if (!address) continue;
    try {
      let balance = 0;
      let nativeBalance;
      switch (network) {
        case "tron": {
          const bal = await getTronBalance(address);
          balance = bal.usdt;
          nativeBalance = bal.trx;
          break;
        }
        case "ethereum":
        case "bsc":
        case "polygon": {
          const bal = await getEvmBalance(network, address);
          balance = bal.usdt;
          nativeBalance = bal.native;
          break;
        }
        case "solana": {
          const bal = await getSolBalance(address);
          balance = bal.usdt;
          nativeBalance = bal.sol;
          break;
        }
        case "bitcoin": {
          const bal = await getBtcBalance(address);
          balance = bal.total;
          break;
        }
      }
      results.push({ network, address, balance, nativeBalance });
    } catch (err) {
      console.error(`[HotWallet] Failed to get hot wallet balance for ${network}:`, err);
    }
  }
  return results;
}

// server/settlement.ts
async function settleBets() {
  const pendingBets = await getPendingBets();
  if (pendingBets.length === 0) return { settled: 0, checked: 0 };
  const sportKeys = /* @__PURE__ */ new Set();
  const allBetItems = /* @__PURE__ */ new Map();
  for (const bet of pendingBets) {
    const items = await getBetItemsByBetId(bet.id);
    allBetItems.set(bet.id, items);
    for (const item of items) {
      sportKeys.add(item.sportKey);
    }
  }
  const scoresByEvent = /* @__PURE__ */ new Map();
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
      const homeScoreVal = parseInt(score.scores.find((s) => s.name === item.homeTeam)?.score ?? "0");
      const awayScoreVal = parseInt(score.scores.find((s) => s.name === item.awayTeam)?.score ?? "0");
      await markEventCompleted(item.eventId, homeScoreVal, awayScoreVal);
      const won = determineOutcome(item.marketKey, item.outcomeName, item.point ? parseFloat(item.point) : void 0, homeScoreVal, awayScoreVal, item.homeTeam, item.awayTeam);
      await updateBetItemResult(item.id, won ? "won" : "lost", homeScoreVal, awayScoreVal);
      if (!won) {
        anyLost = true;
        allWon = false;
      }
    }
    const updatedItems = await getBetItemsByBetId(bet.id);
    const stillPending = updatedItems.some((i) => i.status === "pending");
    if (!stillPending) {
      const allItemsWon = updatedItems.every((i) => i.status === "won");
      const allItemsLost = updatedItems.every((i) => i.status === "lost");
      if (allItemsWon) {
        await updateBetStatus(bet.id, "won");
        await getOrCreateBalance(bet.userId);
        await updateBalance(bet.userId, bet.potentialWin);
        await addTransaction(bet.userId, "bet_win", bet.potentialWin, `Kupon #${bet.id} kazand\u0131`);
        try {
          await notifyOwner({
            title: `Kupon #${bet.id} Kazand\u0131!`,
            content: `Kullan\u0131c\u0131 #${bet.userId} kupon #${bet.id} kazand\u0131. Kazanc: ${bet.potentialWin} TL. Bahis: ${bet.stake} TL, Oran: ${bet.totalOdds}`
          });
        } catch (e) {
          console.warn("[Settlement] Notification failed:", e);
        }
      } else if (allItemsLost) {
        await updateBetStatus(bet.id, "lost");
        try {
          await notifyOwner({
            title: `Kupon #${bet.id} Kaybetti`,
            content: `Kullan\u0131c\u0131 #${bet.userId} kupon #${bet.id} kaybetti. Bahis: ${bet.stake} TL`
          });
        } catch (e) {
          console.warn("[Settlement] Notification failed:", e);
        }
      } else {
        await updateBetStatus(bet.id, "lost");
      }
      settledCount++;
    }
  }
  return { settled: settledCount, checked: pendingBets.length };
}
function determineOutcome(marketKey, outcomeName, point, homeScore, awayScore, homeTeam, awayTeam) {
  switch (marketKey) {
    case "h2h": {
      if (outcomeName === homeTeam) return homeScore > awayScore;
      if (outcomeName === awayTeam) return awayScore > homeScore;
      if (outcomeName === "Draw") return homeScore === awayScore;
      return false;
    }
    case "spreads": {
      const spread = point ?? 0;
      if (outcomeName === homeTeam) return homeScore + spread > awayScore;
      if (outcomeName === awayTeam) return awayScore + spread > homeScore;
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

// server/casinoEngine.ts
function playCoinFlip(params) {
  const choice = params?.choice || "heads";
  const flip = Math.random() < 0.5 ? "heads" : "tails";
  const won = choice === flip;
  return {
    multiplier: won ? 1.96 : 0,
    details: { choice, flip, won }
  };
}
function playDice(params) {
  const target = Number(params?.target) || 50;
  const clampedTarget = Math.max(2, Math.min(95, target));
  const roll = Math.floor(Math.random() * 100) + 1;
  const won = roll <= clampedTarget;
  const multiplier = won ? parseFloat((98 / clampedTarget).toFixed(4)) : 0;
  return {
    multiplier,
    details: { target: clampedTarget, roll, won, winChance: clampedTarget }
  };
}
function playMines(params) {
  const mineCount = Math.max(1, Math.min(24, Number(params?.mines) || 5));
  const revealed = Math.max(0, Math.min(24 - mineCount, Number(params?.revealed) || 0));
  const cashOut = !!params?.cashOut;
  const totalCells = 25;
  const minePositions = /* @__PURE__ */ new Set();
  while (minePositions.size < mineCount) {
    minePositions.add(Math.floor(Math.random() * totalCells));
  }
  const safeCells = [];
  const allCells = Array.from({ length: totalCells }, (_, i) => i).filter((i) => !minePositions.has(i));
  for (let i = allCells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allCells[i], allCells[j]] = [allCells[j], allCells[i]];
  }
  let hitMine = false;
  let revealedCount = 0;
  if (cashOut && revealed > 0) {
    revealedCount = revealed;
  } else {
    const targetReveals = revealed + 1;
    for (let i = 0; i < targetReveals && i < allCells.length; i++) {
      const remainingCells = totalCells - i;
      const hitChance = mineCount / remainingCells;
      if (Math.random() < hitChance && !cashOut) {
        hitMine = true;
        break;
      }
      revealedCount++;
    }
  }
  let multiplier = 0;
  if (!hitMine && revealedCount > 0) {
    const safeCellCount = totalCells - mineCount;
    let mult = 1;
    for (let i = 0; i < revealedCount; i++) {
      mult *= (totalCells - i) / (safeCellCount - i);
    }
    multiplier = parseFloat((mult * 0.97).toFixed(4));
  }
  return {
    multiplier,
    details: {
      mines: mineCount,
      revealed: revealedCount,
      hitMine,
      cashOut,
      minePositions: hitMine || cashOut ? Array.from(minePositions) : void 0,
      grid: Array.from({ length: totalCells }, (_, i) => minePositions.has(i) ? "mine" : "safe")
    }
  };
}
function playCrash(params) {
  const cashOutAt = Number(params?.cashOutAt) || 2;
  const e = Math.random();
  const crashPoint = Math.max(1, parseFloat((0.97 / (1 - e)).toFixed(2)));
  const won = cashOutAt <= crashPoint;
  const multiplier = won ? cashOutAt : 0;
  return {
    multiplier,
    details: {
      cashOutAt,
      crashPoint,
      won,
      // Generate crash history for display
      history: Array.from({ length: 10 }, () => {
        const r = Math.random();
        return parseFloat(Math.max(1, 0.97 / (1 - r)).toFixed(2));
      })
    }
  };
}
function playRoulette(params) {
  const betType = params?.betType || "red";
  const betNumber = Number(params?.number);
  const result = Math.floor(Math.random() * 37);
  const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  const isRed = redNumbers.includes(result);
  const isBlack = result > 0 && !isRed;
  const isGreen = result === 0;
  let won = false;
  let multiplier = 0;
  switch (betType) {
    case "red":
      won = isRed;
      multiplier = won ? 2 : 0;
      break;
    case "black":
      won = isBlack;
      multiplier = won ? 2 : 0;
      break;
    case "green":
      won = isGreen;
      multiplier = won ? 36 : 0;
      break;
    case "number":
      won = result === betNumber;
      multiplier = won ? 36 : 0;
      break;
    case "odd":
      won = result > 0 && result % 2 === 1;
      multiplier = won ? 2 : 0;
      break;
    case "even":
      won = result > 0 && result % 2 === 0;
      multiplier = won ? 2 : 0;
      break;
    case "high":
      won = result >= 19;
      multiplier = won ? 2 : 0;
      break;
    case "low":
      won = result >= 1 && result <= 18;
      multiplier = won ? 2 : 0;
      break;
    default:
      won = false;
      multiplier = 0;
  }
  return {
    multiplier,
    details: {
      betType,
      betNumber: betType === "number" ? betNumber : void 0,
      result,
      color: isGreen ? "green" : isRed ? "red" : "black",
      won
    }
  };
}
function playPlinko(params) {
  const risk = params?.risk || "medium";
  const rows = Math.max(8, Math.min(16, Number(params?.rows) || 12));
  let position = 0;
  const path = [0];
  for (let i = 0; i < rows; i++) {
    position += Math.random() < 0.5 ? 1 : -1;
    path.push(position);
  }
  const bucketIndex = Math.floor((position + rows) / 2);
  const totalBuckets = rows + 1;
  const normalizedIndex = Math.max(0, Math.min(totalBuckets - 1, bucketIndex));
  const multiplierTables = {
    low: generatePlinkoMultipliers(totalBuckets, "low"),
    medium: generatePlinkoMultipliers(totalBuckets, "medium"),
    high: generatePlinkoMultipliers(totalBuckets, "high")
  };
  const table = multiplierTables[risk] || multiplierTables.medium;
  const multiplier = table[normalizedIndex] || 0;
  return {
    multiplier,
    details: {
      risk,
      rows,
      path,
      bucketIndex: normalizedIndex,
      multipliers: table,
      won: multiplier > 0
    }
  };
}
function generatePlinkoMultipliers(buckets, risk) {
  const center = Math.floor(buckets / 2);
  const mults = [];
  for (let i = 0; i < buckets; i++) {
    const distFromCenter = Math.abs(i - center);
    const maxDist = center;
    const ratio = distFromCenter / maxDist;
    let mult;
    if (risk === "low") {
      mult = 0.5 + ratio * 2.5;
    } else if (risk === "high") {
      mult = ratio < 0.3 ? 0.2 : ratio < 0.6 ? 0.5 : Math.pow(ratio, 3) * 100;
    } else {
      mult = 0.3 + Math.pow(ratio, 2) * 15;
    }
    mults.push(parseFloat(mult.toFixed(2)));
  }
  return mults;
}
function calculateCasinoResult(gameType, params) {
  switch (gameType) {
    case "coinflip":
      return playCoinFlip(params);
    case "dice":
      return playDice(params);
    case "mines":
      return playMines(params);
    case "crash":
      return playCrash(params);
    case "roulette":
      return playRoulette(params);
    case "plinko":
      return playPlinko(params);
    default:
      return { multiplier: 0, details: { error: "Unknown game type" } };
  }
}

// server/_core/llm.ts
var ensureArray = (value) => Array.isArray(value) ? value : [value];
var normalizeContentPart = (part) => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }
  if (part.type === "text") {
    return part;
  }
  if (part.type === "image_url") {
    return part;
  }
  if (part.type === "file_url") {
    return part;
  }
  throw new Error("Unsupported message content part");
};
var normalizeMessage = (message) => {
  const { role, name, tool_call_id } = message;
  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content).map((part) => typeof part === "string" ? part : JSON.stringify(part)).join("\n");
    return {
      role,
      name,
      tool_call_id,
      content
    };
  }
  const contentParts = ensureArray(message.content).map(normalizeContentPart);
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text
    };
  }
  return {
    role,
    name,
    content: contentParts
  };
};
var normalizeToolChoice = (toolChoice, tools) => {
  if (!toolChoice) return void 0;
  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }
  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }
    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }
    return {
      type: "function",
      function: { name: tools[0].function.name }
    };
  }
  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name }
    };
  }
  return toolChoice;
};
var resolveApiUrl = () => ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0 ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/chat/completions` : "https://api.z.ai/api/paas/v4/chat/completions";
var normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema
}) => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (explicitFormat.type === "json_schema" && !explicitFormat.json_schema?.schema) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }
  const schema = outputSchema || output_schema;
  if (!schema) return void 0;
  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }
  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...typeof schema.strict === "boolean" ? { strict: schema.strict } : {}
    }
  };
};
async function invokeLLM(params) {
  if (!ENV.forgeApiKey) {
    return {
      id: "local-fallback",
      created: Date.now(),
      model: "none",
      choices: [{
        index: 0,
        message: {
          role: "assistant",
          content: "AI asistan su anda yapilandirmadi. Lutfen BUILT_IN_FORGE_API_KEY ortam degiskenini ayarlayin."
        },
        finish_reason: "stop"
      }]
    };
  }
  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format
  } = params;
  const payload = {
    model: "glm-5",
    messages: messages.map(normalizeMessage)
  };
  if (tools && tools.length > 0) {
    payload.tools = tools;
  }
  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }
  payload.max_tokens = 4096;
  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema
  });
  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }
  const response = await fetch(resolveApiUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.forgeApiKey}`
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} \u2013 ${errorText}`
    );
  }
  return await response.json();
}

// server/routers.ts
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    register: publicProcedure.input(z2.object({
      username: z2.string().min(2).max(32),
      email: z2.string().email().max(320),
      password: z2.string().min(6).max(128)
    })).mutation(async ({ ctx, input }) => {
      const existing = await getUserByEmail(input.email);
      if (existing) {
        throw new Error("Bu e-posta adresi zaten kay\u0131tl\u0131");
      }
      const openId = `email-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const hashed = hashPassword(input.password);
      await upsertUser({
        openId,
        name: input.username,
        email: input.email,
        passwordHash: hashed,
        loginMethod: "email",
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const user = await getUserByEmail(input.email);
      if (!user) throw new Error("Kay\u0131t ba\u015Far\u0131s\u0131z");
      await getOrCreateBalance(user.id);
      const sessionToken = await sdk.createSessionToken(openId, {
        name: input.username,
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      return { success: true, user: { id: user.id, name: user.name, email: user.email } };
    }),
    login: publicProcedure.input(z2.object({
      email: z2.string().email(),
      password: z2.string().min(1)
    })).mutation(async ({ ctx, input }) => {
      const user = await getUserByEmail(input.email);
      if (!user || !user.passwordHash) {
        throw new Error("E-posta veya \u015Fifre hatal\u0131");
      }
      if (!verifyPassword(input.password, user.passwordHash)) {
        throw new Error("E-posta veya \u015Fifre hatal\u0131");
      }
      await upsertUser({ openId: user.openId, lastSignedIn: /* @__PURE__ */ new Date() });
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      return { success: true, user: { id: user.id, name: user.name, email: user.email } };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    })
  }),
  // ─── Sports ───
  sports: router({
    list: publicProcedure.query(async () => {
      const cached = await getActiveSports();
      if (cached.length > 0) return cached;
      try {
        const sports = await fetchSports();
        for (const s of sports) {
          if (s.active) {
            await upsertSport({
              sportKey: s.key,
              groupName: s.group,
              title: s.title,
              description: s.description || "",
              active: s.active ? 1 : 0,
              hasOutrights: s.has_outrights ? 1 : 0
            });
          }
        }
        const result = await getActiveSports();
        if (result.length > 0) return result;
      } catch (err) {
        console.error("[Sports] API error, using demo data:", err?.message);
      }
      return getDemoSports();
    }),
    refresh: adminProcedure.mutation(async () => {
      const sports = await fetchSports();
      for (const s of sports) {
        await upsertSport({
          sportKey: s.key,
          groupName: s.group,
          title: s.title,
          description: s.description || "",
          active: s.active ? 1 : 0,
          hasOutrights: s.has_outrights ? 1 : 0
        });
      }
      return { count: sports.length };
    })
  }),
  // ─── Events & Odds ───
  events: router({
    featured: publicProcedure.query(async () => {
      const popularKeys = [
        "soccer_turkey_super_league",
        "soccer_epl",
        "soccer_spain_la_liga",
        "soccer_uefa_champs_league",
        "basketball_nba",
        "basketball_euroleague"
      ];
      const all = [];
      for (const sportKey of popularKeys) {
        const cached = await getEventsBySport(sportKey);
        if (cached.length > 0) {
          all.push(...cached.map((c) => ({
            id: c.eventId,
            sport_key: c.sportKey,
            sport_title: "",
            commence_time: c.commenceTime.toISOString(),
            home_team: c.homeTeam,
            away_team: c.awayTeam,
            bookmakers: c.oddsJson ?? []
          })));
        } else {
          all.push(...getDemoEvents(sportKey));
        }
      }
      all.sort((a, b) => new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime());
      return all;
    }),
    bySport: publicProcedure.input(z2.object({ sportKey: z2.string() })).query(async ({ input }) => {
      try {
        const events = await fetchOdds(input.sportKey);
        if (events.length > 0) {
          for (const e of events) {
            await upsertEvent({
              eventId: e.id,
              sportKey: e.sport_key,
              homeTeam: e.home_team,
              awayTeam: e.away_team,
              commenceTime: new Date(e.commence_time),
              oddsJson: e.bookmakers
            });
          }
          return events;
        }
      } catch (err) {
        console.error("[Events] API error, trying cache:", err?.message);
      }
      const cached = await getEventsBySport(input.sportKey);
      if (cached.length > 0) {
        return cached.map((c) => ({
          id: c.eventId,
          sport_key: c.sportKey,
          sport_title: "",
          commence_time: c.commenceTime.toISOString(),
          home_team: c.homeTeam,
          away_team: c.awayTeam,
          bookmakers: c.oddsJson ?? []
        }));
      }
      return getDemoEvents(input.sportKey);
    })
  }),
  // ─── Balance ───
  balance: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      return getOrCreateBalance(ctx.user.id);
    }),
    deposit: protectedProcedure.input(z2.object({ amount: z2.number().min(1).max(1e5) })).mutation(async ({ ctx, input }) => {
      await getOrCreateBalance(ctx.user.id);
      const bal = await updateBalance(ctx.user.id, input.amount.toFixed(2));
      await addTransaction(ctx.user.id, "deposit", input.amount.toFixed(2), `${input.amount} TL yat\u0131r\u0131ld\u0131`);
      return bal;
    }),
    withdraw: protectedProcedure.input(z2.object({ amount: z2.number().min(1) })).mutation(async ({ ctx, input }) => {
      const bal = await getOrCreateBalance(ctx.user.id);
      if (!bal || parseFloat(bal.amount) < input.amount) {
        throw new Error("Yetersiz bakiye");
      }
      const updated = await updateBalance(ctx.user.id, (-input.amount).toFixed(2));
      await addTransaction(ctx.user.id, "withdraw", input.amount.toFixed(2), `${input.amount} TL \xE7ekildi`);
      return updated;
    }),
    transactions: protectedProcedure.query(async ({ ctx }) => {
      return getUserTransactions(ctx.user.id);
    })
  }),
  // ─── Bets (Kuponlar) ───
  bets: router({
    place: protectedProcedure.input(z2.object({
      type: z2.enum(["single", "combo"]),
      stake: z2.number().min(1),
      items: z2.array(z2.object({
        eventId: z2.string(),
        sportKey: z2.string(),
        homeTeam: z2.string(),
        awayTeam: z2.string(),
        commenceTime: z2.string(),
        marketKey: z2.string(),
        outcomeName: z2.string(),
        outcomePrice: z2.number(),
        point: z2.number().optional()
      })).min(1)
    })).mutation(async ({ ctx, input }) => {
      let totalOdds = 1;
      for (const item of input.items) {
        totalOdds *= item.outcomePrice;
      }
      const potentialWin = input.stake * totalOdds;
      const bal = await getOrCreateBalance(ctx.user.id);
      if (!bal || parseFloat(bal.amount) < input.stake) {
        throw new Error("Yetersiz bakiye");
      }
      await updateBalance(ctx.user.id, (-input.stake).toFixed(2));
      await addTransaction(ctx.user.id, "bet_place", input.stake.toFixed(2), `Kupon olu\u015Fturuldu`);
      const betId = await createBet(
        ctx.user.id,
        input.type,
        input.stake.toFixed(2),
        totalOdds.toFixed(4),
        potentialWin.toFixed(2),
        input.items.map((i) => ({
          eventId: i.eventId,
          sportKey: i.sportKey,
          homeTeam: i.homeTeam,
          awayTeam: i.awayTeam,
          commenceTime: new Date(i.commenceTime),
          marketKey: i.marketKey,
          outcomeName: i.outcomeName,
          outcomePrice: i.outcomePrice.toFixed(4),
          point: i.point?.toFixed(2)
        }))
      );
      const xpEarned = Math.floor(input.stake / 10);
      if (xpEarned > 0) {
        await addVipXp(ctx.user.id, xpEarned, input.stake);
      }
      return { betId, totalOdds, potentialWin };
    }),
    myBets: protectedProcedure.input(z2.object({ status: z2.string().optional() }).optional()).query(async ({ ctx, input }) => {
      return getUserBets(ctx.user.id, input?.status);
    }),
    detail: protectedProcedure.input(z2.object({ betId: z2.number() })).query(async ({ ctx, input }) => {
      const bet = await getBetWithItems(input.betId);
      if (!bet || bet.userId !== ctx.user.id) {
        throw new Error("Kupon bulunamad\u0131");
      }
      return bet;
    })
  }),
  // ─── Event Detail ───
  eventDetail: router({
    get: publicProcedure.input(z2.object({ eventId: z2.string() })).query(async ({ input }) => {
      const cached = await getEventById(input.eventId);
      return cached;
    }),
    getWithOdds: publicProcedure.input(z2.object({ eventId: z2.string(), sportKey: z2.string() })).query(async ({ input }) => {
      try {
        const events = await fetchOdds(input.sportKey);
        const event = events.find((e) => e.id === input.eventId);
        if (event) {
          await upsertEvent({
            eventId: event.id,
            sportKey: event.sport_key,
            homeTeam: event.home_team,
            awayTeam: event.away_team,
            commenceTime: new Date(event.commence_time),
            oddsJson: event.bookmakers
          });
          return event;
        }
      } catch (err) {
        console.error("[EventDetail] API error:", err?.message);
      }
      const cached = await getEventById(input.eventId);
      if (cached) {
        return {
          id: cached.eventId,
          sport_key: cached.sportKey,
          sport_title: "",
          commence_time: cached.commenceTime.toISOString(),
          home_team: cached.homeTeam,
          away_team: cached.awayTeam,
          bookmakers: cached.oddsJson ?? []
        };
      }
      return null;
    })
  }),
  // ─── Live Scores ───
  liveScores: router({
    // Get all live/in-progress events
    live: publicProcedure.query(async () => {
      const events = await getLiveEvents();
      if (events.length > 0) return events;
      return getDemoLiveEventsClean().filter((e) => e.isLive === 1);
    }),
    // Get events with scores for a sport (or all)
    bySport: publicProcedure.input(z2.object({ sportKey: z2.string().optional() }).optional()).query(async ({ input }) => {
      const events = await getEventsWithScores(input?.sportKey);
      if (events.length > 0) return events;
      const demo = getDemoLiveEventsClean();
      if (input?.sportKey) return demo.filter((e) => e.sportKey === input.sportKey);
      return demo;
    }),
    // Refresh scores from The Odds API
    refresh: publicProcedure.mutation(async () => {
      const sportKeys = await getActiveEventSportKeys();
      let updated = 0;
      for (const sportKey of sportKeys.slice(0, 5)) {
        try {
          const scores = await fetchScores(sportKey, 1);
          for (const s of scores) {
            const homeScoreVal = s.scores?.find((sc) => sc.name === s.home_team);
            const awayScoreVal = s.scores?.find((sc) => sc.name === s.away_team);
            const isLive = !s.completed && s.scores !== null;
            await updateEventScores(
              s.id,
              s.scores,
              isLive,
              s.completed,
              homeScoreVal ? parseInt(homeScoreVal.score) : void 0,
              awayScoreVal ? parseInt(awayScoreVal.score) : void 0
            );
            updated++;
          }
        } catch (err) {
          console.error(`[LiveScores] Error fetching scores for ${sportKey}:`, err?.message);
        }
      }
      return { updated, sportsChecked: sportKeys.length };
    }),
    // Get scores for events in user's active bets
    myBetScores: protectedProcedure.query(async ({ ctx }) => {
      const userBets = await getUserBets(ctx.user.id, "pending");
      const eventIds = /* @__PURE__ */ new Set();
      const betEventMap = {};
      for (const bet of userBets) {
        const items = await getBetItemsByBetId(bet.id);
        betEventMap[bet.id] = items.map((i) => i.eventId);
        for (const item of items) {
          eventIds.add(item.eventId);
        }
      }
      const liveEvents = await getLiveEvents();
      const allEvents = await getEventsWithScores();
      const eventScoreMap = {};
      for (const ev of [...liveEvents, ...allEvents]) {
        if (eventIds.has(ev.eventId)) {
          eventScoreMap[ev.eventId] = {
            eventId: ev.eventId,
            homeTeam: ev.homeTeam,
            awayTeam: ev.awayTeam,
            homeScore: ev.homeScore,
            awayScore: ev.awayScore,
            isLive: ev.isLive === 1,
            completed: ev.completed === 1,
            scores: ev.scoresJson
          };
        }
      }
      return { betEventMap, eventScores: eventScoreMap };
    })
  }),
  // ─── Settlement ───
  settlement: router({
    run: adminProcedure.mutation(async () => {
      return settleBets();
    })
  }),
  // ─── LLM Assistant ───
  assistant: router({
    chat: protectedProcedure.input(z2.object({ message: z2.string().min(1).max(2e3) })).mutation(async ({ ctx, input }) => {
      await addChatMessage(ctx.user.id, "user", input.message);
      const history = await getChatHistory(ctx.user.id, 20);
      const historyMessages = history.reverse().slice(0, -1).map((m) => ({ role: m.role, content: m.content }));
      const systemPrompt = `Sen "Dopamin" bahis ve casino platformunun resmi AI asistan\u0131s\u0131n. Ad\u0131n "Dopamin AI". Kullan\u0131c\u0131ya her konuda yard\u0131mc\u0131 ol. T\xFCrk\xE7e yan\u0131t ver. K\u0131sa ve net cevaplar ver.

## Platform Hakk\u0131nda
- Dopamin, spor bahisleri ve casino oyunlar\u0131 sunan bir platformdur.
- Para birimi USDT bazl\u0131d\u0131r. Kullan\u0131c\u0131lar farkl\u0131 fiat para birimlerinde bakiyelerini g\xF6rebilir (USD, EUR, TRY, vb.) ama dahili bakiye her zaman USDT'dir.
- Minimum bahis: 1 USDT, Minimum yat\u0131r\u0131m: 1 USDT.

## Spor Bahisleri
- Futbol, basketbol, tenis, Amerikan futbolu, buz hokeyi, beyzbol, MMA, boks, kriket, e-spor dahil bir\xE7ok spor dal\u0131 mevcuttur.
- Bahis t\xFCrleri: Ma\xE7 Sonucu (1X2/H2H), Handikap (Spreads), Alt/\xDCst (Totals).
- Tekli ve kombine kuponlar olu\u015Fturulabilir.
- Canl\u0131 skorlar ve canl\u0131 bahis imkan\u0131 vard\u0131r.
- Kuponlar "Kuponlar\u0131m" sayfas\u0131ndan takip edilebilir.

## Casino Oyunlar\u0131
- **Coin Flip**: Yaz\u0131-tura. 2x \xE7arpan. %50 kazanma \u015Fans\u0131.
- **Dice (Zar)**: 1-100 aras\u0131 zar atma. Hedef belirlenir, alt\u0131nda veya \xFCst\xFCnde kazan\u0131l\u0131r. \xC7arpan hedefe g\xF6re de\u011Fi\u015Fir.
- **Mines (May\u0131nlar)**: 5x5 \u0131zgara, gizli may\u0131nlar. Her g\xFCvenli kareyi a\xE7t\u0131k\xE7a \xE7arpan artar. May\u0131na basarsan kaybedersin. May\u0131n say\u0131s\u0131 se\xE7ilebilir (1-24). Ne kadar \xE7ok may\u0131n, o kadar y\xFCksek \xE7arpan.
- **Crash**: \xC7arpan 1x'ten yukar\u0131 \xE7\u0131kar. U\xE7ak d\xFC\u015Fmeden "Cash Out" yapmal\u0131s\u0131n. Ne kadar ge\xE7 \xE7ekersin, o kadar \xE7ok kazan\u0131rs\u0131n ama u\xE7ak d\xFC\u015Ferse her \u015Feyi kaybedersin.
- **Roulette (Rulet)**: Avrupa ruleti (0-36). K\u0131rm\u0131z\u0131/Siyah, Tek/\xC7ift, d\xFCz numara bahisleri yap\u0131labilir.
- **Plinko**: Toplar piramit \u015Feklindeki \xE7ivilerden d\xFC\u015Fer. Risk seviyesi (D\xFC\u015F\xFCk/Orta/Y\xFCksek) ve sat\u0131r say\u0131s\u0131 se\xE7ilebilir.

## VIP Sistemi
- Her 10 USDT bahis = 1 XP kazand\u0131r\u0131r.
- Seviyeler: Bronze (0 XP), Silver (1000 XP), Gold (5000 XP), Platinum (15000 XP), Diamond (50000 XP), Elite (150000 XP).
- Cashback oranlar\u0131: Bronze %0.5, Silver %1, Gold %2, Platinum %3.5, Diamond %5, Elite %8.
- Bonus \xE7arpanlar\u0131 seviyeye g\xF6re artar.

## C\xFCzdan & Hesap
- C\xFCzdan sayfas\u0131ndan yat\u0131rma ve \xE7ekme i\u015Flemleri yap\u0131l\u0131r.
- Kripto (USDT) ile yat\u0131r\u0131m/\xE7ekim desteklenir.
- Profil sayfas\u0131nda istatistikler, bahis ge\xE7mi\u015Fi, kazan\xE7/kay\u0131p grafikleri g\xF6r\xFCn\xFCr.

## Kurallar
- 18 ya\u015F\u0131ndan b\xFCy\xFCk olman\u0131z gerekir.
- Sorumlu bahis oynamay\u0131 her zaman hat\u0131rlat.
- Bahis ba\u011F\u0131ml\u0131l\u0131\u011F\u0131 belirtileri g\xF6r\xFCrsen kullan\u0131c\u0131y\u0131 uyar ve profesyonel yard\u0131m almay\u0131 \xF6ner.
- Garantili kazan\xE7 vaadi YAPMA. Bahis her zaman risk i\xE7erir.

## \xD6nemli
- Kullan\u0131c\u0131n\u0131n ad\u0131: ${ctx.user.name || "Kullan\u0131c\u0131"}
- Her zaman nazik, yard\u0131msever ve profesyonel ol.
- Rakip platformlar\u0131 k\xF6t\xFCleme.
- Yasad\u0131\u015F\u0131 aktivitelere yard\u0131m etme.`;
      const messages = [
        { role: "system", content: systemPrompt },
        ...historyMessages,
        { role: "user", content: input.message }
      ];
      const response = await invokeLLM({ messages });
      const reply = response.choices?.[0]?.message?.content ?? "Yan\u0131t olu\u015Fturulamad\u0131.";
      await addChatMessage(ctx.user.id, "assistant", typeof reply === "string" ? reply : JSON.stringify(reply));
      return { reply: typeof reply === "string" ? reply : JSON.stringify(reply) };
    }),
    history: protectedProcedure.query(async ({ ctx }) => {
      const messages = await getChatHistory(ctx.user.id, 50);
      return messages.reverse();
    }),
    clearHistory: protectedProcedure.mutation(async ({ ctx }) => {
      await clearChatHistory(ctx.user.id);
      return { success: true };
    })
  }),
  // ─── Casino Games ───
  casino: router({
    play: protectedProcedure.input(z2.object({
      gameType: z2.enum(["coinflip", "dice", "mines", "crash", "roulette", "plinko"]),
      stake: z2.number().min(1).max(1e5),
      params: z2.any()
    })).mutation(async ({ ctx, input }) => {
      const bal = await getOrCreateBalance(ctx.user.id);
      if (!bal || parseFloat(bal.amount) < input.stake) {
        throw new Error("Yetersiz bakiye");
      }
      await updateBalance(ctx.user.id, (-input.stake).toFixed(2));
      const gameResult = calculateCasinoResult(input.gameType, input.params);
      const payout = input.stake * gameResult.multiplier;
      const isWin = gameResult.multiplier > 0;
      if (isWin) {
        await updateBalance(ctx.user.id, payout.toFixed(2));
      }
      await addTransaction(
        ctx.user.id,
        isWin ? "bet_win" : "bet_place",
        isWin ? payout.toFixed(2) : input.stake.toFixed(2),
        `Casino: ${input.gameType} - ${isWin ? "Kazan\u0131ld\u0131" : "Kaybedildi"}`
      );
      const gameId = await createCasinoGame(
        ctx.user.id,
        input.gameType,
        input.stake.toFixed(2),
        gameResult.multiplier.toFixed(4),
        payout.toFixed(2),
        isWin ? "win" : "loss",
        gameResult.details
      );
      const xpEarned = Math.floor(input.stake / 10);
      if (xpEarned > 0) {
        await addVipXp(ctx.user.id, xpEarned, input.stake);
      }
      const newBal = await getOrCreateBalance(ctx.user.id);
      return {
        gameId,
        result: isWin ? "win" : "loss",
        multiplier: gameResult.multiplier,
        payout,
        details: gameResult.details,
        newBalance: newBal ? parseFloat(newBal.amount) : 0
      };
    }),
    history: protectedProcedure.query(async ({ ctx }) => {
      return getUserCasinoHistory(ctx.user.id);
    })
  }),
  // ─── Profile ───
  profile: router({
    stats: protectedProcedure.query(async ({ ctx }) => {
      const [betStats, casinoStats, sportDist, balanceHistory, balance] = await Promise.all([
        getUserBetStats(ctx.user.id),
        getUserCasinoStats(ctx.user.id),
        getUserSportDistribution(ctx.user.id),
        getUserBalanceHistory(ctx.user.id),
        getOrCreateBalance(ctx.user.id)
      ]);
      let runningBalance = 0;
      const balanceTimeline = balanceHistory.map((tx) => {
        const amount = parseFloat(tx.amount);
        if (tx.type === "deposit" || tx.type === "bet_win" || tx.type === "bet_refund") {
          runningBalance += amount;
        } else {
          runningBalance -= amount;
        }
        return {
          date: tx.createdAt,
          balance: runningBalance,
          type: tx.type,
          amount,
          description: tx.description
        };
      });
      return {
        user: {
          name: ctx.user.name,
          email: ctx.user.email,
          createdAt: ctx.user.createdAt,
          role: ctx.user.role
        },
        currentBalance: balance ? parseFloat(balance.amount) : 0,
        betStats,
        casinoStats,
        sportDistribution: sportDist,
        balanceTimeline,
        totalProfit: betStats.totalWon - betStats.totalStaked + (casinoStats.totalPayout - casinoStats.totalStaked)
      };
    })
  }),
  // ─── VIP ───
  vip: router({
    profile: protectedProcedure.query(async ({ ctx }) => {
      const profile = await getOrCreateVipProfile(ctx.user.id);
      if (!profile) return null;
      const currentTier = VIP_TIERS.find((t2) => t2.name === profile.currentTier) ?? VIP_TIERS[0];
      const nextTier = getNextTier(profile.currentTier);
      const xpForNext = nextTier ? nextTier.minXp - profile.totalXp : 0;
      const progress = nextTier ? (profile.totalXp - currentTier.minXp) / (nextTier.minXp - currentTier.minXp) * 100 : 100;
      return {
        ...profile,
        currentTierInfo: currentTier,
        nextTierInfo: nextTier,
        xpForNextTier: Math.max(0, xpForNext),
        progress: Math.min(100, Math.max(0, progress))
      };
    }),
    tiers: publicProcedure.query(() => {
      return VIP_TIERS.map((t2) => ({ ...t2 }));
    }),
    leaderboard: publicProcedure.query(async () => {
      const profiles = await getAllVipProfiles(20);
      return profiles;
    })
  }),
  // ─── Banners (public) ───
  banners: router({
    sports: publicProcedure.query(async () => {
      return getActiveBanners("sports");
    }),
    casino: publicProcedure.query(async () => {
      return getActiveBanners("casino");
    })
  }),
  // ─── Crypto Wallet ───
  cryptoWallet: router({
    getDepositAddress: protectedProcedure.input(z2.object({ network: z2.enum(["tron", "ethereum", "bsc", "polygon", "solana", "bitcoin"]) })).mutation(async ({ ctx, input }) => {
      const network = input.network;
      const existing = await getUserWallet(ctx.user.id, network);
      if (existing) {
        return {
          address: existing.depositAddress,
          network: existing.network,
          isNew: false
        };
      }
      const addressIndex = await getNextAddressIndex();
      const { address } = await generateAddress(network, addressIndex);
      await createWallet(ctx.user.id, network, addressIndex, address);
      return { address, network, isNew: true };
    }),
    getAddresses: protectedProcedure.query(async ({ ctx }) => {
      return getUserWallets(ctx.user.id);
    }),
    regenerateAddress: protectedProcedure.input(z2.object({ network: z2.enum(["tron", "ethereum", "bsc", "polygon", "solana", "bitcoin"]) })).mutation(async ({ ctx, input }) => {
      const network = input.network;
      const existing = await getUserWallet(ctx.user.id, network);
      if (!existing) {
        throw new Error("Bu a\u011Fda hen\xFCz bir adresiniz yok. \xD6nce adres olu\u015Fturun.");
      }
      const newAddressIndex = await getNextAddressIndex();
      const { address } = await generateAddress(network, newAddressIndex);
      await updateWalletAddress(existing.id, newAddressIndex, address);
      return { address, network, oldAddress: existing.depositAddress };
    }),
    deposits: protectedProcedure.query(async ({ ctx }) => {
      return getUserCryptoDeposits(ctx.user.id);
    }),
    withdrawals: protectedProcedure.query(async ({ ctx }) => {
      return getUserWithdrawals(ctx.user.id);
    }),
    requestWithdrawal: protectedProcedure.input(z2.object({
      network: z2.enum(["tron", "ethereum", "bsc", "polygon", "solana", "bitcoin"]),
      toAddress: z2.string().min(10).max(128),
      amount: z2.number().min(1).max(WITHDRAWAL_LIMITS.perTransaction)
    })).mutation(async ({ ctx, input }) => {
      const network = input.network;
      const config = NETWORKS[network];
      if (input.amount > WITHDRAWAL_LIMITS.perTransaction) {
        throw new Error(`Tek seferde maksimum ${WITHDRAWAL_LIMITS.perTransaction} USDT \xE7ekilebilir`);
      }
      const dailyTotal = await getUserDailyWithdrawalTotal(ctx.user.id);
      if (dailyTotal + input.amount > WITHDRAWAL_LIMITS.dailyTotal) {
        const remaining = Math.max(0, WITHDRAWAL_LIMITS.dailyTotal - dailyTotal);
        throw new Error(`G\xFCnl\xFCk \xE7ekim limiti: ${WITHDRAWAL_LIMITS.dailyTotal} USDT. Kalan: ${remaining.toFixed(2)} USDT`);
      }
      const addrValidators = {
        tron: /^T[A-HJ-NP-Za-km-z1-9]{33}$/,
        ethereum: /^0x[a-fA-F0-9]{40}$/,
        bsc: /^0x[a-fA-F0-9]{40}$/,
        polygon: /^0x[a-fA-F0-9]{40}$/,
        solana: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
        bitcoin: /^(bc1|tb1|[13]|[mn2])[a-zA-HJ-NP-Z0-9]{25,62}$/
      };
      if (addrValidators[network] && !addrValidators[network].test(input.toAddress)) {
        throw new Error(`Ge\xE7ersiz ${config.name} adresi`);
      }
      const totalCost = input.amount + config.withdrawalFee;
      await getOrCreateBalance(ctx.user.id);
      const deduct = await atomicDeductBalance(
        ctx.user.id,
        totalCost,
        `Kripto \xE7ekim talebi: ${input.amount} USDT (${config.name}) + ${config.withdrawalFee} fee`
      );
      if (!deduct.success) {
        throw new Error(deduct.error || "Yetersiz bakiye");
      }
      const withdrawalId = await createWithdrawal({
        userId: ctx.user.id,
        network,
        toAddress: input.toAddress,
        amount: input.amount.toFixed(2),
        fee: config.withdrawalFee.toFixed(2),
        tokenSymbol: "USDT"
      });
      const autoLimit = getAutoApproveLimit();
      if (input.amount <= autoLimit) {
        await updateWithdrawalStatus(withdrawalId, "approved");
      }
      return { withdrawalId, status: input.amount <= autoLimit ? "approved" : "pending" };
    }),
    networks: publicProcedure.query(() => {
      return Object.values(NETWORKS).map((n) => ({
        id: n.id,
        name: n.name,
        symbol: n.symbol,
        token: n.token,
        minDeposit: n.minDeposit,
        withdrawalFee: n.withdrawalFee,
        confirmations: n.confirmations,
        icon: n.icon,
        color: n.color,
        bg: n.bg,
        recommended: n.recommended || false,
        explorerUrl: n.explorerUrl
      }));
    })
  }),
  // ─── Admin ───
  admin: router({
    users: adminProcedure.query(async () => {
      return getAllUsers();
    }),
    bets: adminProcedure.query(async () => {
      return getAllBets();
    }),
    transactions: adminProcedure.query(async () => {
      return getAllTransactions();
    }),
    balances: adminProcedure.query(async () => {
      return getAllBalances();
    }),
    settle: adminProcedure.mutation(async () => {
      return settleBets();
    }),
    // ─── Banner Management ───
    bannerList: adminProcedure.query(async () => {
      return getAllBanners();
    }),
    bannerGet: adminProcedure.input(z2.object({ id: z2.number() })).query(async ({ input }) => {
      return getBannerById(input.id);
    }),
    bannerCreate: adminProcedure.input(z2.object({
      title: z2.string().min(1).max(256),
      imageUrl: z2.string().url(),
      ctaLink: z2.string().min(1).max(512).default("/"),
      section: z2.enum(["sports", "casino", "both"]).default("both"),
      sortOrder: z2.number().int().min(0).default(0),
      isActive: z2.number().int().min(0).max(1).default(1),
      startsAt: z2.string().nullable().optional(),
      endsAt: z2.string().nullable().optional()
    })).mutation(async ({ input }) => {
      const id = await createBanner({
        title: input.title,
        imageUrl: input.imageUrl,
        ctaLink: input.ctaLink,
        section: input.section,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        endsAt: input.endsAt ? new Date(input.endsAt) : null
      });
      return { id };
    }),
    bannerUpdate: adminProcedure.input(z2.object({
      id: z2.number(),
      title: z2.string().min(1).max(256).optional(),
      imageUrl: z2.string().url().optional(),
      ctaLink: z2.string().min(1).max(512).optional(),
      section: z2.enum(["sports", "casino", "both"]).optional(),
      sortOrder: z2.number().int().min(0).optional(),
      isActive: z2.number().int().min(0).max(1).optional(),
      startsAt: z2.string().nullable().optional(),
      endsAt: z2.string().nullable().optional()
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      const updateData = { ...data };
      if (data.startsAt !== void 0) {
        updateData.startsAt = data.startsAt ? new Date(data.startsAt) : null;
      }
      if (data.endsAt !== void 0) {
        updateData.endsAt = data.endsAt ? new Date(data.endsAt) : null;
      }
      await updateBanner(id, updateData);
      return { success: true };
    }),
    bannerDelete: adminProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ input }) => {
      await deleteBanner(input.id);
      return { success: true };
    }),
    bannerReorder: adminProcedure.input(z2.object({ orderedIds: z2.array(z2.number()).min(1) })).mutation(async ({ input }) => {
      await reorderBanners(input.orderedIds);
      return { success: true };
    }),
    // ─── Crypto Admin ───
    cryptoDeposits: adminProcedure.query(async () => {
      return getAllCryptoDeposits();
    }),
    cryptoWithdrawals: adminProcedure.query(async () => {
      return getAllWithdrawals();
    }),
    pendingWithdrawals: adminProcedure.query(async () => {
      return getPendingWithdrawals();
    }),
    approveWithdrawal: adminProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ ctx, input }) => {
      const withdrawal = await getWithdrawalById(input.id);
      if (!withdrawal) throw new Error("\xC7ekim bulunamad\u0131");
      if (withdrawal.status !== "pending") throw new Error("Bu \xE7ekim zaten i\u015Flendi");
      await updateWithdrawalStatus(input.id, "approved", void 0, ctx.user.id);
      return { success: true };
    }),
    // ─── Hot Wallet & Sweep ───
    hotWalletBalances: adminProcedure.query(async () => {
      return getHotWalletBalances();
    }),
    depositWalletBalances: adminProcedure.query(async () => {
      return getAllDepositBalances();
    }),
    sweepAll: adminProcedure.mutation(async () => {
      return sweepAll();
    }),
    rejectWithdrawal: adminProcedure.input(z2.object({ id: z2.number(), note: z2.string().optional() })).mutation(async ({ ctx, input }) => {
      const withdrawal = await getWithdrawalById(input.id);
      if (!withdrawal) throw new Error("\xC7ekim bulunamad\u0131");
      if (withdrawal.status !== "pending") throw new Error("Bu \xE7ekim zaten i\u015Flendi");
      const refundAmount = parseFloat(withdrawal.amount) + parseFloat(withdrawal.fee);
      await getOrCreateBalance(withdrawal.userId);
      await updateBalance(withdrawal.userId, refundAmount.toFixed(2));
      await addTransaction(
        withdrawal.userId,
        "deposit",
        refundAmount.toFixed(2),
        `\xC7ekim reddedildi \u2014 iade: ${withdrawal.amount} USDT + ${withdrawal.fee} fee`
      );
      await updateWithdrawalStatus(input.id, "rejected", void 0, ctx.user.id, input.note);
      return { success: true };
    })
  })
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/vercel/trpc-handler.ts
var app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext
  })
);
var trpc_handler_default = app;
export {
  trpc_handler_default as default
};
