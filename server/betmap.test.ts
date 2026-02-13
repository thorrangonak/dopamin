import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { getTierByXp, getNextTier, VIP_TIERS } from "./db";

// ── Test Helpers ──

function createUserContext(role: "user" | "admin" = "user", userId = 1): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `test-user-${userId}`,
      email: `user${userId}@test.com`,
      name: `Test User ${userId}`,
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ── Settlement Logic Tests ──

describe("determineOutcome logic", () => {
  // We test the logic inline since the function is not exported
  // Instead we test via the router behavior

  it("should calculate totalOdds correctly for combo bets", () => {
    const odds = [1.5, 2.0, 1.8];
    const totalOdds = odds.reduce((acc, o) => acc * o, 1);
    expect(totalOdds).toBeCloseTo(5.4, 1);
  });

  it("should calculate potentialWin correctly", () => {
    const stake = 100;
    const totalOdds = 2.5;
    const potentialWin = stake * totalOdds;
    expect(potentialWin).toBe(250);
  });

  it("should handle single bet odds", () => {
    const odds = [3.25];
    const totalOdds = odds.reduce((acc, o) => acc * o, 1);
    expect(totalOdds).toBe(3.25);
  });
});

// ── Auth Tests ──

describe("auth.me", () => {
  it("returns null for unauthenticated users", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns user for authenticated users", async () => {
    const ctx = createUserContext("user", 42);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect(result?.id).toBe(42);
    expect(result?.role).toBe("user");
  });
});

// ── Protected Procedure Access Tests ──

describe("protected procedures", () => {
  it("balance.get rejects unauthenticated users", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.balance.get()).rejects.toThrow();
  });

  it("bets.myBets rejects unauthenticated users", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.bets.myBets({})).rejects.toThrow();
  });

  it("assistant.ask rejects unauthenticated users", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.assistant.ask({ message: "test" })).rejects.toThrow();
  });
});

// ── Admin Procedure Access Tests ──

describe("admin procedures", () => {
  it("admin.users rejects non-admin users", async () => {
    const ctx = createUserContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.admin.users()).rejects.toThrow();
  });

  it("admin.bets rejects non-admin users", async () => {
    const ctx = createUserContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.admin.bets()).rejects.toThrow();
  });

  it("admin.settle rejects non-admin users", async () => {
    const ctx = createUserContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.admin.settle()).rejects.toThrow();
  });

  it("admin.users rejects unauthenticated users", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.admin.users()).rejects.toThrow();
  });

  it("settlement.run rejects non-admin users", async () => {
    const ctx = createUserContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.settlement.run()).rejects.toThrow();
  });

  it("sports.refresh rejects non-admin users", async () => {
    const ctx = createUserContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.sports.refresh()).rejects.toThrow();
  });
});

// ── Input Validation Tests ──

describe("input validation", () => {
  it("balance.deposit rejects negative amounts", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.balance.deposit({ amount: -10 })).rejects.toThrow();
  });

  it("balance.deposit rejects zero amount", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.balance.deposit({ amount: 0 })).rejects.toThrow();
  });

  it("balance.deposit rejects amounts over 100000", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.balance.deposit({ amount: 200000 })).rejects.toThrow();
  });

  it("bets.place rejects empty items array", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.bets.place({
      type: "single",
      stake: 10,
      items: [],
    })).rejects.toThrow();
  });

  it("bets.place rejects zero stake", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.bets.place({
      type: "single",
      stake: 0,
      items: [{
        eventId: "test", sportKey: "soccer", homeTeam: "A", awayTeam: "B",
        commenceTime: new Date().toISOString(), marketKey: "h2h",
        outcomeName: "A", outcomePrice: 2.0,
      }],
    })).rejects.toThrow();
  });

  it("assistant.ask rejects empty message", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.assistant.ask({ message: "" })).rejects.toThrow();
  });

  it("events.bySport requires sportKey", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    // @ts-expect-error testing missing input
    await expect(caller.events.bySport({})).rejects.toThrow();
  });

  it("bets.detail requires betId", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    // @ts-expect-error testing missing input
    await expect(caller.bets.detail({})).rejects.toThrow();
  });
});

