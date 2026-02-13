/**
 * Demo sports data for the platform.
 * Used as fallback when The Odds API key is missing or returns empty.
 * All timestamps are generated dynamically relative to "now" so data always looks fresh.
 */

// ─── Helpers ───
function hoursFromNow(h: number): string {
  return new Date(Date.now() + h * 3600_000).toISOString();
}
function minutesAgo(m: number): string {
  return new Date(Date.now() - m * 60_000).toISOString();
}

function makeBookmaker(markets: { key: string; outcomes: { name: string; price: number; point?: number }[] }[]) {
  return [
    {
      key: "dopamin",
      title: "Dopamin",
      last_update: new Date().toISOString(),
      markets: markets.map((m) => ({
        key: m.key,
        last_update: new Date().toISOString(),
        outcomes: m.outcomes,
      })),
    },
  ];
}

// ─── Demo Sports List ───
export function getDemoSports() {
  return [
    // Futbol
    { id: 1, sportKey: "soccer_turkey_super_league", groupName: "Soccer", title: "Türkiye Süper Lig", description: "Türkiye birinci futbol ligi", active: 1, hasOutrights: 0, updatedAt: new Date() },
    { id: 2, sportKey: "soccer_epl", groupName: "Soccer", title: "İngiltere Premier Lig", description: "İngiltere birinci futbol ligi", active: 1, hasOutrights: 0, updatedAt: new Date() },
    { id: 3, sportKey: "soccer_spain_la_liga", groupName: "Soccer", title: "İspanya La Liga", description: "İspanya birinci futbol ligi", active: 1, hasOutrights: 0, updatedAt: new Date() },
    { id: 4, sportKey: "soccer_germany_bundesliga", groupName: "Soccer", title: "Almanya Bundesliga", description: "Almanya birinci futbol ligi", active: 1, hasOutrights: 0, updatedAt: new Date() },
    { id: 5, sportKey: "soccer_italy_serie_a", groupName: "Soccer", title: "İtalya Serie A", description: "İtalya birinci futbol ligi", active: 1, hasOutrights: 0, updatedAt: new Date() },
    { id: 6, sportKey: "soccer_uefa_champs_league", groupName: "Soccer", title: "UEFA Şampiyonlar Ligi", description: "Avrupa kulüpler arası şampiyonası", active: 1, hasOutrights: 0, updatedAt: new Date() },
    { id: 7, sportKey: "soccer_france_ligue_one", groupName: "Soccer", title: "Fransa Ligue 1", description: "Fransa birinci futbol ligi", active: 1, hasOutrights: 0, updatedAt: new Date() },
    // Basketbol
    { id: 8, sportKey: "basketball_nba", groupName: "Basketball", title: "NBA", description: "Amerika Ulusal Basketbol Ligi", active: 1, hasOutrights: 0, updatedAt: new Date() },
    { id: 9, sportKey: "basketball_euroleague", groupName: "Basketball", title: "EuroLeague", description: "Avrupa Basketbol Ligi", active: 1, hasOutrights: 0, updatedAt: new Date() },
    { id: 10, sportKey: "basketball_turkey_bsl", groupName: "Basketball", title: "Türkiye BSL", description: "Türkiye Basketbol Süper Ligi", active: 1, hasOutrights: 0, updatedAt: new Date() },
    // Tenis
    { id: 11, sportKey: "tennis_atp_aus_open", groupName: "Tennis", title: "ATP Avustralya Açık", description: "Grand Slam turnuvası", active: 1, hasOutrights: 0, updatedAt: new Date() },
    { id: 12, sportKey: "tennis_wta_aus_open", groupName: "Tennis", title: "WTA Avustralya Açık", description: "Kadınlar Grand Slam turnuvası", active: 1, hasOutrights: 0, updatedAt: new Date() },
    // Amerikan Futbolu
    { id: 13, sportKey: "americanfootball_nfl", groupName: "American Football", title: "NFL", description: "Amerika Ulusal Futbol Ligi", active: 1, hasOutrights: 0, updatedAt: new Date() },
    // Buz Hokeyi
    { id: 14, sportKey: "icehockey_nhl", groupName: "Ice Hockey", title: "NHL", description: "Amerika Ulusal Hokey Ligi", active: 1, hasOutrights: 0, updatedAt: new Date() },
    // MMA
    { id: 15, sportKey: "mma_mixed_martial_arts", groupName: "Mixed Martial Arts", title: "UFC / MMA", description: "Karma dövüş sanatları", active: 1, hasOutrights: 0, updatedAt: new Date() },
    // E-Spor
    { id: 16, sportKey: "esports_lol", groupName: "Esports", title: "League of Legends", description: "LoL e-spor müsabakaları", active: 1, hasOutrights: 0, updatedAt: new Date() },
    { id: 17, sportKey: "esports_csgo", groupName: "Esports", title: "CS2", description: "Counter-Strike 2 müsabakaları", active: 1, hasOutrights: 0, updatedAt: new Date() },
  ];
}

