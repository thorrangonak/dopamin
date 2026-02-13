import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { sdk } from "./_core/sdk";
import { hashPassword, verifyPassword } from "./_core/password";
import { z } from "zod";
import { fetchSports, fetchOdds, fetchScores } from "./oddsApi";
import { getDemoSports, getDemoEvents, getDemoLiveEventsClean } from "./demoData";
import {
  getOrCreateBalance, updateBalance, addTransaction, getUserTransactions,
  createBet, getUserBets, getBetWithItems, getBetItemsByBetId,
  upsertSport, getActiveSports, upsertEvent, getEventsBySport,
  getAllUsers, getAllBets, getAllTransactions, getAllBalances,
  getLiveEvents, getEventsWithScores, updateEventScores, getActiveEventSportKeys,
  getEventById, createCasinoGame, getUserCasinoHistory,
  getUserBetStats, getUserSportDistribution, getUserCasinoStats, getUserBalanceHistory,
  getOrCreateVipProfile, addVipXp, getAllVipProfiles, VIP_TIERS, getNextTier,
  getActiveBanners, getAllBanners, getBannerById, createBanner, updateBanner, deleteBanner, reorderBanners,
  upsertUser, getUserByEmail, getOrCreateBalance as ensureBalance,
  getChatHistory, addChatMessage, clearChatHistory,
  // Crypto wallet
  createWallet, getUserWallet, getUserWallets, getNextAddressIndex, updateWalletAddress,
  createCryptoDeposit, getUserCryptoDeposits, getAllCryptoDeposits,
  createWithdrawal, updateWithdrawalStatus, getWithdrawalById,
  getPendingWithdrawals, getUserWithdrawals, getAllWithdrawals,
  getUserDailyWithdrawalTotal,
  atomicDeductBalance,
  // Provably fair
  createProvablyFairSeed, getActiveSeed, incrementSeedNonce,
  updateSeedClientSeed, revealSeed, getSeedById,
  // Game sessions
  createGameSession, getActiveGameSession, getGameSessionById,
  completeGameSession, cancelGameSession,
  // Responsible gambling
  getResponsibleGamblingSettings, upsertResponsibleGamblingSettings,
  addResponsibleGamblingLog, getResponsibleGamblingLogs,
  getUserWagerTotal, getUserLossTotal,
  // RTP
  updateRtpTracking, getRtpReport, getRtpSummary, getAllCasinoGames,
} from "./db";
import { generateAddress } from "./lib/wallet/hdDerivation";
import { NETWORKS, NETWORK_IDS, type NetworkId, getAutoApproveLimit, WITHDRAWAL_LIMITS } from "./lib/wallet/index";
import { getAllDepositBalances, getHotWalletBalances, sweepAll } from "./lib/wallet/hotWallet";
import { settleBets } from "./settlement";
import {
  playCoinFlip, playDice, playRoulette, playPlinko, playCrash,
  generateMinePositions, calculateMinesMultiplier,
  playRockPaperScissors, playBingo,
  generateBlackjackDeck, handTotal, isBlackjack, dealerPlay, calculateBlackjackResult,
  type BlackjackCard,
  playKeno, playLimbo,
  generateHiloDeck, calculateHiloMultiplier,
  type HiloCard,
} from "./casinoEngine";
import {
  generateServerSeed, hashServerSeed, generateGameHmac,
} from "./provablyFair";
import { invokeLLM } from "./_core/llm";
import { TRPCError } from "@trpc/server";
import crypto from "crypto";

// ─── Helper: Get or create active seed for user ───
async function ensureActiveSeed(userId: number) {
  let seed = await getActiveSeed(userId);
  if (!seed) {
    const serverSeed = generateServerSeed();
    const serverSeedHash = hashServerSeed(serverSeed);
    const clientSeed = crypto.randomBytes(16).toString("hex");
    const seedId = await createProvablyFairSeed(userId, serverSeed, serverSeedHash, clientSeed);
    seed = await getSeedById(seedId!);
  }
  return seed!;
}

// ─── Helper: Run a single-round casino game with provably fair ───
async function runCasinoGame(
  userId: number,
  gameType: string,
  stake: number,
  computeResult: (hmac: string) => { multiplier: number; details: Record<string, any> },
) {
  // 1. Check balance
  const bal = await getOrCreateBalance(userId);
  if (!bal || parseFloat(bal.amount) < stake) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Yetersiz bakiye" });
  }

  // 2. Responsible gambling check
  await checkResponsibleGambling(userId, stake);

  // 3. Deduct stake
  await updateBalance(userId, (-stake).toFixed(2));

  // 4. Get seed, increment nonce, generate HMAC
  const seed = await ensureActiveSeed(userId);
  const nonce = await incrementSeedNonce(seed.id);
  const hmac = generateGameHmac(seed.serverSeed, seed.clientSeed, nonce);

  // 5. Compute result
  const gameResult = computeResult(hmac);
  const payout = stake * gameResult.multiplier;
  const isWin = gameResult.multiplier > 0;

  // 6. Credit winnings
  if (isWin) {
    await updateBalance(userId, payout.toFixed(2));
  }

  await addTransaction(
    userId,
    isWin ? "bet_win" : "bet_place",
    isWin ? payout.toFixed(2) : stake.toFixed(2),
    `Casino: ${gameType} - ${isWin ? "Kazanıldı" : "Kaybedildi"}`
  );

  // 7. Save game record
  const gameId = await createCasinoGame(
    userId, gameType, stake.toFixed(2),
    gameResult.multiplier.toFixed(4), payout.toFixed(2),
    isWin ? "win" : "loss",
    { ...gameResult.details, serverSeedHash: seed.serverSeedHash, clientSeed: seed.clientSeed, nonce, hmac },
  );

  // 8. VIP XP
  const xpEarned = Math.floor(stake / 10);
  if (xpEarned > 0) {
    await addVipXp(userId, xpEarned, stake);
  }

  // 9. RTP tracking
  await updateRtpTracking(gameType, stake, payout);

  const newBal = await getOrCreateBalance(userId);

  return {
    gameId,
    result: isWin ? "win" as const : "loss" as const,
    multiplier: gameResult.multiplier,
    payout,
    details: gameResult.details,
    newBalance: newBal ? parseFloat(newBal.amount) : 0,
    fairness: {
      serverSeedHash: seed.serverSeedHash,
      clientSeed: seed.clientSeed,
      nonce,
    },
  };
}