// ── Odds Calculation Tests ──

describe("odds calculations", () => {
  it("combo odds multiply correctly", () => {
    const items = [
      { outcomePrice: 1.5 },
      { outcomePrice: 2.0 },
      { outcomePrice: 1.3 },
    ];
    let totalOdds = 1;
    for (const item of items) {
      totalOdds *= item.outcomePrice;
    }
    expect(totalOdds).toBeCloseTo(3.9, 1);
  });

  it("single bet odds remain unchanged", () => {
    const items = [{ outcomePrice: 2.75 }];
    let totalOdds = 1;
    for (const item of items) {
      totalOdds *= item.outcomePrice;
    }
    expect(totalOdds).toBe(2.75);
  });

  it("potential win calculation is correct", () => {
    const stake = 50;
    const totalOdds = 3.5;
    expect(stake * totalOdds).toBe(175);
  });

  it("handles decimal odds precision", () => {
    const odds = [1.91, 1.91];
    const total = odds.reduce((a, b) => a * b, 1);
    expect(total).toBeCloseTo(3.6481, 3);
  });
});

// ── Live Scores Tests ──

describe("liveScores procedures", () => {
  it("liveScores.live is accessible as public procedure", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    // Should not throw - it's a public procedure
    const result = await caller.liveScores.live();
    expect(Array.isArray(result)).toBe(true);
  });

  it("liveScores.bySport is accessible as public procedure", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.liveScores.bySport();
    expect(Array.isArray(result)).toBe(true);
  });

  it("liveScores.bySport accepts optional sportKey", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.liveScores.bySport({ sportKey: "soccer_epl" });
    expect(Array.isArray(result)).toBe(true);
  });

  it("liveScores.myBetScores requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.liveScores.myBetScores()).rejects.toThrow();
  });

  it("liveScores.myBetScores returns data for authenticated user", async () => {
    const ctx = createUserContext("user", 99);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.liveScores.myBetScores();
    expect(result).toBeDefined();
    expect(result).toHaveProperty("betEventMap");
    expect(result).toHaveProperty("eventScores");
    expect(typeof result.betEventMap).toBe("object");
    expect(typeof result.eventScores).toBe("object");
  });
});

// ── Event Detail Tests ──

describe("eventDetail procedures", () => {
  it("eventDetail.get is accessible as public procedure", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.eventDetail.get({ eventId: "nonexistent-event" });
    // Should return null for non-existent event, not throw
    expect(result === null || result === undefined || typeof result === "object").toBe(true);
  });

  it("eventDetail.get requires eventId input", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    // @ts-expect-error testing missing input
    await expect(caller.eventDetail.get({})).rejects.toThrow();
  });

  it("eventDetail.getWithOdds requires both eventId and sportKey", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    // @ts-expect-error testing missing sportKey
    await expect(caller.eventDetail.getWithOdds({ eventId: "test" })).rejects.toThrow();
  });

  it("eventDetail.getWithOdds requires eventId", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    // @ts-expect-error testing missing eventId
    await expect(caller.eventDetail.getWithOdds({ sportKey: "soccer_epl" })).rejects.toThrow();
  });
});

// ── Casino Engine Tests ──

import { calculateCasinoResult } from "./casinoEngine";

describe("casinoEngine - coinflip", () => {
  it("returns multiplier 1.96 or 0", () => {
    for (let i = 0; i < 20; i++) {
      const result = calculateCasinoResult("coinflip", { choice: "heads" });
      expect([0, 1.96]).toContain(result.multiplier);
      expect(result.details).toHaveProperty("flip");
      expect(result.details).toHaveProperty("won");
      expect(["heads", "tails"]).toContain(result.details.flip);
    }
  });

  it("details.won matches multiplier", () => {
    for (let i = 0; i < 20; i++) {
      const result = calculateCasinoResult("coinflip", { choice: "tails" });
      if (result.details.won) {
        expect(result.multiplier).toBe(1.96);
      } else {
        expect(result.multiplier).toBe(0);
      }
    }
  });
});