// ─── Demo Pre-Match Events ───
export function getDemoEvents(sportKey: string) {
  const events: Record<string, any[]> = {
    // ── Süper Lig ──
    soccer_turkey_super_league: [
      {
        id: "demo_tsl_1", sport_key: "soccer_turkey_super_league", sport_title: "Türkiye Süper Lig",
        commence_time: hoursFromNow(3), home_team: "Galatasaray", away_team: "Fenerbahçe",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Galatasaray", price: 2.15 }, { name: "Draw", price: 3.40 }, { name: "Fenerbahçe", price: 3.10 }] },
          { key: "spreads", outcomes: [{ name: "Galatasaray", price: 1.90, point: -0.5 }, { name: "Fenerbahçe", price: 1.95, point: 0.5 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.85, point: 2.5 }, { name: "Under", price: 1.95, point: 2.5 }] },
        ]),
      },
      {
        id: "demo_tsl_2", sport_key: "soccer_turkey_super_league", sport_title: "Türkiye Süper Lig",
        commence_time: hoursFromNow(6), home_team: "Beşiktaş", away_team: "Trabzonspor",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Beşiktaş", price: 1.85 }, { name: "Draw", price: 3.50 }, { name: "Trabzonspor", price: 4.20 }] },
          { key: "spreads", outcomes: [{ name: "Beşiktaş", price: 1.88, point: -1.0 }, { name: "Trabzonspor", price: 1.97, point: 1.0 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.92, point: 2.5 }, { name: "Under", price: 1.88, point: 2.5 }] },
        ]),
      },
      {
        id: "demo_tsl_3", sport_key: "soccer_turkey_super_league", sport_title: "Türkiye Süper Lig",
        commence_time: hoursFromNow(26), home_team: "Başakşehir", away_team: "Adana Demirspor",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Başakşehir", price: 1.70 }, { name: "Draw", price: 3.60 }, { name: "Adana Demirspor", price: 5.00 }] },
          { key: "spreads", outcomes: [{ name: "Başakşehir", price: 1.92, point: -1.5 }, { name: "Adana Demirspor", price: 1.92, point: 1.5 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.80, point: 2.5 }, { name: "Under", price: 2.00, point: 2.5 }] },
        ]),
      },
      {
        id: "demo_tsl_4", sport_key: "soccer_turkey_super_league", sport_title: "Türkiye Süper Lig",
        commence_time: hoursFromNow(28), home_team: "Samsunspor", away_team: "Kayserispor",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Samsunspor", price: 2.10 }, { name: "Draw", price: 3.30 }, { name: "Kayserispor", price: 3.50 }] },
          { key: "spreads", outcomes: [{ name: "Samsunspor", price: 1.85, point: -0.5 }, { name: "Kayserispor", price: 2.00, point: 0.5 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 2.10, point: 2.5 }, { name: "Under", price: 1.75, point: 2.5 }] },
        ]),
      },
      {
        id: "demo_tsl_5", sport_key: "soccer_turkey_super_league", sport_title: "Türkiye Süper Lig",
        commence_time: hoursFromNow(50), home_team: "Antalyaspor", away_team: "Sivasspor",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Antalyaspor", price: 2.40 }, { name: "Draw", price: 3.20 }, { name: "Sivasspor", price: 3.00 }] },
          { key: "spreads", outcomes: [{ name: "Antalyaspor", price: 1.95, point: -0.5 }, { name: "Sivasspor", price: 1.90, point: 0.5 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.90, point: 2.0 }, { name: "Under", price: 1.90, point: 2.0 }] },
        ]),
      },
    ],

    // ── Premier Lig ──
    soccer_epl: [
      {
        id: "demo_epl_1", sport_key: "soccer_epl", sport_title: "İngiltere Premier Lig",
        commence_time: hoursFromNow(5), home_team: "Arsenal", away_team: "Manchester City",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Arsenal", price: 2.30 }, { name: "Draw", price: 3.40 }, { name: "Manchester City", price: 2.90 }] },
          { key: "spreads", outcomes: [{ name: "Arsenal", price: 1.92, point: -0.5 }, { name: "Manchester City", price: 1.92, point: 0.5 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.85, point: 2.5 }, { name: "Under", price: 1.95, point: 2.5 }] },
        ]),
      },
      {
        id: "demo_epl_2", sport_key: "soccer_epl", sport_title: "İngiltere Premier Lig",
        commence_time: hoursFromNow(8), home_team: "Liverpool", away_team: "Chelsea",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Liverpool", price: 1.75 }, { name: "Draw", price: 3.80 }, { name: "Chelsea", price: 4.50 }] },
          { key: "spreads", outcomes: [{ name: "Liverpool", price: 1.85, point: -1.0 }, { name: "Chelsea", price: 2.00, point: 1.0 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.80, point: 3.0 }, { name: "Under", price: 2.00, point: 3.0 }] },
        ]),
      },
      {
        id: "demo_epl_3", sport_key: "soccer_epl", sport_title: "İngiltere Premier Lig",
        commence_time: hoursFromNow(30), home_team: "Manchester United", away_team: "Tottenham",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Manchester United", price: 2.50 }, { name: "Draw", price: 3.30 }, { name: "Tottenham", price: 2.80 }] },
          { key: "spreads", outcomes: [{ name: "Manchester United", price: 1.90, point: -0.5 }, { name: "Tottenham", price: 1.95, point: 0.5 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.75, point: 2.5 }, { name: "Under", price: 2.10, point: 2.5 }] },
        ]),
      },
      {
        id: "demo_epl_4", sport_key: "soccer_epl", sport_title: "İngiltere Premier Lig",
        commence_time: hoursFromNow(52), home_team: "Aston Villa", away_team: "Newcastle",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Aston Villa", price: 2.20 }, { name: "Draw", price: 3.40 }, { name: "Newcastle", price: 3.20 }] },
          { key: "spreads", outcomes: [{ name: "Aston Villa", price: 1.88, point: -0.5 }, { name: "Newcastle", price: 1.97, point: 0.5 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.87, point: 2.5 }, { name: "Under", price: 1.93, point: 2.5 }] },
        ]),
      },
    ],

    // ── La Liga ──
    soccer_spain_la_liga: [
      {
        id: "demo_liga_1", sport_key: "soccer_spain_la_liga", sport_title: "İspanya La Liga",
        commence_time: hoursFromNow(4), home_team: "Real Madrid", away_team: "Barcelona",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Real Madrid", price: 2.40 }, { name: "Draw", price: 3.50 }, { name: "Barcelona", price: 2.70 }] },
          { key: "spreads", outcomes: [{ name: "Real Madrid", price: 1.90, point: -0.5 }, { name: "Barcelona", price: 1.95, point: 0.5 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.70, point: 2.5 }, { name: "Under", price: 2.15, point: 2.5 }] },
        ]),
      },
      {
        id: "demo_liga_2", sport_key: "soccer_spain_la_liga", sport_title: "İspanya La Liga",
        commence_time: hoursFromNow(24), home_team: "Atletico Madrid", away_team: "Sevilla",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Atletico Madrid", price: 1.65 }, { name: "Draw", price: 3.80 }, { name: "Sevilla", price: 5.50 }] },
          { key: "spreads", outcomes: [{ name: "Atletico Madrid", price: 1.92, point: -1.5 }, { name: "Sevilla", price: 1.92, point: 1.5 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 2.00, point: 2.5 }, { name: "Under", price: 1.82, point: 2.5 }] },
        ]),
      },
    ],

    // ── Bundesliga ──
    soccer_germany_bundesliga: [
      {
        id: "demo_bun_1", sport_key: "soccer_germany_bundesliga", sport_title: "Almanya Bundesliga",
        commence_time: hoursFromNow(7), home_team: "Bayern München", away_team: "Borussia Dortmund",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Bayern München", price: 1.55 }, { name: "Draw", price: 4.20 }, { name: "Borussia Dortmund", price: 5.50 }] },
          { key: "spreads", outcomes: [{ name: "Bayern München", price: 1.85, point: -1.5 }, { name: "Borussia Dortmund", price: 2.00, point: 1.5 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.65, point: 3.0 }, { name: "Under", price: 2.25, point: 3.0 }] },
        ]),
      },
      {
        id: "demo_bun_2", sport_key: "soccer_germany_bundesliga", sport_title: "Almanya Bundesliga",
        commence_time: hoursFromNow(30), home_team: "RB Leipzig", away_team: "Bayer Leverkusen",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "RB Leipzig", price: 2.60 }, { name: "Draw", price: 3.40 }, { name: "Bayer Leverkusen", price: 2.60 }] },
          { key: "spreads", outcomes: [{ name: "RB Leipzig", price: 1.92, point: -0.5 }, { name: "Bayer Leverkusen", price: 1.92, point: 0.5 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.75, point: 2.5 }, { name: "Under", price: 2.10, point: 2.5 }] },
        ]),
      },
    ],

    // ── Serie A ──
    soccer_italy_serie_a: [
      {
        id: "demo_ser_1", sport_key: "soccer_italy_serie_a", sport_title: "İtalya Serie A",
        commence_time: hoursFromNow(5), home_team: "Inter Milan", away_team: "AC Milan",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Inter Milan", price: 1.80 }, { name: "Draw", price: 3.60 }, { name: "AC Milan", price: 4.30 }] },
          { key: "spreads", outcomes: [{ name: "Inter Milan", price: 1.87, point: -1.0 }, { name: "AC Milan", price: 1.97, point: 1.0 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.92, point: 2.5 }, { name: "Under", price: 1.88, point: 2.5 }] },
        ]),
      },
      {
        id: "demo_ser_2", sport_key: "soccer_italy_serie_a", sport_title: "İtalya Serie A",
        commence_time: hoursFromNow(28), home_team: "Juventus", away_team: "Napoli",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Juventus", price: 2.25 }, { name: "Draw", price: 3.30 }, { name: "Napoli", price: 3.10 }] },
          { key: "spreads", outcomes: [{ name: "Juventus", price: 1.90, point: -0.5 }, { name: "Napoli", price: 1.95, point: 0.5 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 2.05, point: 2.5 }, { name: "Under", price: 1.80, point: 2.5 }] },
        ]),
      },
    ],

    // ── Champions League ──
    soccer_uefa_champs_league: [
      {
        id: "demo_ucl_1", sport_key: "soccer_uefa_champs_league", sport_title: "UEFA Şampiyonlar Ligi",
        commence_time: hoursFromNow(10), home_team: "Real Madrid", away_team: "Bayern München",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Real Madrid", price: 2.35 }, { name: "Draw", price: 3.40 }, { name: "Bayern München", price: 2.90 }] },
          { key: "spreads", outcomes: [{ name: "Real Madrid", price: 1.90, point: -0.5 }, { name: "Bayern München", price: 1.95, point: 0.5 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.72, point: 2.5 }, { name: "Under", price: 2.15, point: 2.5 }] },
        ]),
      },
      {
        id: "demo_ucl_2", sport_key: "soccer_uefa_champs_league", sport_title: "UEFA Şampiyonlar Ligi",
        commence_time: hoursFromNow(10), home_team: "Manchester City", away_team: "Paris Saint-Germain",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Manchester City", price: 1.70 }, { name: "Draw", price: 3.80 }, { name: "Paris Saint-Germain", price: 4.80 }] },
          { key: "spreads", outcomes: [{ name: "Manchester City", price: 1.85, point: -1.0 }, { name: "Paris Saint-Germain", price: 2.00, point: 1.0 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.80, point: 2.5 }, { name: "Under", price: 2.00, point: 2.5 }] },
        ]),
      },
    ],

    // ── Ligue 1 ──
    soccer_france_ligue_one: [
      {
        id: "demo_l1_1", sport_key: "soccer_france_ligue_one", sport_title: "Fransa Ligue 1",
        commence_time: hoursFromNow(9), home_team: "Paris Saint-Germain", away_team: "Olympique Marseille",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Paris Saint-Germain", price: 1.40 }, { name: "Draw", price: 4.80 }, { name: "Olympique Marseille", price: 7.50 }] },
          { key: "spreads", outcomes: [{ name: "Paris Saint-Germain", price: 1.90, point: -2.0 }, { name: "Olympique Marseille", price: 1.95, point: 2.0 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.65, point: 3.0 }, { name: "Under", price: 2.25, point: 3.0 }] },
        ]),
      },
    ],

    // ── NBA ──
    basketball_nba: [
      {
        id: "demo_nba_1", sport_key: "basketball_nba", sport_title: "NBA",
        commence_time: hoursFromNow(4), home_team: "Los Angeles Lakers", away_team: "Boston Celtics",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Los Angeles Lakers", price: 2.10 }, { name: "Boston Celtics", price: 1.75 }] },
          { key: "spreads", outcomes: [{ name: "Los Angeles Lakers", price: 1.91, point: 3.5 }, { name: "Boston Celtics", price: 1.91, point: -3.5 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.90, point: 224.5 }, { name: "Under", price: 1.90, point: 224.5 }] },
        ]),
      },
      {
        id: "demo_nba_2", sport_key: "basketball_nba", sport_title: "NBA",
        commence_time: hoursFromNow(7), home_team: "Golden State Warriors", away_team: "Milwaukee Bucks",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Golden State Warriors", price: 1.95 }, { name: "Milwaukee Bucks", price: 1.87 }] },
          { key: "spreads", outcomes: [{ name: "Golden State Warriors", price: 1.92, point: 1.5 }, { name: "Milwaukee Bucks", price: 1.92, point: -1.5 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.85, point: 230.5 }, { name: "Under", price: 1.95, point: 230.5 }] },
        ]),
      },
      {
        id: "demo_nba_3", sport_key: "basketball_nba", sport_title: "NBA",
        commence_time: hoursFromNow(28), home_team: "Phoenix Suns", away_team: "Denver Nuggets",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Phoenix Suns", price: 2.25 }, { name: "Denver Nuggets", price: 1.65 }] },
          { key: "spreads", outcomes: [{ name: "Phoenix Suns", price: 1.90, point: 4.5 }, { name: "Denver Nuggets", price: 1.90, point: -4.5 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.92, point: 221.5 }, { name: "Under", price: 1.88, point: 221.5 }] },
        ]),
      },
    ],

    // ── EuroLeague ──
    basketball_euroleague: [
      {
        id: "demo_el_1", sport_key: "basketball_euroleague", sport_title: "EuroLeague",
        commence_time: hoursFromNow(6), home_team: "Fenerbahçe Beko", away_team: "Real Madrid",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Fenerbahçe Beko", price: 1.85 }, { name: "Real Madrid", price: 1.95 }] },
          { key: "spreads", outcomes: [{ name: "Fenerbahçe Beko", price: 1.90, point: -2.5 }, { name: "Real Madrid", price: 1.90, point: 2.5 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.88, point: 162.5 }, { name: "Under", price: 1.92, point: 162.5 }] },
        ]),
      },
      {
        id: "demo_el_2", sport_key: "basketball_euroleague", sport_title: "EuroLeague",
        commence_time: hoursFromNow(24), home_team: "Anadolu Efes", away_team: "Barcelona",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Anadolu Efes", price: 2.30 }, { name: "Barcelona", price: 1.60 }] },
          { key: "spreads", outcomes: [{ name: "Anadolu Efes", price: 1.92, point: 5.5 }, { name: "Barcelona", price: 1.92, point: -5.5 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.85, point: 158.5 }, { name: "Under", price: 1.95, point: 158.5 }] },
        ]),
      },
    ],

    // ── Türkiye BSL ──
    basketball_turkey_bsl: [
      {
        id: "demo_bsl_1", sport_key: "basketball_turkey_bsl", sport_title: "Türkiye BSL",
        commence_time: hoursFromNow(5), home_team: "Galatasaray Nef", away_team: "Beşiktaş Emlakjet",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Galatasaray Nef", price: 1.50 }, { name: "Beşiktaş Emlakjet", price: 2.55 }] },
          { key: "spreads", outcomes: [{ name: "Galatasaray Nef", price: 1.90, point: -6.5 }, { name: "Beşiktaş Emlakjet", price: 1.90, point: 6.5 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.87, point: 155.5 }, { name: "Under", price: 1.93, point: 155.5 }] },
        ]),
      },
    ],

    // ── Tenis ──
    tennis_atp_aus_open: [
      {
        id: "demo_atp_1", sport_key: "tennis_atp_aus_open", sport_title: "ATP Avustralya Açık",
        commence_time: hoursFromNow(3), home_team: "Novak Djokovic", away_team: "Carlos Alcaraz",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Novak Djokovic", price: 1.90 }, { name: "Carlos Alcaraz", price: 1.90 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.85, point: 38.5 }, { name: "Under", price: 1.95, point: 38.5 }] },
        ]),
      },
      {
        id: "demo_atp_2", sport_key: "tennis_atp_aus_open", sport_title: "ATP Avustralya Açık",
        commence_time: hoursFromNow(8), home_team: "Jannik Sinner", away_team: "Daniil Medvedev",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Jannik Sinner", price: 1.55 }, { name: "Daniil Medvedev", price: 2.45 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.90, point: 36.5 }, { name: "Under", price: 1.90, point: 36.5 }] },
        ]),
      },
    ],

    tennis_wta_aus_open: [
      {
        id: "demo_wta_1", sport_key: "tennis_wta_aus_open", sport_title: "WTA Avustralya Açık",
        commence_time: hoursFromNow(4), home_team: "Aryna Sabalenka", away_team: "Iga Swiatek",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Aryna Sabalenka", price: 1.75 }, { name: "Iga Swiatek", price: 2.10 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.88, point: 21.5 }, { name: "Under", price: 1.92, point: 21.5 }] },
        ]),
      },
    ],

    // ── NFL ──
    americanfootball_nfl: [
      {
        id: "demo_nfl_1", sport_key: "americanfootball_nfl", sport_title: "NFL",
        commence_time: hoursFromNow(24), home_team: "Kansas City Chiefs", away_team: "Philadelphia Eagles",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Kansas City Chiefs", price: 1.80 }, { name: "Philadelphia Eagles", price: 2.05 }] },
          { key: "spreads", outcomes: [{ name: "Kansas City Chiefs", price: 1.91, point: -2.5 }, { name: "Philadelphia Eagles", price: 1.91, point: 2.5 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.87, point: 48.5 }, { name: "Under", price: 1.93, point: 48.5 }] },
        ]),
      },
      {
        id: "demo_nfl_2", sport_key: "americanfootball_nfl", sport_title: "NFL",
        commence_time: hoursFromNow(48), home_team: "San Francisco 49ers", away_team: "Dallas Cowboys",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "San Francisco 49ers", price: 1.60 }, { name: "Dallas Cowboys", price: 2.35 }] },
          { key: "spreads", outcomes: [{ name: "San Francisco 49ers", price: 1.92, point: -4.5 }, { name: "Dallas Cowboys", price: 1.92, point: 4.5 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.90, point: 46.5 }, { name: "Under", price: 1.90, point: 46.5 }] },
        ]),
      },
    ],

    // ── NHL ──
    icehockey_nhl: [
      {
        id: "demo_nhl_1", sport_key: "icehockey_nhl", sport_title: "NHL",
        commence_time: hoursFromNow(6), home_team: "Toronto Maple Leafs", away_team: "Montreal Canadiens",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Toronto Maple Leafs", price: 1.65 }, { name: "Montreal Canadiens", price: 2.25 }] },
          { key: "spreads", outcomes: [{ name: "Toronto Maple Leafs", price: 1.90, point: -1.5 }, { name: "Montreal Canadiens", price: 1.90, point: 1.5 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.88, point: 6.0 }, { name: "Under", price: 1.92, point: 6.0 }] },
        ]),
      },
    ],

    // ── MMA ──
    mma_mixed_martial_arts: [
      {
        id: "demo_mma_1", sport_key: "mma_mixed_martial_arts", sport_title: "UFC / MMA",
        commence_time: hoursFromNow(48), home_team: "Islam Makhachev", away_team: "Charles Oliveira",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Islam Makhachev", price: 1.45 }, { name: "Charles Oliveira", price: 2.80 }] },
        ]),
      },
      {
        id: "demo_mma_2", sport_key: "mma_mixed_martial_arts", sport_title: "UFC / MMA",
        commence_time: hoursFromNow(48), home_team: "Alex Pereira", away_team: "Jiří Procházka",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "Alex Pereira", price: 1.55 }, { name: "Jiří Procházka", price: 2.45 }] },
        ]),
      },
    ],

    // ── Esports ──
    esports_lol: [
      {
        id: "demo_lol_1", sport_key: "esports_lol", sport_title: "League of Legends",
        commence_time: hoursFromNow(3), home_team: "T1", away_team: "Gen.G",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "T1", price: 1.80 }, { name: "Gen.G", price: 2.00 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.85, point: 2.5 }, { name: "Under", price: 1.95, point: 2.5 }] },
        ]),
      },
    ],

    esports_csgo: [
      {
        id: "demo_cs_1", sport_key: "esports_csgo", sport_title: "CS2",
        commence_time: hoursFromNow(5), home_team: "NAVI", away_team: "FaZe Clan",
        bookmakers: makeBookmaker([
          { key: "h2h", outcomes: [{ name: "NAVI", price: 1.70 }, { name: "FaZe Clan", price: 2.15 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.90, point: 2.5 }, { name: "Under", price: 1.90, point: 2.5 }] },
        ]),
      },
    ],
  };

  return events[sportKey] || [];
}

