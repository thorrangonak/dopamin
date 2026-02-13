import { useLocation, useRoute } from "wouter";
import { Search, Star, Flame, SlidersHorizontal } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

type Game = {
  name: string;
  provider: string;
  rtp: number;
  hot: boolean;
  new: boolean;
};

const GAMES_DB: Record<string, Game[]> = {
  slots: [
    { name: "Sweet Bonanza", provider: "Pragmatic Play", rtp: 96.5, hot: true, new: false },
    { name: "Gates of Olympus", provider: "Pragmatic Play", rtp: 96.5, hot: true, new: false },
    { name: "Big Bass Bonanza", provider: "Pragmatic Play", rtp: 96.7, hot: false, new: false },
    { name: "Sugar Rush", provider: "Pragmatic Play", rtp: 96.5, hot: true, new: true },
    { name: "Starlight Princess", provider: "Pragmatic Play", rtp: 96.5, hot: true, new: false },
    { name: "Book of Dead", provider: "Play'n GO", rtp: 96.2, hot: true, new: false },
    { name: "Starburst", provider: "NetEnt", rtp: 96.1, hot: false, new: false },
    { name: "Gonzo's Quest", provider: "NetEnt", rtp: 95.9, hot: false, new: false },
    { name: "Reactoonz", provider: "Play'n GO", rtp: 96.5, hot: false, new: false },
    { name: "Jammin' Jars", provider: "Push Gaming", rtp: 96.8, hot: false, new: false },
    { name: "Razor Shark", provider: "Push Gaming", rtp: 96.7, hot: true, new: false },
    { name: "Fruit Party", provider: "Pragmatic Play", rtp: 96.5, hot: false, new: false },
    { name: "Dog House", provider: "Pragmatic Play", rtp: 96.5, hot: false, new: true },
    { name: "Wild West Gold", provider: "Pragmatic Play", rtp: 96.5, hot: true, new: false },
    { name: "Buffalo King", provider: "Pragmatic Play", rtp: 96.1, hot: false, new: false },
    { name: "Wanted Dead or Wild", provider: "Hacksaw", rtp: 96.4, hot: true, new: true },
  ],
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
  slots: "🎰 Slots",
  blackjack: "🃏 Blackjack",
  roulette: "🎡 Rulet",
  poker: "♠️ Poker",
  dice: "🎲 Zar Oyunları",
  baccarat: "🍀 Baccarat",
  live: "⚡ Canlı Casino",
  popular: "🔥 Popüler Oyunlar",
  favorites: "⭐ Favoriler",
  vip: "👑 VIP Oyunlar",
  promotions: "🎁 Promosyonlar",
  all: "📂 Tüm Oyunlar",
};

export default function CasinoCategory() {
  const [, params] = useRoute("/casino/:category");
  const category = params?.category || "popular";
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "hot" | "new">("all");

  // For popular/all/favorites/vip, combine all games
  const rawGames = useMemo(() => {
    if (["popular", "all", "vip", "favorites"].includes(category)) {
      return Object.values(GAMES_DB).flat();
    }
    return GAMES_DB[category] || [];
  }, [category]);

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
            { title: "🎉 Hoş Geldin Bonusu", desc: "İlk yatırımına %100 bonus, 1000 TL'ye kadar! Minimum 50 TL yatırım gereklidir.", tag: "YENİ ÜYELER", color: "from-primary/20 to-emerald-500/20" },
            { title: "💰 Haftalık Cashback", desc: "Her Pazartesi, önceki haftanın kayıplarının %10'u hesabına iade edilir.", tag: "HER HAFTA", color: "from-blue-500/20 to-cyan-500/20" },
            { title: "👥 Arkadaşını Getir", desc: "Referans linkini paylaş, kayıt olan her arkadaşın için 50 TL bonus kazan!", tag: "SÜREKLİ", color: "from-purple-500/20 to-pink-500/20" },
            { title: "🎰 Slot Turnuvası", desc: "Her Cuma 20:00'de başlayan slot turnuvasında 10.000 TL ödül havuzu!", tag: "HAFTALIK", color: "from-orange-500/20 to-red-500/20" },
            { title: "🏆 VIP Programı", desc: "Oynadıkça seviye atla, özel bonuslar ve kişisel hesap yöneticisi kazan!", tag: "VIP", color: "from-yellow-500/20 to-amber-500/20" },
            { title: "🎲 Günün Oyunu", desc: "Her gün seçilen oyunda %20 ekstra kazanç fırsatı!", tag: "GÜNLÜK", color: "from-teal-500/20 to-green-500/20" },
          ].map((promo, i) => (
            <div key={i} className={`bg-gradient-to-br ${promo.color} border border-border rounded-xl p-5 hover:border-primary/30 transition-colors cursor-pointer`}
              onClick={() => toast.info("Promosyon detayları yakında aktif olacak!")}
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
                {f === "all" ? "Tümü" : f === "hot" ? "🔥 Popüler" : "✨ Yeni"}
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
          <p className="text-muted-foreground">Bu kategoride oyun bulunamadı.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {games.map((game, i) => (
            <button
              key={`${game.name}-${i}`}
              onClick={() => toast.info(`${game.name} yakında aktif olacak!`)}
              className="group rounded-lg bg-card border border-border hover:border-primary/40 transition-all overflow-hidden text-left"
            >
              <div className="aspect-[3/4] bg-gradient-to-br from-secondary to-accent/30 flex items-center justify-center relative">
                <span className="text-4xl opacity-50 group-hover:opacity-80 transition-opacity">
                  {category === "slots" || category === "popular" || category === "all" ? "🎰" :
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
                  <span className="absolute top-2 right-2 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded">YENİ</span>
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