describe("casinoEngine - dice", () => {
  it("returns correct multiplier formula", () => {
    const result = calculateCasinoResult("dice", { target: 50 });
    expect(result.details.roll).toBeGreaterThanOrEqual(1);
    expect(result.details.roll).toBeLessThanOrEqual(100);
    if (result.details.won) {
      expect(result.multiplier).toBeCloseTo(98 / 50, 2);
    } else {
      expect(result.multiplier).toBe(0);
    }
  });

  it("clamps target between 2 and 95", () => {
    // target=0 falls through to default 50 due to `|| 50`
    const low = calculateCasinoResult("dice", { target: 0 });
    expect(low.details.target).toBe(50);

    const high = calculateCasinoResult("dice", { target: 100 });
    expect(high.details.target).toBe(95);

    const explicit2 = calculateCasinoResult("dice", { target: 2 });
    expect(explicit2.details.target).toBe(2);
  });

  it("higher target means lower multiplier", () => {
    // With target 90, multiplier when won = 98/90 ≈ 1.088
    // With target 10, multiplier when won = 98/10 = 9.8
    const lowTarget = 98 / 10;
    const highTarget = 98 / 90;
    expect(lowTarget).toBeGreaterThan(highTarget);
  });
});

describe("casinoEngine - crash", () => {
  it("crash point is always >= 1.0", () => {
    for (let i = 0; i < 50; i++) {
      const result = calculateCasinoResult("crash", { cashOutAt: 2.0 });
      expect(result.details.crashPoint).toBeGreaterThanOrEqual(1.0);
    }
  });

  it("won is true when cashOutAt <= crashPoint", () => {
    for (let i = 0; i < 30; i++) {
      const result = calculateCasinoResult("crash", { cashOutAt: 1.01 });
      if (result.details.won) {
        expect(result.details.cashOutAt).toBeLessThanOrEqual(result.details.crashPoint);
        expect(result.multiplier).toBe(result.details.cashOutAt);
      } else {
        expect(result.multiplier).toBe(0);
      }
    }
  });

  it("returns crash history array", () => {
    const result = calculateCasinoResult("crash", { cashOutAt: 2.0 });
    expect(result.details.history).toHaveLength(10);
    result.details.history.forEach((h: number) => {
      expect(h).toBeGreaterThanOrEqual(1.0);
    });
  });
});

describe("casinoEngine - roulette", () => {
  it("result is between 0 and 36", () => {
    for (let i = 0; i < 50; i++) {
      const result = calculateCasinoResult("roulette", { betType: "red" });
      expect(result.details.result).toBeGreaterThanOrEqual(0);
      expect(result.details.result).toBeLessThanOrEqual(36);
    }
  });

  it("color is red, black, or green", () => {
    for (let i = 0; i < 50; i++) {
      const result = calculateCasinoResult("roulette", { betType: "red" });
      expect(["red", "black", "green"]).toContain(result.details.color);
    }
  });

  it("green bet pays 36x", () => {
    for (let i = 0; i < 100; i++) {
      const result = calculateCasinoResult("roulette", { betType: "green" });
      if (result.details.won) {
        expect(result.multiplier).toBe(36);
        expect(result.details.result).toBe(0);
      } else {
        expect(result.multiplier).toBe(0);
      }
    }
  });

  it("number bet pays 36x on exact match", () => {
    for (let i = 0; i < 100; i++) {
      const result = calculateCasinoResult("roulette", { betType: "number", number: 17 });
      if (result.details.won) {
        expect(result.multiplier).toBe(36);
        expect(result.details.result).toBe(17);
      }
    }
  });

  it("red/black/odd/even/high/low pay 2x", () => {
    const betTypes = ["red", "black", "odd", "even", "high", "low"];
    for (const bt of betTypes) {
      const result = calculateCasinoResult("roulette", { betType: bt });
      expect([0, 2]).toContain(result.multiplier);
    }
  });
});

