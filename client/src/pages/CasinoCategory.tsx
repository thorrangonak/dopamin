import { useLocation, useRoute } from "wouter";
import { Search, Star, Flame, SlidersHorizontal, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useMemo, useRef, useCallback } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

// ─── Vendor logo SVGs (white paths, colored when active) ───
const VENDOR_LOGOS: Record<string, { label: string; svg: string }> = {
  pragmatic: {
    label: "Pragmatic Play",
    svg: `<svg viewBox="0 0 80 28" fill="currentColor"><text x="2" y="20" font-size="11" font-weight="800" font-family="system-ui" letter-spacing="-0.5">PRAGMATIC</text><text x="2" y="27" font-size="6" font-weight="600" font-family="system-ui" letter-spacing="3">PLAY</text></svg>`,
  },
  egt: {
    label: "EGT",
    svg: `<svg viewBox="0 0 50 28" fill="currentColor"><text x="4" y="22" font-size="22" font-weight="900" font-family="system-ui" letter-spacing="1">EGT</text></svg>`,
  },
  amatic: {
    label: "Amatic",
    svg: `<svg viewBox="0 0 70 28" fill="currentColor"><text x="3" y="21" font-size="16" font-weight="800" font-family="system-ui" letter-spacing="0.5">AMATIC</text></svg>`,
  },
  netent: {
    label: "NetEnt",
    svg: `<svg viewBox="0 0 70 28" fill="currentColor"><text x="5" y="20" font-size="15" font-weight="300" font-family="system-ui">Net</text><text x="34" y="20" font-size="15" font-weight="800" font-family="system-ui">Ent</text></svg>`,
  },
  egtdgtl: {
    label: "EGT Digital",
    svg: `<svg viewBox="0 0 80 28" fill="currentColor"><text x="2" y="18" font-size="14" font-weight="900" font-family="system-ui" letter-spacing="1">EGT</text><text x="2" y="27" font-size="8" font-weight="500" font-family="system-ui" letter-spacing="1.5">DIGITAL</text></svg>`,
  },
  novomatic: {
    label: "Novomatic",
    svg: `<svg viewBox="0 0 90 28" fill="currentColor"><text x="3" y="20" font-size="13" font-weight="700" font-family="system-ui" letter-spacing="1">NOVOMATIC</text></svg>`,
  },
  playngo: {
    label: "Play'n GO",
    svg: `<svg viewBox="0 0 80 28" fill="currentColor"><text x="3" y="18" font-size="11" font-weight="700" font-family="system-ui">Play'n</text><text x="45" y="18" font-size="11" font-weight="900" font-family="system-ui">GO</text></svg>`,
  },
  yggdrasil: {
    label: "Yggdrasil",
    svg: `<svg viewBox="0 0 80 28" fill="currentColor"><text x="3" y="20" font-size="13" font-weight="700" font-family="system-ui" letter-spacing="-0.3">YGGDRASIL</text></svg>`,
  },
  aristocrat: {
    label: "Aristocrat",
    svg: `<svg viewBox="0 0 90 28" fill="currentColor"><text x="3" y="20" font-size="13" font-weight="600" font-family="system-ui" letter-spacing="0.5">ARISTOCRAT</text></svg>`,
  },
  isoftbet: {
    label: "iSoftBet",
    svg: `<svg viewBox="0 0 70 28" fill="currentColor"><text x="3" y="20" font-size="12" font-weight="300" font-family="system-ui">i</text><text x="9" y="20" font-size="12" font-weight="800" font-family="system-ui">SoftBet</text></svg>`,
  },
  bomba: {
    label: "Bomba",
    svg: `<svg viewBox="0 0 65 28" fill="currentColor"><text x="3" y="21" font-size="16" font-weight="900" font-family="system-ui" letter-spacing="-0.5">BOMBA</text></svg>`,
  },
  noble: {
    label: "Noble",
    svg: `<svg viewBox="0 0 60 28" fill="currentColor"><text x="3" y="20" font-size="15" font-weight="700" font-family="system-ui" letter-spacing="1">NOBLE</text></svg>`,
  },
  redtiger: {
    label: "Red Tiger",
    svg: `<svg viewBox="0 0 80 28" fill="currentColor"><text x="3" y="18" font-size="10" font-weight="900" font-family="system-ui" letter-spacing="0.5">RED</text><text x="28" y="18" font-size="10" font-weight="400" font-family="system-ui" letter-spacing="0.5">TIGER</text></svg>`,
  },
  playtech: {
    label: "Playtech",
    svg: `<svg viewBox="0 0 80 28" fill="currentColor"><text x="3" y="20" font-size="14" font-weight="700" font-family="system-ui" letter-spacing="-0.3">playtech</text></svg>`,
  },
  merkur: {
    label: "Merkur",
    svg: `<svg viewBox="0 0 70 28" fill="currentColor"><text x="3" y="21" font-size="15" font-weight="800" font-family="system-ui" letter-spacing="0.5">MERKUR</text></svg>`,
  },
  blueprint: {
    label: "Blueprint",
    svg: `<svg viewBox="0 0 80 28" fill="currentColor"><text x="3" y="20" font-size="12" font-weight="700" font-family="system-ui" letter-spacing="0.3">BLUEPRINT</text></svg>`,
  },
};