// ─── Demo Live Events (for LiveScores page) ───
export function getDemoLiveEvents() {
  return [
    // Live matches (currently playing)
    {
      eventId: "demo_live_1", sportKey: "soccer_turkey_super_league",
      homeTeam: "Galatasaray", awayTeam: "Beşiktaş",
      homeScore: 2, awayScore: 1, isLive: 1, completed: 0,
      commenceTime: minutesAgo(65),
      scoresJson: [{ name: "Galatasaray", score: "2" }, { name: "Beşiktaş", score: "1" }],
    },
    {
      eventId: "demo_live_2", sportKey: "soccer_epl",
      homeTeam: "Arsenal", awayTeam: "Liverpool",
      homeScore: 1, awayScore: 1, isLive: 1, completed: 0,
      commenceTime: minutesAgo(38),
      scoresJson: [{ name: "Arsenal", score: "1" }, { name: "Liverpool", score: "1" }],
    },
    {
      eventId: "demo_live_3", sportKey: "basketball_nba",
      homeTeam: "Los Angeles Lakers", awayTeam: "Golden State Warriors",
      homeScore: 78, awayScore: 82, isLive: 1, completed: 0,
      commenceTime: minutesAgo(90),
      scoresJson: [{ name: "Los Angeles Lakers", score: "78" }, { name: "Golden State Warriors", score: "82" }],
    },
    {
      eventId: "demo_live_4", sportKey: "basketball_euroleague",
      homeTeam: "Fenerbahçe Beko", awayTeam: "Olympiacos",
      homeScore: 45, awayScore: 42, isLive: 1, completed: 0,
      commenceTime: minutesAgo(50),
      scoresJson: [{ name: "Fenerbahçe Beko", score: "45" }, { name: "Olympiacos", score: "42" }],
    },
    {
      eventId: "demo_live_5", sportKey: "soccer_spain_la_liga",
      homeTeam: "Real Madrid", away_team: "Valencia",
      homeScore: 3, awayScore: 0, isLive: 1, completed: 0,
      commenceTime: minutesAgo(72),
      scoresJson: [{ name: "Real Madrid", score: "3" }, { name: "Valencia", score: "0" }],
    },

    // In-progress (started but not marked live yet)
    {
      eventId: "demo_prog_1", sportKey: "soccer_germany_bundesliga",
      homeTeam: "Bayern München", awayTeam: "Wolfsburg",
      homeScore: 1, awayScore: 0, isLive: 0, completed: 0,
      commenceTime: minutesAgo(25),
      scoresJson: [{ name: "Bayern München", score: "1" }, { name: "Wolfsburg", score: "0" }],
    },
    {
      eventId: "demo_prog_2", sportKey: "icehockey_nhl",
      homeTeam: "Toronto Maple Leafs", awayTeam: "New York Rangers",
      homeScore: 2, awayScore: 3, isLive: 0, completed: 0,
      commenceTime: minutesAgo(100),
      scoresJson: [{ name: "Toronto Maple Leafs", score: "2" }, { name: "New York Rangers", score: "3" }],
    },

    // Completed matches
    {
      eventId: "demo_done_1", sportKey: "soccer_turkey_super_league",
      homeTeam: "Fenerbahçe", awayTeam: "Trabzonspor",
      homeScore: 3, awayScore: 1, isLive: 0, completed: 1,
      commenceTime: minutesAgo(150),
      scoresJson: [{ name: "Fenerbahçe", score: "3" }, { name: "Trabzonspor", score: "1" }],
    },
    {
      eventId: "demo_done_2", sportKey: "basketball_nba",
      homeTeam: "Boston Celtics", awayTeam: "Miami Heat",
      homeScore: 112, awayScore: 98, isLive: 0, completed: 1,
      commenceTime: minutesAgo(180),
      scoresJson: [{ name: "Boston Celtics", score: "112" }, { name: "Miami Heat", score: "98" }],
    },
    {
      eventId: "demo_done_3", sportKey: "soccer_epl",
      homeTeam: "Manchester City", awayTeam: "Tottenham",
      homeScore: 2, awayScore: 2, isLive: 0, completed: 1,
      commenceTime: minutesAgo(200),
      scoresJson: [{ name: "Manchester City", score: "2" }, { name: "Tottenham", score: "2" }],
    },
    {
      eventId: "demo_done_4", sportKey: "soccer_italy_serie_a",
      homeTeam: "AC Milan", awayTeam: "Roma",
      homeScore: 1, awayScore: 0, isLive: 0, completed: 1,
      commenceTime: minutesAgo(160),
      scoresJson: [{ name: "AC Milan", score: "1" }, { name: "Roma", score: "0" }],
    },
  ];
}

// Fix: some entries used away_team instead of awayTeam — patch here
export function getDemoLiveEventsClean() {
  return getDemoLiveEvents().map((e: any) => ({
    eventId: e.eventId,
    sportKey: e.sportKey,
    homeTeam: e.homeTeam,
    awayTeam: e.awayTeam || e.away_team,
    homeScore: e.homeScore,
    awayScore: e.awayScore,
    isLive: e.isLive,
    completed: e.completed,
    commenceTime: e.commenceTime,
    scoresJson: e.scoresJson,
  }));
}