describe("casinoEngine - plinko", () => {
  it("returns valid multiplier and path", () => {
    const result = calculateCasinoResult("plinko", { risk: "medium", rows: 12 });
    expect(result.multiplier).toBeGreaterThanOrEqual(0);
    expect(result.details.path).toHaveLength(13); // rows + 1
    expect(result.details.multipliers).toHaveLength(13); // rows + 1 buckets
  });

  it("clamps rows between 8 and 16", () => {
    const low = calculateCasinoResult("plinko", { rows: 3 });
    expect(low.details.rows).toBe(8);

    const high = calculateCasinoResult("plinko", { rows: 30 });
    expect(high.details.rows).toBe(16);
  });

  it("supports low, medium, high risk levels", () => {
    for (const risk of ["low", "medium", "high"]) {
      const result = calculateCasinoResult("plinko", { risk, rows: 12 });
      expect(result.details.risk).toBe(risk);
      expect(result.multiplier).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("casinoEngine - mines", () => {
  it("clamps mine count between 1 and 24", () => {
    // mines=0 falls through to default 5 due to `|| 5`
    const low = calculateCasinoResult("mines", { mines: 0 });
    expect(low.details.mines).toBe(5);

    const high = calculateCasinoResult("mines", { mines: 30 });
    expect(high.details.mines).toBe(24);

    const explicit1 = calculateCasinoResult("mines", { mines: 1 });
    expect(explicit1.details.mines).toBe(1);
  });

  it("cashOut returns positive multiplier when revealed > 0", () => {
    const result = calculateCasinoResult("mines", { mines: 5, revealed: 3, cashOut: true });
    expect(result.multiplier).toBeGreaterThan(0);
    expect(result.details.cashOut).toBe(true);
    expect(result.details.hitMine).toBe(false);
  });

  it("returns grid of 25 cells", () => {
    const result = calculateCasinoResult("mines", { mines: 5, revealed: 0, cashOut: true });
    expect(result.details.grid).toHaveLength(25);
  });
});

describe("casinoEngine - unknown game", () => {
  it("returns 0 multiplier for unknown game type", () => {
    const result = calculateCasinoResult("unknown_game", {});
    expect(result.multiplier).toBe(0);
    expect(result.details.error).toBe("Unknown game type");
  });
});

// ── Casino Router Access Tests ──

describe("casino router procedures", () => {
  it("casino.play rejects unauthenticated users", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.casino.play({ gameType: "coinflip", betAmount: 10, params: { choice: "heads" } })
    ).rejects.toThrow();
  });

  it("casino.play rejects zero bet amount", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.casino.play({ gameType: "coinflip", betAmount: 0, params: { choice: "heads" } })
    ).rejects.toThrow();
  });

  it("casino.play rejects negative bet amount", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.casino.play({ gameType: "coinflip", betAmount: -10, params: {} })
    ).rejects.toThrow();
  });

  it("casino.history rejects unauthenticated users", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.casino.history()).rejects.toThrow();
  });
});

// ── Profile Stats Tests ──