type Game = {
  name: string;
  provider: string;
  rtp: number;
  hot: boolean;
  new: boolean;
};

const GAMES_DB: Record<string, Game[]> = {
  blackjack: [
    { name: "Blackjack Classic", provider: "Evolution", rtp: 99.5, hot: true, new: false },
    { name: "Blackjack VIP", provider: "Evolution", rtp: 99.5, hot: true, new: false },
    { name: "Speed Blackjack", provider: "Evolution", rtp: 99.3, hot: false, new: true },
    { name: "Infinite Blackjack", provider: "Evolution", rtp: 99.5, hot: true, new: false },
    { name: "Power Blackjack", provider: "Evolution", rtp: 98.8, hot: false, new: false },
    { name: "Free Bet Blackjack", provider: "Evolution", rtp: 98.4, hot: false, new: false },
  ],
  roulette: [
    { name: "Lightning Roulette", provider: "Evolution", rtp: 97.3, hot: true, new: false },
    { name: "Auto Roulette", provider: "Evolution", rtp: 97.3, hot: false, new: false },
    { name: "Immersive Roulette", provider: "Evolution", rtp: 97.3, hot: true, new: false },
    { name: "Turkish Roulette", provider: "Evolution", rtp: 97.3, hot: true, new: true },
    { name: "Speed Roulette", provider: "Evolution", rtp: 97.3, hot: false, new: false },
    { name: "XXXtreme Lightning Roulette", provider: "Evolution", rtp: 97.3, hot: true, new: true },
  ],
  poker: [
    { name: "Casino Hold'em", provider: "Evolution", rtp: 97.8, hot: true, new: false },
    { name: "Three Card Poker", provider: "Evolution", rtp: 96.6, hot: false, new: false },
    { name: "Texas Hold'em Bonus", provider: "Evolution", rtp: 97.9, hot: true, new: false },
    { name: "Caribbean Stud", provider: "Evolution", rtp: 94.8, hot: false, new: false },
    { name: "Side Bet City", provider: "Evolution", rtp: 96.7, hot: false, new: true },
  ],
  dice: [
    { name: "Sic Bo", provider: "Evolution", rtp: 97.2, hot: true, new: false },
    { name: "Craps", provider: "Evolution", rtp: 98.6, hot: false, new: true },
    { name: "Super Sic Bo", provider: "Evolution", rtp: 97.2, hot: true, new: false },
    { name: "Lightning Dice", provider: "Evolution", rtp: 96.2, hot: true, new: false },
  ],
  baccarat: [
    { name: "Baccarat", provider: "Evolution", rtp: 98.9, hot: true, new: false },
    { name: "Speed Baccarat", provider: "Evolution", rtp: 98.9, hot: false, new: false },
    { name: "Lightning Baccarat", provider: "Evolution", rtp: 98.8, hot: true, new: true },
    { name: "Baccarat Squeeze", provider: "Evolution", rtp: 98.9, hot: false, new: false },
  ],
  live: [
    { name: "Crazy Time", provider: "Evolution", rtp: 96.1, hot: true, new: false },
    { name: "Mega Ball", provider: "Evolution", rtp: 95.4, hot: true, new: false },
    { name: "Dream Catcher", provider: "Evolution", rtp: 96.6, hot: false, new: false },
    { name: "Monopoly Live", provider: "Evolution", rtp: 96.2, hot: true, new: false },
    { name: "Deal or No Deal", provider: "Evolution", rtp: 95.4, hot: false, new: false },
    { name: "Football Studio", provider: "Evolution", rtp: 96.3, hot: false, new: true },
    { name: "Cash or Crash", provider: "Evolution", rtp: 99.6, hot: true, new: false },
    { name: "Funky Time", provider: "Evolution", rtp: 95.5, hot: true, new: true },
  ],
  popular: [],
  favorites: [],
  vip: [],
  promotions: [],
  all: [],
};

