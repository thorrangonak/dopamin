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
} from "./db";
import { settleBets } from "./settlement";
import { calculateCasinoResult } from "./casinoEngine";
import { invokeLLM } from "./_core/llm";

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
    play: protectedProcedure
      .input(z.object({
        gameType: z.enum(["coinflip", "dice", "mines", "crash", "roulette", "plinko"]),
        stake: z.number().min(1).max(100000),
        params: z.any(),
      }))
      .mutation(async ({ ctx, input }) => {
        const bal = await getOrCreateBalance(ctx.user.id);
        if (!bal || parseFloat(bal.amount) < input.stake) {
          throw new Error("Yetersiz bakiye");
        }

        // Deduct stake
        await updateBalance(ctx.user.id, (-input.stake).toFixed(2));

        // Calculate result based on game type
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
          `Casino: ${input.gameType} - ${isWin ? "Kazanıldı" : "Kaybedildi"}`
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

        // Award VIP XP: 1 XP per 10₺ wagered
        const xpEarned = Math.floor(input.stake / 10);
        if (xpEarned > 0) {
          await addVipXp(ctx.user.id, xpEarned, input.stake);
        }

        const newBal = await getOrCreateBalance(ctx.user.id);

        return {
          gameId,
          result: isWin ? "win" as const : "loss" as const,
          multiplier: gameResult.multiplier,
          payout,
          details: gameResult.details,
          newBalance: newBal ? parseFloat(newBal.amount) : 0,
        };
      }),
    history: protectedProcedure.query(async ({ ctx }) => {
      return getUserCasinoHistory(ctx.user.id);
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
  }),
});

export type AppRouter = typeof appRouter;