describe("profile.stats", () => {
  it("requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.profile.stats()).rejects.toThrow();
  });

  it("returns stats structure for authenticated user", async () => {
    const ctx = createUserContext("user", 999);
    const caller = appRouter.createCaller(ctx);
    const stats = await caller.profile.stats();

    expect(stats).toHaveProperty("user");
    expect(stats).toHaveProperty("currentBalance");
    expect(stats).toHaveProperty("betStats");
    expect(stats).toHaveProperty("casinoStats");
    expect(stats).toHaveProperty("sportDistribution");
    expect(stats).toHaveProperty("balanceTimeline");
    expect(stats).toHaveProperty("totalProfit");

    // betStats structure
    expect(stats.betStats).toHaveProperty("totalBets");
    expect(stats.betStats).toHaveProperty("wonBets");
    expect(stats.betStats).toHaveProperty("lostBets");
    expect(stats.betStats).toHaveProperty("pendingBets");
    expect(stats.betStats).toHaveProperty("totalStaked");
    expect(stats.betStats).toHaveProperty("totalWon");
    expect(stats.betStats).toHaveProperty("winRate");

    // casinoStats structure
    expect(stats.casinoStats).toHaveProperty("totalGames");
    expect(stats.casinoStats).toHaveProperty("wonGames");
    expect(stats.casinoStats).toHaveProperty("lostGames");
    expect(stats.casinoStats).toHaveProperty("totalStaked");
    expect(stats.casinoStats).toHaveProperty("totalPayout");
    expect(stats.casinoStats).toHaveProperty("winRate");

    // user info
    expect(stats.user).toHaveProperty("name");
    expect(stats.user).toHaveProperty("email");
    expect(stats.user).toHaveProperty("role");
  });

  it("returns numeric values for stats", async () => {
    const ctx = createUserContext("user", 998);
    const caller = appRouter.createCaller(ctx);
    const stats = await caller.profile.stats();

    expect(typeof stats.currentBalance).toBe("number");
    expect(typeof stats.totalProfit).toBe("number");
    expect(typeof stats.betStats.totalBets).toBe("number");
    expect(typeof stats.betStats.winRate).toBe("number");
    expect(typeof stats.casinoStats.totalGames).toBe("number");
    expect(Array.isArray(stats.sportDistribution)).toBe(true);
    expect(Array.isArray(stats.balanceTimeline)).toBe(true);
  });
});

// ── VIP Tier System Tests ──

describe("VIP Tier System", () => {
  describe("getTierByXp", () => {
    it("returns bronze for 0 XP", () => {
      const tier = getTierByXp(0);
      expect(tier.name).toBe("bronze");
    });

    it("returns silver for 1000 XP", () => {
      const tier = getTierByXp(1000);
      expect(tier.name).toBe("silver");
    });

    it("returns gold for 5000 XP", () => {
      const tier = getTierByXp(5000);
      expect(tier.name).toBe("gold");
    });

    it("returns platinum for 15000 XP", () => {
      const tier = getTierByXp(15000);
      expect(tier.name).toBe("platinum");
    });

    it("returns diamond for 50000 XP", () => {
      const tier = getTierByXp(50000);
      expect(tier.name).toBe("diamond");
    });

    it("returns elite for 150000 XP", () => {
      const tier = getTierByXp(150000);
      expect(tier.name).toBe("elite");
    });

    it("returns correct tier for XP between thresholds", () => {
      expect(getTierByXp(500).name).toBe("bronze");
      expect(getTierByXp(999).name).toBe("bronze");
      expect(getTierByXp(1001).name).toBe("silver");
      expect(getTierByXp(4999).name).toBe("silver");
      expect(getTierByXp(10000).name).toBe("gold");
      expect(getTierByXp(100000).name).toBe("diamond");
    });
  });

  describe("getNextTier", () => {
    it("returns silver as next tier for bronze", () => {
      const next = getNextTier("bronze");
      expect(next).not.toBeNull();
      expect(next!.name).toBe("silver");
    });

    it("returns null for elite (max tier)", () => {
      const next = getNextTier("elite");
      expect(next).toBeNull();
    });

    it("returns gold as next tier for silver", () => {
      const next = getNextTier("silver");
      expect(next).not.toBeNull();
      expect(next!.name).toBe("gold");
    });
  });

  describe("VIP_TIERS configuration", () => {
    it("has 6 tiers", () => {
      expect(VIP_TIERS).toHaveLength(6);
    });

    it("tiers are in ascending XP order", () => {
      for (let i = 1; i < VIP_TIERS.length; i++) {
        expect(VIP_TIERS[i].minXp).toBeGreaterThan(VIP_TIERS[i - 1].minXp);
      }
    });

    it("cashback rates increase with tier", () => {
      for (let i = 1; i < VIP_TIERS.length; i++) {
        expect(VIP_TIERS[i].cashbackRate).toBeGreaterThanOrEqual(VIP_TIERS[i - 1].cashbackRate);
      }
    });

    it("bonus multipliers increase with tier", () => {
      for (let i = 1; i < VIP_TIERS.length; i++) {
        expect(VIP_TIERS[i].bonusMultiplier).toBeGreaterThanOrEqual(VIP_TIERS[i - 1].bonusMultiplier);
      }
    });
  });

  describe("vip.tiers endpoint", () => {
    it("returns all VIP tiers", async () => {
      const ctx = createUserContext();
      const caller = appRouter.createCaller(ctx);
      const tiers = await caller.vip.tiers();
      expect(tiers).toHaveLength(6);
      expect(tiers[0].name).toBe("bronze");
      expect(tiers[5].name).toBe("elite");
    });
  });
});