const CATEGORY_TITLES: Record<string, string> = {
  slots: "Slots",
  blackjack: "Blackjack",
  roulette: "Rulet",
  poker: "Poker",
  dice: "Zar Oyunlari",
  baccarat: "Baccarat",
  live: "Canli Casino",
  popular: "Populer Oyunlar",
  favorites: "Favoriler",
  vip: "VIP Oyunlar",
  promotions: "Promosyonlar",
  all: "Tum Oyunlar",
};

export default function CasinoCategory() {
  const [, params] = useRoute("/casino/:category");
  const [, setLocation] = useLocation();
  const category = params?.category || "popular";
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "hot" | "new">("all");
  const [selectedVendor, setSelectedVendor] = useState<string>("all");

  // Fetch real BLAS345 games for slots category
  const isSlots = category === "slots";
  const slotsQ = trpc.slots.games.useQuery(undefined, { enabled: isSlots });

  // Extract unique vendors sorted by game count
  const vendors = useMemo(() => {
    if (!slotsQ.data) return [];
    const counts: Record<string, number> = {};
    for (const g of slotsQ.data) {
      counts[g.vendor] = (counts[g.vendor] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [slotsQ.data]);

  // For popular/all/favorites/vip, combine all games
  const rawGames = useMemo(() => {
    if (["popular", "all", "vip", "favorites"].includes(category)) {
      return Object.values(GAMES_DB).flat();
    }
    return GAMES_DB[category] || [];
  }, [category]);

  // Filter BLAS345 slot games by search + vendor
  const filteredSlotGames = useMemo(() => {
    if (!isSlots || !slotsQ.data) return [];
    let filtered = slotsQ.data;
    if (selectedVendor !== "all") {
      filtered = filtered.filter(g => g.vendor === selectedVendor);
    }
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(g =>
        g.display_name.toLowerCase().includes(q) || g.vendor.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [isSlots, slotsQ.data, search, selectedVendor]);

  const games = useMemo(() => {
    let filtered = rawGames;
    if (category === "popular") filtered = filtered.filter(g => g.hot);
    if (category === "vip") filtered = filtered.filter(g => g.rtp > 97);
    if (filter === "hot") filtered = filtered.filter(g => g.hot);
    if (filter === "new") filtered = filtered.filter(g => g.new);
    if (search) filtered = filtered.filter(g => g.name.toLowerCase().includes(search.toLowerCase()) || g.provider.toLowerCase().includes(search.toLowerCase()));
    return filtered;
  }, [rawGames, category, filter, search]);

  const title = CATEGORY_TITLES[category] || "Casino";

  // Promotions page
  if (category === "promotions") {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <h1 className="text-xl font-bold text-foreground">{title}</h1>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            { title: "Hos Geldin Bonusu", desc: "Ilk yatirimina %100 bonus, 1000 TL'ye kadar! Minimum 50 TL yatirim gereklidir.", tag: "YENI UYELER", color: "from-primary/20 to-emerald-500/20" },
            { title: "Haftalik Cashback", desc: "Her Pazartesi, onceki haftanin kayiplarinin %10'u hesabina iade edilir.", tag: "HER HAFTA", color: "from-blue-500/20 to-cyan-500/20" },
            { title: "Arkadasini Getir", desc: "Referans linkini paylas, kayit olan her arkadasin icin 50 TL bonus kazan!", tag: "SUREKLI", color: "from-purple-500/20 to-pink-500/20" },
            { title: "Slot Turnuvasi", desc: "Her Cuma 20:00'de baslayan slot turenuvasinda 10.000 TL odul havuzu!", tag: "HAFTALIK", color: "from-orange-500/20 to-red-500/20" },
            { title: "VIP Programi", desc: "Oynadikca seviye atla, ozel bonuslar ve kisisel hesap yoneticisi kazan!", tag: "VIP", color: "from-yellow-500/20 to-amber-500/20" },
            { title: "Gunun Oyunu", desc: "Her gun secilen oyunda %20 ekstra kazanc firsati!", tag: "GUNLUK", color: "from-teal-500/20 to-green-500/20" },
          ].map((promo, i) => (
            <div key={i} className={`bg-gradient-to-br ${promo.color} border border-border rounded-xl p-5 hover:border-primary/30 transition-colors cursor-pointer`}
              onClick={() => toast.info("Promosyon detaylari yakinda aktif olacak!")}
            >
              <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">{promo.tag}</span>
              <h3 className="text-base font-bold text-foreground mt-2">{promo.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{promo.desc}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const vendorLabel = (v: string) => VENDOR_LOGOS[v]?.label || v.charAt(0).toUpperCase() + v.slice(1);

  // Scroll helpers for vendor bar
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  const scrollBy = useCallback((dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 200, behavior: "smooth" });
  }, []);

  // ─── Slots category: real BLAS345 games ───
  if (isSlots) {
    return (
      <div className="p-4 md:p-6 space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-foreground">{title}</h1>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Oyun veya saglayici ara..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* ─── Vendor scroll bar ─── */}
        {vendors.length > 0 && (
          <div className="relative group/scroll">
            {/* Left arrow */}
            {canScrollLeft && (
              <button
                onClick={() => scrollBy(-1)}
                className="absolute left-0 top-0 bottom-0 z-10 w-8 flex items-center justify-center bg-gradient-to-r from-background via-background/90 to-transparent"
              >
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
            {/* Right arrow */}
            {canScrollRight && (
              <button
                onClick={() => scrollBy(1)}
                className="absolute right-0 top-0 bottom-0 z-10 w-8 flex items-center justify-center bg-gradient-to-l from-background via-background/90 to-transparent"
              >
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            )}

            <div
              ref={scrollRef}
              onScroll={checkScroll}
              className="flex gap-2 overflow-x-auto scrollbar-hide px-1 py-1 -mx-1 snap-x snap-mandatory"
            >
              {/* "All" chip */}
              <button
                onClick={() => setSelectedVendor("all")}
                className={`snap-start shrink-0 flex items-center justify-center h-12 px-5 rounded-xl border transition-all duration-200 ${
                  selectedVendor === "all"
                    ? "bg-primary/10 border-primary text-primary shadow-sm shadow-primary/20"
                    : "bg-card border-border text-muted-foreground/70 hover:border-muted-foreground/40 hover:text-foreground"
                }`}
              >
                <span className="text-xs font-bold whitespace-nowrap">
                  Tumu
                </span>
                <span className={`ml-1.5 text-[10px] font-medium ${selectedVendor === "all" ? "text-primary/70" : "text-muted-foreground/50"}`}>
                  {slotsQ.data?.length || 0}
                </span>
              </button>

              {vendors.map(v => {
                const isActive = selectedVendor === v.name;
                const logo = VENDOR_LOGOS[v.name];
                return (
                  <button
                    key={v.name}
                    onClick={() => setSelectedVendor(v.name === selectedVendor ? "all" : v.name)}
                    className={`snap-start shrink-0 flex items-center gap-2 h-12 px-4 rounded-xl border transition-all duration-200 ${
                      isActive
                        ? "bg-primary/10 border-primary text-primary shadow-sm shadow-primary/20"
                        : "bg-card border-border text-muted-foreground/70 hover:border-muted-foreground/40 hover:text-foreground"
                    }`}
                  >
                    {logo ? (
                      <span
                        className="h-5 w-auto shrink-0"
                        dangerouslySetInnerHTML={{
                          __html: logo.svg.replace(
                            'viewBox=',
                            `class="h-5 w-auto" viewBox=`
                          ),
                        }}
                      />
                    ) : (
                      <span className="text-xs font-bold whitespace-nowrap">{vendorLabel(v.name)}</span>
                    )}
                    <span className={`text-[10px] font-medium ${isActive ? "text-primary/70" : "text-muted-foreground/50"}`}>
                      {v.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {slotsQ.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground text-sm">Oyunlar yukleniyor...</span>
          </div>
        ) : slotsQ.isError ? (
          <div className="text-center py-16">
            <p className="text-destructive">Oyunlar yuklenemedi.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {selectedVendor !== "all" && <span className="text-foreground font-medium">{vendorLabel(selectedVendor)} — </span>}
                {filteredSlotGames.length} oyun
              </p>
            </div>
            {filteredSlotGames.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground">Bu kategoride oyun bulunamadi.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {filteredSlotGames.map((game) => (
                  <button
                    key={game.id_game}
                    onClick={() => setLocation(`/slot/${game.id_game}`)}
                    className="group rounded-lg bg-card border border-border hover:border-primary/40 transition-all overflow-hidden text-left"
                  >
                    <div className="aspect-[3/4] bg-gradient-to-br from-secondary to-accent/30 flex items-center justify-center relative overflow-hidden">
                      {game.image ? (
                        <img
                          src={game.image}
                          alt={game.display_name}
                          className="absolute inset-0 w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-4xl opacity-50">🎰</span>
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold">Oyna</span>
                      </div>
                    </div>
                    <div className="p-2.5">
                      <div className="text-xs font-semibold text-foreground truncate">{game.display_name}</div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-[10px] text-muted-foreground truncate">{vendorLabel(game.vendor)}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-foreground">{title}</h1>
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Oyun ara..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          {/* Filters */}
          <div className="flex items-center bg-secondary rounded-lg p-0.5">
            {(["all", "hot", "new"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  filter === f ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f === "all" ? "Tumu" : f === "hot" ? "Populer" : "Yeni"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Games count */}
      <p className="text-sm text-muted-foreground">{games.length} oyun bulundu</p>

      {/* Games Grid */}
      {games.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground">Bu kategoride oyun bulunamadi.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {games.map((game, i) => (
            <button
              key={`${game.name}-${i}`}
              onClick={() => toast.info(`${game.name} yakinda aktif olacak!`)}
              className="group rounded-lg bg-card border border-border hover:border-primary/40 transition-all overflow-hidden text-left"
            >
              <div className="aspect-[3/4] bg-gradient-to-br from-secondary to-accent/30 flex items-center justify-center relative">
                <span className="text-4xl opacity-50 group-hover:opacity-80 transition-opacity">
                  {category === "popular" || category === "all" ? "🎰" :
                   category === "blackjack" ? "🃏" :
                   category === "roulette" ? "🎡" :
                   category === "poker" ? "♠️" :
                   category === "dice" ? "🎲" :
                   category === "baccarat" ? "🍀" :
                   category === "live" ? "📺" : "🎮"}
                </span>
                {game.hot && (
                  <span className="absolute top-2 right-2 bg-destructive text-white text-[10px] font-bold px-1.5 py-0.5 rounded">HOT</span>
                )}
                {game.new && !game.hot && (
                  <span className="absolute top-2 right-2 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded">YENI</span>
                )}
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold">Oyna</span>
                </div>
              </div>
              <div className="p-2.5">
                <div className="text-xs font-semibold text-foreground truncate">{game.name}</div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[10px] text-muted-foreground truncate">{game.provider}</span>
                  <span className="text-[10px] text-primary font-medium">RTP {game.rtp}%</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
