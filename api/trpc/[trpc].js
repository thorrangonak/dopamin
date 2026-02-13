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
var resolveApiUrl = () => ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0 ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions` : "https://forge.manus.im/v1/chat/completions";
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
    model: "gemini-2.5-flash",
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
  payload.max_tokens = 32768;
  payload.thinking = {
    "budget_tokens": 128
  };
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
      return getActiveSports();
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
    bySport: publicProcedure.input(z2.object({ sportKey: z2.string() })).query(async ({ input }) => {
      try {
        const events = await fetchOdds(input.sportKey);
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
      } catch (err) {
        console.error("[Events] API error, using cache:", err?.message);
        const cached = await getEventsBySport(input.sportKey);
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
      return getLiveEvents();
    }),
    // Get events with scores for a sport (or all)
    bySport: publicProcedure.input(z2.object({ sportKey: z2.string().optional() }).optional()).query(async ({ input }) => {
      return getEventsWithScores(input?.sportKey);
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
    ask: protectedProcedure.input(z2.object({ message: z2.string().min(1).max(2e3) })).mutation(async ({ input }) => {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `Sen Dopamin bahis platformunun yapay zeka asistan\u0131s\u0131n. Kullan\u0131c\u0131lara spor bahisleri hakk\u0131nda bilgi ver, analiz yap ve \xF6nerilerde bulun. T\xFCrk\xE7e yan\u0131t ver. Bahis stratejileri, tak\u0131m analizleri ve istatistikler hakk\u0131nda yard\u0131mc\u0131 ol. Sorumlu bahis oynamay\u0131 her zaman hat\u0131rlat.`
          },
          { role: "user", content: input.message }
        ]
      });
      return {
        reply: response.choices?.[0]?.message?.content ?? "Yan\u0131t olu\u015Fturulamad\u0131."
      };
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