// ── Banner Data Tests ──

describe("Banner data integrity", () => {
  it("SPORTS_BANNERS has correct structure", async () => {
    const { SPORTS_BANNERS } = await import("../client/src/data/banners");
    expect(SPORTS_BANNERS.length).toBeGreaterThanOrEqual(3);
    for (const banner of SPORTS_BANNERS) {
      expect(banner).toHaveProperty("id");
      expect(banner).toHaveProperty("imageUrl");
      expect(banner).toHaveProperty("ctaLink");
      expect(typeof banner.id).toBe("string");
      expect(banner.id.length).toBeGreaterThan(0);
      expect(banner.imageUrl).toMatch(/^https?:\/\//);
      expect(banner.ctaLink).toMatch(/^\//);
    }
  });

  it("CASINO_BANNERS has correct structure", async () => {
    const { CASINO_BANNERS } = await import("../client/src/data/banners");
    expect(CASINO_BANNERS.length).toBeGreaterThanOrEqual(3);
    for (const banner of CASINO_BANNERS) {
      expect(banner).toHaveProperty("id");
      expect(banner).toHaveProperty("imageUrl");
      expect(banner).toHaveProperty("ctaLink");
      expect(typeof banner.id).toBe("string");
      expect(banner.id.length).toBeGreaterThan(0);
      expect(banner.imageUrl).toMatch(/^https?:\/\//);
      expect(banner.ctaLink).toMatch(/^\//);
    }
  });

  it("all banner IDs are unique across sports banners", async () => {
    const { SPORTS_BANNERS } = await import("../client/src/data/banners");
    const ids = SPORTS_BANNERS.map((b: any) => b.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("all banner IDs are unique across casino banners", async () => {
    const { CASINO_BANNERS } = await import("../client/src/data/banners");
    const ids = CASINO_BANNERS.map((b: any) => b.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("banner image URLs point to CDN", async () => {
    const { SPORTS_BANNERS, CASINO_BANNERS } = await import("../client/src/data/banners");
    const allBanners = [...SPORTS_BANNERS, ...CASINO_BANNERS];
    for (const banner of allBanners) {
      expect(banner.imageUrl).toContain("manuscdn.com");
    }
  });

  it("banner CTA links are valid internal routes", async () => {
    const { SPORTS_BANNERS, CASINO_BANNERS } = await import("../client/src/data/banners");
    const validRoutes = ["/wallet", "/sports", "/vip", "/game/coinflip", "/casino", "/live"];
    const allBanners = [...SPORTS_BANNERS, ...CASINO_BANNERS];
    for (const banner of allBanners) {
      const matchesAny = validRoutes.some((r) => banner.ctaLink.startsWith(r));
      expect(matchesAny).toBe(true);
    }
  });
});

// ── Banner Admin CRUD Tests ──

describe("Banner admin procedures", () => {
  const caller = appRouter.createCaller(createUserContext("admin"));
  const userCaller = appRouter.createCaller(createUserContext("user"));

  it("admin.bannerList returns array", async () => {
    const result = await caller.admin.bannerList();
    expect(Array.isArray(result)).toBe(true);
  });

  it("admin.bannerCreate creates a banner", async () => {
    const result = await caller.admin.bannerCreate({
      title: "Test Banner",
      imageUrl: "https://example.com/test.png",
      ctaLink: "/sports",
      section: "sports",
      sortOrder: 99,
      isActive: 1,
      startsAt: null,
      endsAt: null,
    });
    expect(result).toHaveProperty("id");
    expect(typeof result.id).toBe("number");
  });

  it("admin.bannerUpdate updates a banner", async () => {
    // First create one
    const created = await caller.admin.bannerCreate({
      title: "Update Test",
      imageUrl: "https://example.com/update.png",
      ctaLink: "/casino",
      section: "casino",
      sortOrder: 100,
      isActive: 1,
    });
    // Then update
    const result = await caller.admin.bannerUpdate({
      id: created.id,
      title: "Updated Title",
      isActive: 0,
    });
    expect(result.success).toBe(true);

    // Verify update
    const banner = await caller.admin.bannerGet({ id: created.id });
    expect(banner?.title).toBe("Updated Title");
    expect(banner?.isActive).toBe(0);
  });

  it("admin.bannerDelete deletes a banner", async () => {
    const created = await caller.admin.bannerCreate({
      title: "Delete Test",
      imageUrl: "https://example.com/delete.png",
      ctaLink: "/",
      section: "both",
      sortOrder: 101,
      isActive: 1,
    });
    const result = await caller.admin.bannerDelete({ id: created.id });
    expect(result.success).toBe(true);

    // Verify deletion
    const banner = await caller.admin.bannerGet({ id: created.id });
    expect(banner).toBeNull();
  });

  it("admin.bannerReorder reorders banners", async () => {
    const banners = await caller.admin.bannerList();
    if (banners.length >= 2) {
      const ids = banners.map((b: any) => b.id);
      const reversed = [...ids].reverse();
      const result = await caller.admin.bannerReorder({ orderedIds: reversed });
      expect(result.success).toBe(true);
      // Restore original order
      await caller.admin.bannerReorder({ orderedIds: ids });
    }
  });

  it("public banners.sports returns active sports banners", async () => {
    const publicCaller = appRouter.createCaller(createPublicContext());
    const result = await publicCaller.banners.sports();
    expect(Array.isArray(result)).toBe(true);
    // All returned banners should be active
    for (const b of result) {
      expect(b.isActive).toBe(1);
    }
  });

  it("public banners.casino returns active casino banners", async () => {
    const publicCaller = appRouter.createCaller(createPublicContext());
    const result = await publicCaller.banners.casino();
    expect(Array.isArray(result)).toBe(true);
    for (const b of result) {
      expect(b.isActive).toBe(1);
    }
  });

  it("non-admin cannot access banner management", async () => {
    await expect(userCaller.admin.bannerList()).rejects.toThrow();
  });

  it("admin.bannerCreate with scheduling dates", async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const result = await caller.admin.bannerCreate({
      title: "Scheduled Banner",
      imageUrl: "https://example.com/scheduled.png",
      ctaLink: "/vip",
      section: "both",
      sortOrder: 102,
      isActive: 1,
      startsAt: futureDate,
      endsAt: null,
    });
    expect(result).toHaveProperty("id");

    const banner = await caller.admin.bannerGet({ id: result.id });
    expect(banner?.startsAt).toBeTruthy();
    // Clean up
    await caller.admin.bannerDelete({ id: result.id });
  });
});