// ─── Responsible gambling check ───
async function checkResponsibleGambling(userId: number, wagerAmount: number) {
  const settings = await getResponsibleGamblingSettings(userId);
  if (!settings) return;

  // Self-exclusion check
  if (settings.selfExclusionUntil) {
    if (settings.selfExclusionType === "permanent" || new Date(settings.selfExclusionUntil) > new Date()) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Hesabınız kendi isteğinizle kısıtlanmıştır. Kısıtlama süresi dolana kadar oyun oynayamazsınız." });
    }
  }

  // Daily wager limit
  if (settings.wagerLimitDaily) {
    const dailyWager = await getUserWagerTotal(userId, 24);
    if (dailyWager + wagerAmount > parseFloat(settings.wagerLimitDaily)) {
      throw new TRPCError({ code: "FORBIDDEN", message: `Günlük bahis limitinize ulaştınız (${settings.wagerLimitDaily} USDT)` });
    }
  }
  // Weekly wager limit
  if (settings.wagerLimitWeekly) {
    const weeklyWager = await getUserWagerTotal(userId, 168);
    if (weeklyWager + wagerAmount > parseFloat(settings.wagerLimitWeekly)) {
      throw new TRPCError({ code: "FORBIDDEN", message: `Haftalık bahis limitinize ulaştınız (${settings.wagerLimitWeekly} USDT)` });
    }
  }
  // Monthly wager limit
  if (settings.wagerLimitMonthly) {
    const monthlyWager = await getUserWagerTotal(userId, 720);
    if (monthlyWager + wagerAmount > parseFloat(settings.wagerLimitMonthly)) {
      throw new TRPCError({ code: "FORBIDDEN", message: `Aylık bahis limitinize ulaştınız (${settings.wagerLimitMonthly} USDT)` });
    }
  }

  // Daily loss limit
  if (settings.lossLimitDaily) {
    const dailyLoss = await getUserLossTotal(userId, 24);
    if (dailyLoss > parseFloat(settings.lossLimitDaily)) {
      throw new TRPCError({ code: "FORBIDDEN", message: `Günlük kayıp limitinize ulaştınız (${settings.lossLimitDaily} USDT)` });
    }
  }
  // Weekly loss limit
  if (settings.lossLimitWeekly) {
    const weeklyLoss = await getUserLossTotal(userId, 168);
    if (weeklyLoss > parseFloat(settings.lossLimitWeekly)) {
      throw new TRPCError({ code: "FORBIDDEN", message: `Haftalık kayıp limitinize ulaştınız (${settings.lossLimitWeekly} USDT)` });
    }
  }
  // Monthly loss limit
  if (settings.lossLimitMonthly) {
    const monthlyLoss = await getUserLossTotal(userId, 720);
    if (monthlyLoss > parseFloat(settings.lossLimitMonthly)) {
      throw new TRPCError({ code: "FORBIDDEN", message: `Aylık kayıp limitinize ulaştınız (${settings.lossLimitMonthly} USDT)` });
    }
  }
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),

    register: publicProcedure
      .input(z.object({
        username: z.string().min(2).max(32),
        email: z.string().email().max(320),
        password: z.string().min(6).max(128),
      }))
      .mutation(async ({ ctx, input }) => {
        const existing = await getUserByEmail(input.email);
        if (existing) {
          throw new Error("Bu e-posta adresi zaten kayıtlı");
        }

        const openId = `email-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const hashed = hashPassword(input.password);

        await upsertUser({
          openId,
          name: input.username,
          email: input.email,
          passwordHash: hashed,
          loginMethod: "email",
          lastSignedIn: new Date(),
        });

        const user = await getUserByEmail(input.email);
        if (!user) throw new Error("Kayıt başarısız");

        // Create initial balance
        await ensureBalance(user.id);

        // Create session
        const sessionToken = await sdk.createSessionToken(openId, {
          name: input.username,
          expiresInMs: ONE_YEAR_MS,
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

        return { success: true, user: { id: user.id, name: user.name, email: user.email } };
      }),

    login: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = await getUserByEmail(input.email);
        if (!user || !user.passwordHash) {
          throw new Error("E-posta veya şifre hatalı");
        }

        if (!verifyPassword(input.password, user.passwordHash)) {
          throw new Error("E-posta veya şifre hatalı");
        }

        // Update last signed in
        await upsertUser({ openId: user.openId, lastSignedIn: new Date() });

        // Create session
        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name || "",
          expiresInMs: ONE_YEAR_MS,
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

        return { success: true, user: { id: user.id, name: user.name, email: user.email } };
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
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
              hasOutrights: s.has_outrights ? 1 : 0,
            });
          }
        }
        const result = await getActiveSports();
        if (result.length > 0) return result;
      } catch (err: any) {
        console.error("[Sports] API error, using demo data:", err?.message);
      }
      // Fallback to demo data
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
          hasOutrights: s.has_outrights ? 1 : 0,
        });
      }
      return { count: sports.length };
    }),
  }),

  // ─── Events & Odds ───
  events: router({
    featured: publicProcedure.query(async () => {
      const popularKeys = [
        "soccer_turkey_super_league", "soccer_epl", "soccer_spain_la_liga",
        "soccer_uefa_champs_league", "basketball_nba", "basketball_euroleague",
      ];
      const all: any[] = [];
      for (const sportKey of popularKeys) {
        // Try cache first
        const cached = await getEventsBySport(sportKey);
        if (cached.length > 0) {
          all.push(...cached.map(c => ({
            id: c.eventId, sport_key: c.sportKey, sport_title: "",
            commence_time: c.commenceTime.toISOString(),
            home_team: c.homeTeam, away_team: c.awayTeam,
            bookmakers: (c.oddsJson as any) ?? [],
          })));
        } else {
          // Demo fallback
          all.push(...getDemoEvents(sportKey));
        }
      }
      // Sort by commence_time
      all.sort((a, b) => new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime());
      return all;
    }),
    bySport: publicProcedure
      .input(z.object({ sportKey: z.string() }))
      .query(async ({ input }) => {
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
                oddsJson: e.bookmakers,
              });
            }
            return events;
          }
        } catch (err: any) {
          console.error("[Events] API error, trying cache:", err?.message);
        }
        // Try cache
        const cached = await getEventsBySport(input.sportKey);
        if (cached.length > 0) {
          return cached.map(c => ({
            id: c.eventId,
            sport_key: c.sportKey,
            sport_title: "",
            commence_time: c.commenceTime.toISOString(),
            home_team: c.homeTeam,
            away_team: c.awayTeam,
            bookmakers: (c.oddsJson as any) ?? [],
          }));
        }
        // Fallback to demo data
        return getDemoEvents(input.sportKey);
      }),
  }),

  // ─── Balance ───
  balance: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      return getOrCreateBalance(ctx.user.id);
    }),
    deposit: protectedProcedure
      .input(z.object({ amount: z.number().min(1).max(100000) }))
      .mutation(async ({ ctx, input }) => {
        await getOrCreateBalance(ctx.user.id);
        const bal = await updateBalance(ctx.user.id, input.amount.toFixed(2));
        await addTransaction(ctx.user.id, "deposit", input.amount.toFixed(2), `${input.amount} TL yatırıldı`);
        return bal;
      }),
    withdraw: protectedProcedure
      .input(z.object({ amount: z.number().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const bal = await getOrCreateBalance(ctx.user.id);
        if (!bal || parseFloat(bal.amount) < input.amount) {
          throw new Error("Yetersiz bakiye");
        }
        const updated = await updateBalance(ctx.user.id, (-input.amount).toFixed(2));
        await addTransaction(ctx.user.id, "withdraw", input.amount.toFixed(2), `${input.amount} TL çekildi`);
        return updated;
      }),
    transactions: protectedProcedure.query(async ({ ctx }) => {
      return getUserTransactions(ctx.user.id);
    }),
  }),

  // ─── Bets (Kuponlar) ───
  bets: router({
    place: protectedProcedure
      .input(z.object({
        type: z.enum(["single", "combo"]),
        stake: z.number().min(1),
        items: z.array(z.object({
          eventId: z.string(),
          sportKey: z.string(),
          homeTeam: z.string(),
          awayTeam: z.string(),
          commenceTime: z.string(),
          marketKey: z.string(),
          outcomeName: z.string(),
          outcomePrice: z.number(),
          point: z.number().optional(),
        })).min(1),
      }))
      .mutation(async ({ ctx, input }) => {
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
        await addTransaction(ctx.user.id, "bet_place", input.stake.toFixed(2), `Kupon oluşturuldu`);

        const betId = await createBet(
          ctx.user.id,
          input.type,
          input.stake.toFixed(2),
          totalOdds.toFixed(4),
          potentialWin.toFixed(2),
          input.items.map(i => ({
            eventId: i.eventId,
            sportKey: i.sportKey,
            homeTeam: i.homeTeam,
            awayTeam: i.awayTeam,
            commenceTime: new Date(i.commenceTime),
            marketKey: i.marketKey,
            outcomeName: i.outcomeName,
            outcomePrice: i.outcomePrice.toFixed(4),
            point: i.point?.toFixed(2),
          }))
        );

        // Award VIP XP: 1 XP per 10₺ wagered on sports bets
        const xpEarned = Math.floor(input.stake / 10);
        if (xpEarned > 0) {
          await addVipXp(ctx.user.id, xpEarned, input.stake);
        }

        return { betId, totalOdds, potentialWin };
      }),
    myBets: protectedProcedure
      .input(z.object({ status: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
        return getUserBets(ctx.user.id, input?.status);
      }),
    detail: protectedProcedure
      .input(z.object({ betId: z.number() }))
      .query(async ({ ctx, input }) => {
        const bet = await getBetWithItems(input.betId);
        if (!bet || bet.userId !== ctx.user.id) {
          throw new Error("Kupon bulunamadı");
        }
        return bet;
      }),
  }),

  // ─── Event Detail ───
  eventDetail: router({
    get: publicProcedure
      .input(z.object({ eventId: z.string() }))
      .query(async ({ input }) => {
        // First try to get from cache
        const cached = await getEventById(input.eventId);
        return cached;
      }),
    getWithOdds: publicProcedure
      .input(z.object({ eventId: z.string(), sportKey: z.string() }))
      .query(async ({ input }) => {
        // Fetch fresh odds for the sport and find this event
        try {
          const events = await fetchOdds(input.sportKey);
          const event = events.find(e => e.id === input.eventId);
          if (event) {
            // Update cache
            await upsertEvent({
              eventId: event.id,
              sportKey: event.sport_key,
              homeTeam: event.home_team,
              awayTeam: event.away_team,
              commenceTime: new Date(event.commence_time),
              oddsJson: event.bookmakers,
            });
            return event;
          }
        } catch (err: any) {
          console.error("[EventDetail] API error:", err?.message);
        }
        // Fallback to cache
        const cached = await getEventById(input.eventId);
        if (cached) {
          return {
            id: cached.eventId,
            sport_key: cached.sportKey,
            sport_title: "",
            commence_time: cached.commenceTime.toISOString(),
            home_team: cached.homeTeam,
            away_team: cached.awayTeam,
            bookmakers: (cached.oddsJson as any) ?? [],
          };
        }
        return null;
      }),
  }),

  // ─── Live Scores ───
  liveScores: router({
    // Get all live/in-progress events
    live: publicProcedure.query(async () => {
      const events = await getLiveEvents();
      if (events.length > 0) return events;
      // Fallback: demo live events
      return getDemoLiveEventsClean().filter(e => e.isLive === 1);
    }),
    // Get events with scores for a sport (or all)
    bySport: publicProcedure
      .input(z.object({ sportKey: z.string().optional() }).optional())
      .query(async ({ input }) => {
        const events = await getEventsWithScores(input?.sportKey);
        if (events.length > 0) return events;
        // Fallback: demo events with scores
        const demo = getDemoLiveEventsClean();
        if (input?.sportKey) return demo.filter(e => e.sportKey === input.sportKey);
        return demo;
      }),
    // Refresh scores from The Odds API
    refresh: publicProcedure.mutation(async () => {
      const sportKeys = await getActiveEventSportKeys();
      let updated = 0;
      for (const sportKey of sportKeys.slice(0, 5)) { // limit to 5 sports to conserve API credits
        try {
          const scores = await fetchScores(sportKey, 1);
          for (const s of scores) {
            const homeScoreVal = s.scores?.find(sc => sc.name === s.home_team);
            const awayScoreVal = s.scores?.find(sc => sc.name === s.away_team);
            const isLive = !s.completed && s.scores !== null;
            await updateEventScores(
              s.id,
              s.scores,
              isLive,
              s.completed,
              homeScoreVal ? parseInt(homeScoreVal.score) : undefined,
              awayScoreVal ? parseInt(awayScoreVal.score) : undefined,
            );
            updated++;
          }
        } catch (err: any) {
          console.error(`[LiveScores] Error fetching scores for ${sportKey}:`, err?.message);
        }
      }
      return { updated, sportsChecked: sportKeys.length };
    }),
    // Get scores for events in user's active bets
    myBetScores: protectedProcedure.query(async ({ ctx }) => {
      const userBets = await getUserBets(ctx.user.id, "pending");
      const eventIds = new Set<string>();
      const betEventMap: Record<number, string[]> = {};
      for (const bet of userBets) {
        const items = await getBetItemsByBetId(bet.id);
        betEventMap[bet.id] = items.map(i => i.eventId);
        for (const item of items) {
          eventIds.add(item.eventId);
        }
      }
      const liveEvents = await getLiveEvents();
      const allEvents = await getEventsWithScores();
      const eventScoreMap: Record<string, any> = {};
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
            scores: ev.scoresJson,
          };
        }
      }
      return { betEventMap, eventScores: eventScoreMap };
    }),
  }),

  // ─── Settlement ───
  settlement: router({
    run: adminProcedure.mutation(async () => {
      return settleBets();
    }),
  }),

  // ─── LLM Assistant ───
  assistant: router({
    chat: protectedProcedure
      .input(z.object({ message: z.string().min(1).max(2000) }))
      .mutation(async ({ ctx, input }) => {
        // Save user message
        await addChatMessage(ctx.user.id, "user", input.message);

        // Fetch recent history (last 20 messages for context)
        const history = await getChatHistory(ctx.user.id, 20);
        const historyMessages = history
          .reverse()
          .slice(0, -1) // exclude the message we just added (it's in input)
          .map(m => ({ role: m.role as "user" | "assistant", content: m.content }));

        const systemPrompt = `Sen "Dopamin" bahis ve casino platformunun resmi AI asistanısın. Adın "Dopamin AI". Kullanıcıya her konuda yardımcı ol. Türkçe yanıt ver. Kısa ve net cevaplar ver.

## Platform Hakkında
- Dopamin, spor bahisleri ve casino oyunları sunan bir platformdur.
- Para birimi USDT bazlıdır. Kullanıcılar farklı fiat para birimlerinde bakiyelerini görebilir (USD, EUR, TRY, vb.) ama dahili bakiye her zaman USDT'dir.
- Minimum bahis: 1 USDT, Minimum yatırım: 1 USDT.

## Spor Bahisleri
- Futbol, basketbol, tenis, Amerikan futbolu, buz hokeyi, beyzbol, MMA, boks, kriket, e-spor dahil birçok spor dalı mevcuttur.
- Bahis türleri: Maç Sonucu (1X2/H2H), Handikap (Spreads), Alt/Üst (Totals).
- Tekli ve kombine kuponlar oluşturulabilir.
- Canlı skorlar ve canlı bahis imkanı vardır.
- Kuponlar "Kuponlarım" sayfasından takip edilebilir.

## Casino Oyunları
- **Coin Flip**: Yazı-tura. 2x çarpan. %50 kazanma şansı.
- **Dice (Zar)**: 1-100 arası zar atma. Hedef belirlenir, altında veya üstünde kazanılır. Çarpan hedefe göre değişir.
- **Mines (Mayınlar)**: 5x5 ızgara, gizli mayınlar. Her güvenli kareyi açtıkça çarpan artar. Mayına basarsan kaybedersin. Mayın sayısı seçilebilir (1-24). Ne kadar çok mayın, o kadar yüksek çarpan.
- **Crash**: Çarpan 1x'ten yukarı çıkar. Uçak düşmeden "Cash Out" yapmalısın. Ne kadar geç çekersin, o kadar çok kazanırsın ama uçak düşerse her şeyi kaybedersin.
- **Roulette (Rulet)**: Avrupa ruleti (0-36). Kırmızı/Siyah, Tek/Çift, düz numara bahisleri yapılabilir.
- **Plinko**: Toplar piramit şeklindeki çivilerden düşer. Risk seviyesi (Düşük/Orta/Yüksek) ve satır sayısı seçilebilir.

## VIP Sistemi
- Her 10 USDT bahis = 1 XP kazandırır.
- Seviyeler: Bronze (0 XP), Silver (1000 XP), Gold (5000 XP), Platinum (15000 XP), Diamond (50000 XP), Elite (150000 XP).
- Cashback oranları: Bronze %0.5, Silver %1, Gold %2, Platinum %3.5, Diamond %5, Elite %8.
- Bonus çarpanları seviyeye göre artar.

## Cüzdan & Hesap
- Cüzdan sayfasından yatırma ve çekme işlemleri yapılır.
- Kripto (USDT) ile yatırım/çekim desteklenir.
- Profil sayfasında istatistikler, bahis geçmişi, kazanç/kayıp grafikleri görünür.

## Kurallar
- 18 yaşından büyük olmanız gerekir.
- Sorumlu bahis oynamayı her zaman hatırlat.
- Bahis bağımlılığı belirtileri görürsen kullanıcıyı uyar ve profesyonel yardım almayı öner.
- Garantili kazanç vaadi YAPMA. Bahis her zaman risk içerir.

## Önemli
- Kullanıcının adı: ${ctx.user.name || "Kullanıcı"}
- Her zaman nazik, yardımsever ve profesyonel ol.
- Rakip platformları kötüleme.
- Yasadışı aktivitelere yardım etme.`;

        const messages = [
          { role: "system" as const, content: systemPrompt },
          ...historyMessages,
          { role: "user" as const, content: input.message },
        ];

        const response = await invokeLLM({ messages });
        const reply = response.choices?.[0]?.message?.content ?? "Yanıt oluşturulamadı.";

        // Save assistant response
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
    }),
  }),

  // ─── Casino Games ───
  casino: router({
    // ── Per-game typed endpoints ──
    playCoinFlip: protectedProcedure
      .input(z.object({
        stake: z.number().min(1).max(100000),
        choice: z.enum(["heads", "tails"]),
      }))
      .mutation(async ({ ctx, input }) => {
        return runCasinoGame(ctx.user.id, "coinflip", input.stake, (hmac) =>
          playCoinFlip(hmac, { choice: input.choice })
        );
      }),

    playDice: protectedProcedure
      .input(z.object({
        stake: z.number().min(1).max(100000),
        target: z.number().min(2).max(95),
      }))
      .mutation(async ({ ctx, input }) => {
        return runCasinoGame(ctx.user.id, "dice", input.stake, (hmac) =>
          playDice(hmac, { target: input.target })
        );
      }),

    playRoulette: protectedProcedure
      .input(z.object({
        stake: z.number().min(1).max(100000),
        betType: z.enum(["red", "black", "green", "number", "odd", "even", "high", "low"]),
        number: z.number().min(0).max(36).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return runCasinoGame(ctx.user.id, "roulette", input.stake, (hmac) =>
          playRoulette(hmac, { betType: input.betType, number: input.number })
        );
      }),

    playPlinko: protectedProcedure
      .input(z.object({
        stake: z.number().min(1).max(100000),
        risk: z.enum(["low", "medium", "high"]),
        rows: z.number().min(8).max(16),
      }))
      .mutation(async ({ ctx, input }) => {
        return runCasinoGame(ctx.user.id, "plinko", input.stake, (hmac) =>
          playPlinko(hmac, { risk: input.risk, rows: input.rows })
        );
      }),

    playCrash: protectedProcedure
      .input(z.object({
        stake: z.number().min(1).max(100000),
        cashOutAt: z.number().min(1.01).max(1000000),
      }))
      .mutation(async ({ ctx, input }) => {
        return runCasinoGame(ctx.user.id, "crash", input.stake, (hmac) =>
          playCrash(hmac, { cashOutAt: input.cashOutAt })
        );
      }),

    playRPS: protectedProcedure
      .input(z.object({
        stake: z.number().min(1).max(100000),
        choice: z.enum(["rock", "paper", "scissors"]),
      }))
      .mutation(async ({ ctx, input }) => {
        return runCasinoGame(ctx.user.id, "rps", input.stake, (hmac) =>
          playRockPaperScissors(hmac, { choice: input.choice })
        );
      }),

    playBingo: protectedProcedure
      .input(z.object({
        stake: z.number().min(1).max(100000),
      }))
      .mutation(async ({ ctx, input }) => {
        return runCasinoGame(ctx.user.id, "bingo", input.stake, (hmac) =>
          playBingo(hmac, {})
        );
      }),

    playKeno: protectedProcedure
      .input(z.object({
        stake: z.number().min(1).max(100000),
        picks: z.array(z.number().min(1).max(40)).min(1).max(10),
      }))
      .mutation(async ({ ctx, input }) => {
        return runCasinoGame(ctx.user.id, "keno", input.stake, (hmac) =>
          playKeno(hmac, { picks: input.picks })
        );
      }),

    playLimbo: protectedProcedure
      .input(z.object({
        stake: z.number().min(1).max(100000),
        target: z.number().min(1.01).max(1000000),
      }))
      .mutation(async ({ ctx, input }) => {
        return runCasinoGame(ctx.user.id, "limbo", input.stake, (hmac) =>
          playLimbo(hmac, { target: input.target })
        );
      }),

    // ── Mines (session-based) ──
    startMines: protectedProcedure
      .input(z.object({
        stake: z.number().min(1).max(100000),
        mineCount: z.number().min(1).max(24),
      }))
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.user.id;

        // Cancel any existing active session
        const existingSession = await getActiveGameSession(userId, "mines");
        if (existingSession) {
          await cancelGameSession(existingSession.id);
        }

        // Balance + responsible gambling check
        const bal = await getOrCreateBalance(userId);
        if (!bal || parseFloat(bal.amount) < input.stake) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Yetersiz bakiye" });
        }
        await checkResponsibleGambling(userId, input.stake);

        // Deduct stake
        await updateBalance(userId, (-input.stake).toFixed(2));
        await addTransaction(userId, "bet_place", input.stake.toFixed(2), "Casino: mines - Oyun başlatıldı");

        // Generate mine positions using provably fair
        const seed = await ensureActiveSeed(userId);
        const nonce = await incrementSeedNonce(seed.id);
        const hmac = generateGameHmac(seed.serverSeed, seed.clientSeed, nonce);
        const minePositions = generateMinePositions(hmac, input.mineCount);

        // Commit hash for the mine positions
        const commitHash = crypto.createHash("sha256")
          .update(JSON.stringify(minePositions))
          .digest("hex");

        // Create session
        const sessionId = await createGameSession({
          userId,
          gameType: "mines",
          stake: input.stake.toFixed(2),
          serverSeedId: seed.id,
          nonce,
          gameData: { minePositions, mineCount: input.mineCount, revealedCells: [], hmac },
          commitHash,
        });

        const newBal = await getOrCreateBalance(userId);

        return {
          sessionId,
          commitHash,
          mineCount: input.mineCount,
          newBalance: newBal ? parseFloat(newBal.amount) : 0,
          fairness: {
            serverSeedHash: seed.serverSeedHash,
            clientSeed: seed.clientSeed,
            nonce,
          },
        };
      }),

    revealMine: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        cellIndex: z.number().min(0).max(24),
      }))
      .mutation(async ({ ctx, input }) => {
        const session = await getGameSessionById(input.sessionId);
        if (!session || session.userId !== ctx.user.id || session.status !== "active") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Geçersiz oyun oturumu" });
        }

        const gameData = session.gameData as any;
        const minePositions: number[] = gameData.minePositions;
        const revealedCells: number[] = gameData.revealedCells || [];

        if (revealedCells.includes(input.cellIndex)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Bu hücre zaten açılmış" });
        }

        const isMine = minePositions.includes(input.cellIndex);
        revealedCells.push(input.cellIndex);

        if (isMine) {
          // Hit mine — game over, loss
          await completeGameSession(input.sessionId, "loss", "0", "0");

          // Save game record
          await createCasinoGame(
            ctx.user.id, "mines", session.stake,
            "0", "0", "loss",
            { ...gameData, revealedCells, hitMine: true, hitCell: input.cellIndex },
          );

          // RTP tracking
          await updateRtpTracking("mines", parseFloat(session.stake), 0);

          // VIP XP
          const xpEarned = Math.floor(parseFloat(session.stake) / 10);
          if (xpEarned > 0) await addVipXp(ctx.user.id, xpEarned, parseFloat(session.stake));

          return {
            isMine: true,
            gameOver: true,
            minePositions,
            revealedCells,
            multiplier: 0,
            payout: 0,
          };
        }

        // Safe cell — update session gameData
        const newMultiplier = calculateMinesMultiplier(revealedCells.length, gameData.mineCount);
        const safeTotal = 25 - gameData.mineCount;
        const allRevealed = revealedCells.length >= safeTotal;

        // Update game data in session
        const updatedGameData = { ...gameData, revealedCells };

        // If all safe cells revealed, auto cash out
        if (allRevealed) {
          const payout = parseFloat(session.stake) * newMultiplier;
          await completeGameSession(input.sessionId, "win", newMultiplier.toFixed(4), payout.toFixed(2));
          await updateBalance(ctx.user.id, payout.toFixed(2));
          await addTransaction(ctx.user.id, "bet_win", payout.toFixed(2), `Casino: mines - Tüm hücreler açıldı (${newMultiplier}x)`);

          await createCasinoGame(
            ctx.user.id, "mines", session.stake,
            newMultiplier.toFixed(4), payout.toFixed(2), "win",
            { ...updatedGameData, cashOut: true, minePositions },
          );
          await updateRtpTracking("mines", parseFloat(session.stake), payout);
          const xpEarned = Math.floor(parseFloat(session.stake) / 10);
          if (xpEarned > 0) await addVipXp(ctx.user.id, xpEarned, parseFloat(session.stake));

          const newBal = await getOrCreateBalance(ctx.user.id);
          return {
            isMine: false,
            gameOver: true,
            minePositions,
            revealedCells,
            multiplier: newMultiplier,
            payout,
            newBalance: newBal ? parseFloat(newBal.amount) : 0,
          };
        }

        // Game continues — update gameData on session (just update via raw SQL for JSON)
        const { getDb } = await import("./db");
        const db = await getDb();
        if (db) {
          const { casinoGameSessions } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          await db.update(casinoGameSessions)
            .set({ gameData: updatedGameData })
            .where(eq(casinoGameSessions.id, input.sessionId));
        }

        return {
          isMine: false,
          gameOver: false,
          revealedCells,
          multiplier: newMultiplier,
          nextMultiplier: calculateMinesMultiplier(revealedCells.length + 1, gameData.mineCount),
          payout: parseFloat(session.stake) * newMultiplier,
        };
      }),

    cashOutMines: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const session = await getGameSessionById(input.sessionId);
        if (!session || session.userId !== ctx.user.id || session.status !== "active") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Geçersiz oyun oturumu" });
        }

        const gameData = session.gameData as any;
        const revealedCells: number[] = gameData.revealedCells || [];

        if (revealedCells.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "En az bir hücre açmalısınız" });
        }

        const multiplier = calculateMinesMultiplier(revealedCells.length, gameData.mineCount);
        const payout = parseFloat(session.stake) * multiplier;

        await completeGameSession(input.sessionId, "win", multiplier.toFixed(4), payout.toFixed(2));
        await updateBalance(ctx.user.id, payout.toFixed(2));
        await addTransaction(ctx.user.id, "bet_win", payout.toFixed(2), `Casino: mines - Cash Out (${multiplier}x)`);

        await createCasinoGame(
          ctx.user.id, "mines", session.stake,
          multiplier.toFixed(4), payout.toFixed(2), "win",
          { ...gameData, cashOut: true, minePositions: gameData.minePositions },
        );
        await updateRtpTracking("mines", parseFloat(session.stake), payout);
        const xpEarned = Math.floor(parseFloat(session.stake) / 10);
        if (xpEarned > 0) await addVipXp(ctx.user.id, xpEarned, parseFloat(session.stake));

        const newBal = await getOrCreateBalance(ctx.user.id);

        return {
          multiplier,
          payout,
          minePositions: gameData.minePositions,
          revealedCells,
          newBalance: newBal ? parseFloat(newBal.amount) : 0,
        };
      }),

    getActiveSession: protectedProcedure.query(async ({ ctx }) => {
      const session = await getActiveGameSession(ctx.user.id, "mines");
      if (!session) return null;
      const gameData = session.gameData as any;
      const revealedCells: number[] = gameData.revealedCells || [];
      return {
        sessionId: session.id,
        mineCount: gameData.mineCount,
        stake: parseFloat(session.stake),
        revealedCells,
        multiplier: revealedCells.length > 0 ? calculateMinesMultiplier(revealedCells.length, gameData.mineCount) : 0,
        nextMultiplier: calculateMinesMultiplier(revealedCells.length + 1, gameData.mineCount),
        commitHash: session.commitHash,
      };
    }),

    // ── Crash (session-based with manual cashout) ──
    startCrash: protectedProcedure
      .input(z.object({
        stake: z.number().min(1).max(100000),
      }))
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.user.id;

        // Cancel any existing active crash session
        const existingSession = await getActiveGameSession(userId, "crash");
        if (existingSession) {
          await cancelGameSession(existingSession.id);
        }

        // Balance + responsible gambling check
        const bal = await getOrCreateBalance(userId);
        if (!bal || parseFloat(bal.amount) < input.stake) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Yetersiz bakiye" });
        }
        await checkResponsibleGambling(userId, input.stake);

        // Deduct stake
        await updateBalance(userId, (-input.stake).toFixed(2));
        await addTransaction(userId, "bet_place", input.stake.toFixed(2), "Casino: crash - Oyun başlatıldı");

        // Generate crash point using provably fair
        const seed = await ensureActiveSeed(userId);
        const nonce = await incrementSeedNonce(seed.id);
        const hmac = generateGameHmac(seed.serverSeed, seed.clientSeed, nonce);

        // Compute crash point (same logic as playCrash engine)
        const h = parseInt(hmac.substring(0, 8), 16);
        let crashPoint: number;
        if (h % 33 === 0) {
          crashPoint = 1.0;
        } else {
          crashPoint = parseFloat(Math.max(1.0, (0.97 * 0x100000000) / (h + 1)).toFixed(2));
        }

        // Commit hash = SHA256(crashPoint) — client can verify later
        const commitHash = crypto.createHash("sha256")
          .update(String(crashPoint))
          .digest("hex");

        // Create session — crashPoint is stored server-side, NOT sent to client
        const sessionId = await createGameSession({
          userId,
          gameType: "crash",
          stake: input.stake.toFixed(2),
          serverSeedId: seed.id,
          nonce,
          gameData: { crashPoint, stake: input.stake, hmac },
          commitHash,
        });

        const newBal = await getOrCreateBalance(userId);

        return {
          sessionId,
          commitHash,
          newBalance: newBal ? parseFloat(newBal.amount) : 0,
          fairness: {
            serverSeedHash: seed.serverSeedHash,
            clientSeed: seed.clientSeed,
            nonce,
          },
        };
      }),

    crashCashOut: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        cashOutAt: z.number().min(1.0),
      }))
      .mutation(async ({ ctx, input }) => {
        const session = await getGameSessionById(input.sessionId);
        if (!session || session.userId !== ctx.user.id || session.status !== "active") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Geçersiz oyun oturumu" });
        }

        const gameData = session.gameData as any;
        const crashPoint: number = gameData.crashPoint;
        const stakeAmount = parseFloat(session.stake);

        const won = input.cashOutAt <= crashPoint;
        const multiplier = won ? input.cashOutAt : 0;
        const payout = won ? stakeAmount * input.cashOutAt : 0;

        // Complete session
        await completeGameSession(
          input.sessionId,
          won ? "win" : "loss",
          multiplier.toFixed(4),
          payout.toFixed(2),
        );

        // Credit winnings
        if (won) {
          await updateBalance(ctx.user.id, payout.toFixed(2));
          await addTransaction(ctx.user.id, "bet_win", payout.toFixed(2), `Casino: crash - Cash Out (${input.cashOutAt.toFixed(2)}x)`);
        } else {
          await addTransaction(ctx.user.id, "bet_place", stakeAmount.toFixed(2), `Casino: crash - Patladı (${crashPoint}x)`);
        }

        // Save game record
        await createCasinoGame(
          ctx.user.id, "crash", session.stake,
          multiplier.toFixed(4), payout.toFixed(2),
          won ? "win" : "loss",
          { crashPoint, cashOutAt: input.cashOutAt, won, hmac: gameData.hmac },
        );

        // RTP tracking
        await updateRtpTracking("crash", stakeAmount, payout);

        // VIP XP
        const xpEarned = Math.floor(stakeAmount / 10);
        if (xpEarned > 0) await addVipXp(ctx.user.id, xpEarned, stakeAmount);

        const newBal = await getOrCreateBalance(ctx.user.id);

        return {
          won,
          crashPoint,
          multiplier,
          payout,
          newBalance: newBal ? parseFloat(newBal.amount) : 0,
        };
      }),

    getActiveCrashSession: protectedProcedure.query(async ({ ctx }) => {
      const session = await getActiveGameSession(ctx.user.id, "crash");
      if (!session) return null;
      return {
        sessionId: session.id,
        stake: parseFloat(session.stake),
        commitHash: session.commitHash,
      };
    }),

    // ── Blackjack (session-based) ──
    startBlackjack: protectedProcedure
      .input(z.object({
        stake: z.number().min(1).max(100000),
      }))
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.user.id;

        // Cancel any existing active blackjack session
        const existingSession = await getActiveGameSession(userId, "blackjack");
        if (existingSession) {
          await cancelGameSession(existingSession.id);
        }

        // Balance + responsible gambling check
        const bal = await getOrCreateBalance(userId);
        if (!bal || parseFloat(bal.amount) < input.stake) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Yetersiz bakiye" });
        }
        await checkResponsibleGambling(userId, input.stake);

        // Deduct stake
        await updateBalance(userId, (-input.stake).toFixed(2));
        await addTransaction(userId, "bet_place", input.stake.toFixed(2), "Casino: blackjack - Oyun başlatıldı");

        // Generate deck using provably fair
        const seed = await ensureActiveSeed(userId);
        const nonce = await incrementSeedNonce(seed.id);
        const hmac = generateGameHmac(seed.serverSeed, seed.clientSeed, nonce);
        const deck = generateBlackjackDeck(hmac);

        // Deal: player gets cards 0,2; dealer gets 1,3
        const playerCards = [deck[0], deck[2]];
        const dealerCards = [deck[1], deck[3]];
        let nextIdx = 4;

        const commitHash = crypto.createHash("sha256")
          .update(JSON.stringify(deck.map(c => `${c.rank}${c.suit}`)))
          .digest("hex");

        // Check for naturals (blackjack)
        const playerBJ = isBlackjack(playerCards);
        const dealerBJ = isBlackjack(dealerCards);

        if (playerBJ || dealerBJ) {
          // Instant resolve
          const bjResult = calculateBlackjackResult(playerCards, dealerCards, false);
          const payout = input.stake * bjResult.multiplier;
          const isWin = bjResult.multiplier > 0;

          if (isWin) {
            await updateBalance(userId, payout.toFixed(2));
          }
          await addTransaction(
            userId, isWin ? "bet_win" : "bet_place",
            isWin ? payout.toFixed(2) : input.stake.toFixed(2),
            `Casino: blackjack - ${bjResult.result === "blackjack" ? "Blackjack!" : bjResult.result === "push" ? "Push" : "Kaybedildi"}`
          );

          await createCasinoGame(
            userId, "blackjack", input.stake.toFixed(2),
            bjResult.multiplier.toFixed(4), payout.toFixed(2),
            bjResult.multiplier > 1 ? "win" : bjResult.multiplier === 1 ? "win" : "loss",
            { playerCards, dealerCards, result: bjResult.result, hmac },
          );
          await updateRtpTracking("blackjack", input.stake, payout);
          const xpEarned = Math.floor(input.stake / 10);
          if (xpEarned > 0) await addVipXp(userId, xpEarned, input.stake);

          const newBal = await getOrCreateBalance(userId);
          return {
            sessionId: null,
            gameOver: true,
            playerCards,
            dealerCards,
            playerTotal: handTotal(playerCards),
            dealerTotal: handTotal(dealerCards),
            result: bjResult.result,
            multiplier: bjResult.multiplier,
            payout,
            newBalance: newBal ? parseFloat(newBal.amount) : 0,
            commitHash,
            fairness: { serverSeedHash: seed.serverSeedHash, clientSeed: seed.clientSeed, nonce },
          };
        }

        // Create session — game continues
        const sessionId = await createGameSession({
          userId,
          gameType: "blackjack",
          stake: input.stake.toFixed(2),
          serverSeedId: seed.id,
          nonce,
          gameData: { deck, playerCards, dealerCards, nextIdx, isDouble: false, hmac },
          commitHash,
        });

        const newBal = await getOrCreateBalance(userId);

        return {
          sessionId,
          gameOver: false,
          playerCards,
          dealerCards: [dealerCards[0]], // Hide hole card
          playerTotal: handTotal(playerCards),
          dealerTotal: dealerCards[0].value,
          result: null,
          multiplier: null,
          payout: null,
          newBalance: newBal ? parseFloat(newBal.amount) : 0,
          commitHash,
          fairness: { serverSeedHash: seed.serverSeedHash, clientSeed: seed.clientSeed, nonce },
        };
      }),

    blackjackAction: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        action: z.enum(["hit", "stand", "double"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const session = await getGameSessionById(input.sessionId);
        if (!session || session.userId !== ctx.user.id || session.status !== "active") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Geçersiz oyun oturumu" });
        }

        const gameData = session.gameData as any;
        let { deck, playerCards, dealerCards, nextIdx, isDouble } = gameData as {
          deck: BlackjackCard[];
          playerCards: BlackjackCard[];
          dealerCards: BlackjackCard[];
          nextIdx: number;
          isDouble: boolean;
        };

        const stakeAmount = parseFloat(session.stake);

        if (input.action === "double") {
          // Check balance for double
          const bal = await getOrCreateBalance(ctx.user.id);
          if (!bal || parseFloat(bal.amount) < stakeAmount) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Double için yetersiz bakiye" });
          }
          await updateBalance(ctx.user.id, (-stakeAmount).toFixed(2));
          await addTransaction(ctx.user.id, "bet_place", stakeAmount.toFixed(2), "Casino: blackjack - Double Down");
          isDouble = true;

          // Deal one card, then auto-stand
          playerCards = [...playerCards, deck[nextIdx++]];
          const playerTotal = handTotal(playerCards);

          if (playerTotal > 21) {
            // Bust
            await completeGameSession(input.sessionId, "loss", "0", "0");
            await createCasinoGame(
              ctx.user.id, "blackjack", (stakeAmount * 2).toFixed(2),
              "0", "0", "loss",
              { playerCards, dealerCards, result: "loss", bust: true, isDouble: true, hmac: gameData.hmac },
            );
            await updateRtpTracking("blackjack", stakeAmount * 2, 0);
            const xpEarned = Math.floor((stakeAmount * 2) / 10);
            if (xpEarned > 0) await addVipXp(ctx.user.id, xpEarned, stakeAmount * 2);

            return {
              gameOver: true,
              playerCards,
              dealerCards,
              playerTotal,
              dealerTotal: handTotal(dealerCards),
              result: "loss" as const,
              multiplier: 0,
              payout: 0,
              newBalance: (await getOrCreateBalance(ctx.user.id))?.amount ? parseFloat((await getOrCreateBalance(ctx.user.id))!.amount) : 0,
            };
          }

          // Auto stand — dealer plays
          const dealerResult = dealerPlay(deck, dealerCards, nextIdx);
          dealerCards = dealerResult.dealerCards;
          nextIdx = dealerResult.nextIdx;

          const bjResult = calculateBlackjackResult(playerCards, dealerCards, true);
          const totalStake = stakeAmount * 2;
          const payout = totalStake / 2 * bjResult.multiplier; // multiplier already accounts for double
          const isWin = bjResult.multiplier > 0;

          await completeGameSession(input.sessionId, isWin ? "win" : "loss", bjResult.multiplier.toFixed(4), payout.toFixed(2));
          if (isWin) await updateBalance(ctx.user.id, payout.toFixed(2));
          await addTransaction(
            ctx.user.id, isWin ? "bet_win" : "bet_place",
            isWin ? payout.toFixed(2) : totalStake.toFixed(2),
            `Casino: blackjack - ${bjResult.result === "push" ? "Push" : isWin ? "Kazanıldı" : "Kaybedildi"} (Double)`
          );

          await createCasinoGame(
            ctx.user.id, "blackjack", totalStake.toFixed(2),
            bjResult.multiplier.toFixed(4), payout.toFixed(2),
            isWin ? "win" : "loss",
            { playerCards, dealerCards, result: bjResult.result, isDouble: true, hmac: gameData.hmac },
          );
          await updateRtpTracking("blackjack", totalStake, payout);
          const xpEarned = Math.floor(totalStake / 10);
          if (xpEarned > 0) await addVipXp(ctx.user.id, xpEarned, totalStake);

          const newBal = await getOrCreateBalance(ctx.user.id);
          return {
            gameOver: true,
            playerCards,
            dealerCards,
            playerTotal: handTotal(playerCards),
            dealerTotal: handTotal(dealerCards),
            result: bjResult.result,
            multiplier: bjResult.multiplier,
            payout,
            newBalance: newBal ? parseFloat(newBal.amount) : 0,
          };
        }

        if (input.action === "hit") {
          playerCards = [...playerCards, deck[nextIdx++]];
          const playerTotal = handTotal(playerCards);

          if (playerTotal > 21) {
            // Bust
            await completeGameSession(input.sessionId, "loss", "0", "0");
            await createCasinoGame(
              ctx.user.id, "blackjack", session.stake,
              "0", "0", "loss",
              { playerCards, dealerCards, result: "loss", bust: true, hmac: gameData.hmac },
            );
            await updateRtpTracking("blackjack", stakeAmount, 0);
            const xpEarned = Math.floor(stakeAmount / 10);
            if (xpEarned > 0) await addVipXp(ctx.user.id, xpEarned, stakeAmount);

            return {
              gameOver: true,
              playerCards,
              dealerCards,
              playerTotal,
              dealerTotal: handTotal(dealerCards),
              result: "loss" as const,
              multiplier: 0,
              payout: 0,
              newBalance: (await getOrCreateBalance(ctx.user.id))?.amount ? parseFloat((await getOrCreateBalance(ctx.user.id))!.amount) : 0,
            };
          }

          // Game continues — update session
          const { getDb } = await import("./db");
          const db = await getDb();
          if (db) {
            const { casinoGameSessions } = await import("../drizzle/schema");
            const { eq } = await import("drizzle-orm");
            await db.update(casinoGameSessions)
              .set({ gameData: { ...gameData, playerCards, nextIdx, isDouble } })
              .where(eq(casinoGameSessions.id, input.sessionId));
          }

          return {
            gameOver: false,
            playerCards,
            dealerCards: [dealerCards[0]], // Still hide hole card
            playerTotal,
            dealerTotal: dealerCards[0].value,
            result: null,
            multiplier: null,
            payout: null,
          };
        }

        // Stand — dealer plays
        const dealerResult = dealerPlay(deck, dealerCards, nextIdx);
        dealerCards = dealerResult.dealerCards;

        const bjResult = calculateBlackjackResult(playerCards, dealerCards, isDouble);
        const payout = stakeAmount * bjResult.multiplier;
        const isWin = bjResult.multiplier > 0;

        await completeGameSession(input.sessionId, isWin ? "win" : "loss", bjResult.multiplier.toFixed(4), payout.toFixed(2));
        if (isWin) await updateBalance(ctx.user.id, payout.toFixed(2));
        await addTransaction(
          ctx.user.id, isWin ? "bet_win" : "bet_place",
          isWin ? payout.toFixed(2) : stakeAmount.toFixed(2),
          `Casino: blackjack - ${bjResult.result === "push" ? "Push" : isWin ? "Kazanıldı" : "Kaybedildi"}`
        );

        await createCasinoGame(
          ctx.user.id, "blackjack", session.stake,
          bjResult.multiplier.toFixed(4), payout.toFixed(2),
          isWin ? "win" : "loss",
          { playerCards, dealerCards, result: bjResult.result, hmac: gameData.hmac },
        );
        await updateRtpTracking("blackjack", stakeAmount, payout);
        const xpEarned = Math.floor(stakeAmount / 10);
        if (xpEarned > 0) await addVipXp(ctx.user.id, xpEarned, stakeAmount);

        const newBal = await getOrCreateBalance(ctx.user.id);
        return {
          gameOver: true,
          playerCards,
          dealerCards,
          playerTotal: handTotal(playerCards),
          dealerTotal: handTotal(dealerCards),
          result: bjResult.result,
          multiplier: bjResult.multiplier,
          payout,
          newBalance: newBal ? parseFloat(newBal.amount) : 0,
        };
      }),

    getActiveBlackjackSession: protectedProcedure.query(async ({ ctx }) => {
      const session = await getActiveGameSession(ctx.user.id, "blackjack");
      if (!session) return null;
      const gameData = session.gameData as any;
      return {
        sessionId: session.id,
        stake: parseFloat(session.stake),
        playerCards: gameData.playerCards,
        dealerCards: [gameData.dealerCards[0]], // Hide hole card
        playerTotal: handTotal(gameData.playerCards),
        dealerTotal: gameData.dealerCards[0].value,
        commitHash: session.commitHash,
      };
    }),

    // ── Hilo (session-based) ──
    startHilo: protectedProcedure
      .input(z.object({
        stake: z.number().min(1).max(100000),
      }))
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.user.id;

        // Cancel any existing active hilo session
        const existingSession = await getActiveGameSession(userId, "hilo");
        if (existingSession) {
          await cancelGameSession(existingSession.id);
        }

        // Balance + responsible gambling check
        const bal = await getOrCreateBalance(userId);
        if (!bal || parseFloat(bal.amount) < input.stake) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Yetersiz bakiye" });
        }
        await checkResponsibleGambling(userId, input.stake);

        // Deduct stake
        await updateBalance(userId, (-input.stake).toFixed(2));
        await addTransaction(userId, "bet_place", input.stake.toFixed(2), "Casino: hilo - Oyun başlatıldı");

        // Generate deck using provably fair
        const seed = await ensureActiveSeed(userId);
        const nonce = await incrementSeedNonce(seed.id);
        const hmac = generateGameHmac(seed.serverSeed, seed.clientSeed, nonce);
        const deck = generateHiloDeck(hmac);

        const commitHash = crypto.createHash("sha256")
          .update(JSON.stringify(deck.map(c => `${c.rank}${c.suit}`)))
          .digest("hex");

        // First card is revealed
        const currentCard = deck[0];

        const sessionId = await createGameSession({
          userId,
          gameType: "hilo",
          stake: input.stake.toFixed(2),
          serverSeedId: seed.id,
          nonce,
          gameData: { deck, currentCardIdx: 0, correctGuesses: 0, currentMultiplier: 1, hmac },
          commitHash,
        });

        const newBal = await getOrCreateBalance(userId);

        return {
          sessionId,
          currentCard,
          commitHash,
          newBalance: newBal ? parseFloat(newBal.amount) : 0,
          fairness: { serverSeedHash: seed.serverSeedHash, clientSeed: seed.clientSeed, nonce },
        };
      }),

    hiloGuess: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        guess: z.enum(["higher", "lower"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const session = await getGameSessionById(input.sessionId);
        if (!session || session.userId !== ctx.user.id || session.status !== "active") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Geçersiz oyun oturumu" });
        }

        const gameData = session.gameData as any;
        const deck: HiloCard[] = gameData.deck;
        let { currentCardIdx, correctGuesses, currentMultiplier } = gameData as {
          currentCardIdx: number;
          correctGuesses: number;
          currentMultiplier: number;
        };

        const currentCard = deck[currentCardIdx];
        const nextCardIdx = currentCardIdx + 1;

        if (nextCardIdx >= deck.length) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Deste bitti" });
        }

        const nextCard = deck[nextCardIdx];

        // Determine if guess is correct (strict: equal = loss)
        const isCorrect =
          (input.guess === "higher" && nextCard.numericValue > currentCard.numericValue) ||
          (input.guess === "lower" && nextCard.numericValue < currentCard.numericValue);

        if (!isCorrect) {
          // Wrong guess — game over, loss
          await completeGameSession(input.sessionId, "loss", "0", "0");
          await createCasinoGame(
            ctx.user.id, "hilo", session.stake,
            "0", "0", "loss",
            { currentCard, nextCard, guess: input.guess, correctGuesses, hmac: gameData.hmac },
          );
          await updateRtpTracking("hilo", parseFloat(session.stake), 0);
          const xpEarned = Math.floor(parseFloat(session.stake) / 10);
          if (xpEarned > 0) await addVipXp(ctx.user.id, xpEarned, parseFloat(session.stake));

          return {
            correct: false,
            gameOver: true,
            currentCard,
            nextCard,
            correctGuesses,
            multiplier: 0,
            payout: 0,
          };
        }

        // Correct guess
        const roundMultiplier = calculateHiloMultiplier(currentCard, input.guess);
        correctGuesses++;
        currentMultiplier = parseFloat((currentMultiplier * roundMultiplier).toFixed(4));

        // Update session
        const { getDb } = await import("./db");
        const db = await getDb();
        if (db) {
          const { casinoGameSessions } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          await db.update(casinoGameSessions)
            .set({ gameData: { ...gameData, currentCardIdx: nextCardIdx, correctGuesses, currentMultiplier } })
            .where(eq(casinoGameSessions.id, input.sessionId));
        }

        // Check if deck is about to run out (auto cash out at 51 cards)
        if (nextCardIdx >= 50) {
          const payout = parseFloat(session.stake) * currentMultiplier;
          await completeGameSession(input.sessionId, "win", currentMultiplier.toFixed(4), payout.toFixed(2));
          await updateBalance(ctx.user.id, payout.toFixed(2));
          await addTransaction(ctx.user.id, "bet_win", payout.toFixed(2), `Casino: hilo - Deste bitti! (${currentMultiplier}x)`);
          await createCasinoGame(
            ctx.user.id, "hilo", session.stake,
            currentMultiplier.toFixed(4), payout.toFixed(2), "win",
            { correctGuesses, currentMultiplier, hmac: gameData.hmac },
          );
          await updateRtpTracking("hilo", parseFloat(session.stake), payout);
          const xpEarned = Math.floor(parseFloat(session.stake) / 10);
          if (xpEarned > 0) await addVipXp(ctx.user.id, xpEarned, parseFloat(session.stake));

          const newBal = await getOrCreateBalance(ctx.user.id);
          return {
            correct: true,
            gameOver: true,
            currentCard,
            nextCard,
            correctGuesses,
            multiplier: currentMultiplier,
            payout,
            newBalance: newBal ? parseFloat(newBal.amount) : 0,
          };
        }

        return {
          correct: true,
          gameOver: false,
          currentCard,
          nextCard,
          correctGuesses,
          multiplier: currentMultiplier,
          payout: parseFloat(session.stake) * currentMultiplier,
          nextMultiplierHigher: calculateHiloMultiplier(nextCard, "higher"),
          nextMultiplierLower: calculateHiloMultiplier(nextCard, "lower"),
        };
      }),

    cashOutHilo: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const session = await getGameSessionById(input.sessionId);
        if (!session || session.userId !== ctx.user.id || session.status !== "active") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Geçersiz oyun oturumu" });
        }

        const gameData = session.gameData as any;
        const { correctGuesses, currentMultiplier } = gameData;

        if (correctGuesses === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "En az bir doğru tahmin yapmalısınız" });
        }

        const payout = parseFloat(session.stake) * currentMultiplier;

        await completeGameSession(input.sessionId, "win", currentMultiplier.toFixed(4), payout.toFixed(2));
        await updateBalance(ctx.user.id, payout.toFixed(2));
        await addTransaction(ctx.user.id, "bet_win", payout.toFixed(2), `Casino: hilo - Cash Out (${currentMultiplier}x)`);

        await createCasinoGame(
          ctx.user.id, "hilo", session.stake,
          currentMultiplier.toFixed(4), payout.toFixed(2), "win",
          { correctGuesses, currentMultiplier, cashOut: true, hmac: gameData.hmac },
        );
        await updateRtpTracking("hilo", parseFloat(session.stake), payout);
        const xpEarned = Math.floor(parseFloat(session.stake) / 10);
        if (xpEarned > 0) await addVipXp(ctx.user.id, xpEarned, parseFloat(session.stake));

        const newBal = await getOrCreateBalance(ctx.user.id);

        return {
          multiplier: currentMultiplier,
          payout,
          correctGuesses,
          newBalance: newBal ? parseFloat(newBal.amount) : 0,
        };
      }),

    getActiveHiloSession: protectedProcedure.query(async ({ ctx }) => {
      const session = await getActiveGameSession(ctx.user.id, "hilo");
      if (!session) return null;
      const gameData = session.gameData as any;
      const deck: HiloCard[] = gameData.deck;
      const currentCard = deck[gameData.currentCardIdx];
      return {
        sessionId: session.id,
        stake: parseFloat(session.stake),
        currentCard,
        correctGuesses: gameData.correctGuesses,
        currentMultiplier: gameData.currentMultiplier,
        commitHash: session.commitHash,
        nextMultiplierHigher: calculateHiloMultiplier(currentCard, "higher"),
        nextMultiplierLower: calculateHiloMultiplier(currentCard, "lower"),
      };
    }),

    // ── Seed Management ──
    getActiveSeed: protectedProcedure.query(async ({ ctx }) => {
      const seed = await ensureActiveSeed(ctx.user.id);
      return {
        serverSeedHash: seed.serverSeedHash,
        clientSeed: seed.clientSeed,
        nonce: seed.nonce,
      };
    }),

    setClientSeed: protectedProcedure
      .input(z.object({ clientSeed: z.string().min(1).max(64) }))
      .mutation(async ({ ctx, input }) => {
        const seed = await ensureActiveSeed(ctx.user.id);
        await updateSeedClientSeed(seed.id, input.clientSeed);
        return { success: true };
      }),

    rotateSeed: protectedProcedure.mutation(async ({ ctx }) => {
      const oldSeed = await getActiveSeed(ctx.user.id);
      let revealedSeed = null;
      if (oldSeed) {
        revealedSeed = await revealSeed(oldSeed.id);
      }
      // Create new seed
      const serverSeed = generateServerSeed();
      const serverSeedHash = hashServerSeed(serverSeed);
      const clientSeed = crypto.randomBytes(16).toString("hex");
      await createProvablyFairSeed(ctx.user.id, serverSeed, serverSeedHash, clientSeed);

      return {
        revealed: revealedSeed ? {
          serverSeed: revealedSeed.serverSeed,
          serverSeedHash: revealedSeed.serverSeedHash,
          clientSeed: revealedSeed.clientSeed,
          nonce: revealedSeed.nonce,
        } : null,
        newSeedHash: serverSeedHash,
        newClientSeed: clientSeed,
      };
    }),

    verifySeed: protectedProcedure
      .input(z.object({
        serverSeed: z.string(),
        clientSeed: z.string(),
        nonce: z.number(),
        gameType: z.enum(["coinflip", "dice", "roulette", "plinko", "crash", "mines", "rps", "bingo", "blackjack", "keno", "limbo", "hilo"]),
        params: z.record(z.string(), z.any()),
      }))
      .mutation(({ input }) => {
        const hmac = generateGameHmac(input.serverSeed, input.clientSeed, input.nonce);
        const seedHash = hashServerSeed(input.serverSeed);

        let result;
        switch (input.gameType) {
          case "coinflip":
            result = playCoinFlip(hmac, { choice: (input.params.choice as any) || "heads" });
            break;
          case "dice":
            result = playDice(hmac, { target: Number(input.params.target) || 50 });
            break;
          case "roulette":
            result = playRoulette(hmac, {
              betType: (input.params.betType as any) || "red",
              number: input.params.number != null ? Number(input.params.number) : undefined,
            });
            break;
          case "plinko":
            result = playPlinko(hmac, {
              risk: (input.params.risk as any) || "medium",
              rows: Number(input.params.rows) || 10,
            });
            break;
          case "crash":
            result = playCrash(hmac, { cashOutAt: Number(input.params.cashOutAt) || 2 });
            break;
          case "mines":
            const positions = generateMinePositions(hmac, Number(input.params.mineCount) || 5);
            result = { multiplier: 0, details: { minePositions: positions } };
            break;
          case "rps":
            result = playRockPaperScissors(hmac, { choice: (input.params.choice as any) || "rock" });
            break;
          case "bingo":
            result = playBingo(hmac, {});
            break;
          case "blackjack":
            const deck = generateBlackjackDeck(hmac);
            result = { multiplier: 0, details: { deck: deck.slice(0, 10) } };
            break;
          case "keno":
            result = playKeno(hmac, { picks: (input.params.picks as number[]) || [1, 2, 3] });
            break;
          case "limbo":
            result = playLimbo(hmac, { target: Number(input.params.target) || 2 });
            break;
          case "hilo":
            const hiloDeck = generateHiloDeck(hmac);
            result = { multiplier: 0, details: { deck: hiloDeck.slice(0, 10) } };
            break;
          default:
            result = { multiplier: 0, details: {} };
        }

        return {
          hmac,
          serverSeedHash: seedHash,
          result,
        };
      }),

    history: protectedProcedure.query(async ({ ctx }) => {
      return getUserCasinoHistory(ctx.user.id);
    }),
  }),

  // ─── Responsible Gambling ───
  responsibleGambling: router({
    getSettings: protectedProcedure.query(async ({ ctx }) => {
      return getResponsibleGamblingSettings(ctx.user.id);
    }),

    updateSettings: protectedProcedure
      .input(z.object({
        depositLimitDaily: z.string().nullable().optional(),
        depositLimitWeekly: z.string().nullable().optional(),
        depositLimitMonthly: z.string().nullable().optional(),
        lossLimitDaily: z.string().nullable().optional(),
        lossLimitWeekly: z.string().nullable().optional(),
        lossLimitMonthly: z.string().nullable().optional(),
        wagerLimitDaily: z.string().nullable().optional(),
        wagerLimitWeekly: z.string().nullable().optional(),
        wagerLimitMonthly: z.string().nullable().optional(),
        sessionReminderMinutes: z.number().nullable().optional(),
        realityCheckMinutes: z.number().nullable().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await upsertResponsibleGamblingSettings(ctx.user.id, input as any);
        await addResponsibleGamblingLog(ctx.user.id, "settings_updated", input);
        return { success: true };
      }),

    setSelfExclusion: protectedProcedure
      .input(z.object({
        type: z.enum(["24h", "7d", "30d", "permanent"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const durations: Record<string, number> = {
          "24h": 24 * 60 * 60 * 1000,
          "7d": 7 * 24 * 60 * 60 * 1000,
          "30d": 30 * 24 * 60 * 60 * 1000,
        };

        const until = input.type === "permanent"
          ? new Date("2099-12-31")
          : new Date(Date.now() + (durations[input.type] || 0));

        await upsertResponsibleGamblingSettings(ctx.user.id, {
          selfExclusionUntil: until,
          selfExclusionType: input.type,
        });
        await addResponsibleGamblingLog(ctx.user.id, "self_exclusion", { type: input.type, until });

        return { success: true, until };
      }),

    getLogs: protectedProcedure.query(async ({ ctx }) => {
      return getResponsibleGamblingLogs(ctx.user.id);
    }),
  }),

  // ─── Profile ───
  profile: router({
    stats: protectedProcedure.query(async ({ ctx }) => {
      const [betStats, casinoStats, sportDist, balanceHistory, balance] = await Promise.all([
        getUserBetStats(ctx.user.id),
        getUserCasinoStats(ctx.user.id),
        getUserSportDistribution(ctx.user.id),
        getUserBalanceHistory(ctx.user.id),
        getOrCreateBalance(ctx.user.id),
      ]);

      // Calculate running balance from transactions
      let runningBalance = 0;
      const balanceTimeline = balanceHistory.map(tx => {
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
          description: tx.description,
        };
      });

      return {
        user: {
          name: ctx.user.name,
          email: ctx.user.email,
          createdAt: ctx.user.createdAt,
          role: ctx.user.role,
        },
        currentBalance: balance ? parseFloat(balance.amount) : 0,
        betStats,
        casinoStats,
        sportDistribution: sportDist,
        balanceTimeline,
        totalProfit: (betStats.totalWon - betStats.totalStaked) + (casinoStats.totalPayout - casinoStats.totalStaked),
      };
    }),
  }),

  // ─── VIP ───
  vip: router({
    profile: protectedProcedure.query(async ({ ctx }) => {
      const profile = await getOrCreateVipProfile(ctx.user.id);
      if (!profile) return null;
      const currentTier = VIP_TIERS.find(t => t.name === profile.currentTier) ?? VIP_TIERS[0];
      const nextTier = getNextTier(profile.currentTier);
      const xpForNext = nextTier ? nextTier.minXp - profile.totalXp : 0;
      const progress = nextTier ? ((profile.totalXp - currentTier.minXp) / (nextTier.minXp - currentTier.minXp)) * 100 : 100;
      return {
        ...profile,
        currentTierInfo: currentTier,
        nextTierInfo: nextTier,
        xpForNextTier: Math.max(0, xpForNext),
        progress: Math.min(100, Math.max(0, progress)),
      };
    }),
    tiers: publicProcedure.query(() => {
      return VIP_TIERS.map(t => ({ ...t }));
    }),
    leaderboard: publicProcedure.query(async () => {
      const profiles = await getAllVipProfiles(20);
      return profiles;
    }),
  }),

  // ─── Banners (public) ───
  banners: router({
    sports: publicProcedure.query(async () => {
      return getActiveBanners("sports");
    }),
    casino: publicProcedure.query(async () => {
      return getActiveBanners("casino");
    }),
  }),

  // ─── Crypto Wallet ───
  cryptoWallet: router({
    getDepositAddress: protectedProcedure
      .input(z.object({ network: z.enum(["tron", "ethereum", "bsc", "polygon", "solana", "bitcoin"]) }))
      .mutation(async ({ ctx, input }) => {
        const network = input.network as NetworkId;

        // Check if user already has an address for this network
        const existing = await getUserWallet(ctx.user.id, network);
        if (existing) {
          return {
            address: existing.depositAddress,
            network: existing.network,
            isNew: false,
          };
        }

        // Generate new address via HD derivation
        const addressIndex = await getNextAddressIndex();
        const { address } = await generateAddress(network, addressIndex);

        await createWallet(ctx.user.id, network, addressIndex, address);

        return { address, network, isNew: true };
      }),

    getAddresses: protectedProcedure.query(async ({ ctx }) => {
      return getUserWallets(ctx.user.id);
    }),

    regenerateAddress: protectedProcedure
      .input(z.object({ network: z.enum(["tron", "ethereum", "bsc", "polygon", "solana", "bitcoin"]) }))
      .mutation(async ({ ctx, input }) => {
        const network = input.network as NetworkId;
        const existing = await getUserWallet(ctx.user.id, network);
        if (!existing) {
          throw new Error("Bu ağda henüz bir adresiniz yok. Önce adres oluşturun.");
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

    requestWithdrawal: protectedProcedure
      .input(z.object({
        network: z.enum(["tron", "ethereum", "bsc", "polygon", "solana", "bitcoin"]),
        toAddress: z.string().min(10).max(128),
        amount: z.number().min(1).max(WITHDRAWAL_LIMITS.perTransaction),
      }))
      .mutation(async ({ ctx, input }) => {
        const network = input.network as NetworkId;
        const config = NETWORKS[network];

        // Per-transaction limit
        if (input.amount > WITHDRAWAL_LIMITS.perTransaction) {
          throw new Error(`Tek seferde maksimum ${WITHDRAWAL_LIMITS.perTransaction} USDT çekilebilir`);
        }

        // Daily limit check
        const dailyTotal = await getUserDailyWithdrawalTotal(ctx.user.id);
        if (dailyTotal + input.amount > WITHDRAWAL_LIMITS.dailyTotal) {
          const remaining = Math.max(0, WITHDRAWAL_LIMITS.dailyTotal - dailyTotal);
          throw new Error(`Günlük çekim limiti: ${WITHDRAWAL_LIMITS.dailyTotal} USDT. Kalan: ${remaining.toFixed(2)} USDT`);
        }

        // Address format validation
        const addrValidators: Record<string, RegExp> = {
          tron: /^T[A-HJ-NP-Za-km-z1-9]{33}$/,
          ethereum: /^0x[a-fA-F0-9]{40}$/,
          bsc: /^0x[a-fA-F0-9]{40}$/,
          polygon: /^0x[a-fA-F0-9]{40}$/,
          solana: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
          bitcoin: /^(bc1|tb1|[13]|[mn2])[a-zA-HJ-NP-Z0-9]{25,62}$/,
        };
        if (addrValidators[network] && !addrValidators[network].test(input.toAddress)) {
          throw new Error(`Geçersiz ${config.name} adresi`);
        }

        // Atomic balance check + deduct (prevents race condition)
        const totalCost = input.amount + config.withdrawalFee;
        await getOrCreateBalance(ctx.user.id);
        const deduct = await atomicDeductBalance(
          ctx.user.id,
          totalCost,
          `Kripto çekim talebi: ${input.amount} USDT (${config.name}) + ${config.withdrawalFee} fee`
        );
        if (!deduct.success) {
          throw new Error(deduct.error || "Yetersiz bakiye");
        }

        // Create withdrawal record
        const withdrawalId = await createWithdrawal({
          userId: ctx.user.id,
          network,
          toAddress: input.toAddress,
          amount: input.amount.toFixed(2),
          fee: config.withdrawalFee.toFixed(2),
          tokenSymbol: "USDT",
        });

        // Auto-approve if under limit
        const autoLimit = getAutoApproveLimit();
        if (input.amount <= autoLimit) {
          await updateWithdrawalStatus(withdrawalId!, "approved");
        }

        return { withdrawalId, status: input.amount <= autoLimit ? "approved" : "pending" };
      }),

    networks: publicProcedure.query(() => {
      return Object.values(NETWORKS).map(n => ({
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
        explorerUrl: n.explorerUrl,
      }));
    }),
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
    bannerGet: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return getBannerById(input.id);
      }),
    bannerCreate: adminProcedure
      .input(z.object({
        title: z.string().min(1).max(256),
        imageUrl: z.string().url(),
        ctaLink: z.string().min(1).max(512).default("/"),
        section: z.enum(["sports", "casino", "both"]).default("both"),
        sortOrder: z.number().int().min(0).default(0),
        isActive: z.number().int().min(0).max(1).default(1),
        startsAt: z.string().nullable().optional(),
        endsAt: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await createBanner({
          title: input.title,
          imageUrl: input.imageUrl,
          ctaLink: input.ctaLink,
          section: input.section,
          sortOrder: input.sortOrder,
          isActive: input.isActive,
          startsAt: input.startsAt ? new Date(input.startsAt) : null,
          endsAt: input.endsAt ? new Date(input.endsAt) : null,
        });
        return { id };
      }),
    bannerUpdate: adminProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().min(1).max(256).optional(),
        imageUrl: z.string().url().optional(),
        ctaLink: z.string().min(1).max(512).optional(),
        section: z.enum(["sports", "casino", "both"]).optional(),
        sortOrder: z.number().int().min(0).optional(),
        isActive: z.number().int().min(0).max(1).optional(),
        startsAt: z.string().nullable().optional(),
        endsAt: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        const updateData: any = { ...data };
        if (data.startsAt !== undefined) {
          updateData.startsAt = data.startsAt ? new Date(data.startsAt) : null;
        }
        if (data.endsAt !== undefined) {
          updateData.endsAt = data.endsAt ? new Date(data.endsAt) : null;
        }
        await updateBanner(id, updateData);
        return { success: true };
      }),
    bannerDelete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteBanner(input.id);
        return { success: true };
      }),
    bannerReorder: adminProcedure
      .input(z.object({ orderedIds: z.array(z.number()).min(1) }))
      .mutation(async ({ input }) => {
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
    approveWithdrawal: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const withdrawal = await getWithdrawalById(input.id);
        if (!withdrawal) throw new Error("Çekim bulunamadı");
        if (withdrawal.status !== "pending") throw new Error("Bu çekim zaten işlendi");
        await updateWithdrawalStatus(input.id, "approved", undefined, ctx.user.id);
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

    // ─── RTP & Audit ───
    rtpSummary: adminProcedure.query(async () => {
      return getRtpSummary();
    }),
    rtpReport: adminProcedure
      .input(z.object({ days: z.number().min(1).max(365).optional() }).optional())
      .query(async ({ input }) => {
        return getRtpReport(input?.days || 30);
      }),
    casinoGames: adminProcedure
      .input(z.object({ limit: z.number().min(1).max(1000).optional() }).optional())
      .query(async ({ input }) => {
        return getAllCasinoGames(input?.limit || 100);
      }),

    rejectWithdrawal: adminProcedure
      .input(z.object({ id: z.number(), note: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const withdrawal = await getWithdrawalById(input.id);
        if (!withdrawal) throw new Error("Çekim bulunamadı");
        if (withdrawal.status !== "pending") throw new Error("Bu çekim zaten işlendi");

        // Refund the balance
        const refundAmount = parseFloat(withdrawal.amount) + parseFloat(withdrawal.fee);
        await getOrCreateBalance(withdrawal.userId);
        await updateBalance(withdrawal.userId, refundAmount.toFixed(2));
        await addTransaction(withdrawal.userId, "deposit", refundAmount.toFixed(2),
          `Çekim reddedildi — iade: ${withdrawal.amount} USDT + ${withdrawal.fee} fee`);

        await updateWithdrawalStatus(input.id, "rejected", undefined, ctx.user.id, input.note);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
