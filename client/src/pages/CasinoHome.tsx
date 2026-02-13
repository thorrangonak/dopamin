import { useLocation } from "wouter";
import { Cherry, Spade, Dice1, Diamond, Zap, Crown, Gift, Flame, Clover, Coins, Dices, Bomb, Rocket, CircleDot, Triangle, Gamepad2, Swords, Grid3x3, Dice5, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import BannerCarousel from "@/components/BannerCarousel";
import { CASINO_BANNERS } from "@/data/banners";
import { trpc } from "@/lib/trpc";
import type { BannerSlide } from "@/components/BannerCarousel";
import { useMemo } from "react";

const CATEGORIES = [
  { label: "Populer Oyunlar", path: "/casino/popular", icon: Flame, color: "from-dp-pink/20 to-dp-red/10", count: 120 },
  { label: "Slots", path: "/casino/slots", icon: Cherry, color: "from-dp-purple/20 to-dp-pink/10", count: 450 },
  { label: "Blackjack", path: "/casino/blackjack", icon: Spade, color: "from-dp-green/20 to-dp-blue/10", count: 35 },
  { label: "Rulet", path: "/game/roulette", icon: Dice1, color: "from-dp-red/20 to-dp-pink/10", count: 28, playable: true },
  { label: "Poker", path: "/casino/poker", icon: Diamond, color: "from-dp-blue/20 to-dp-purple/10", count: 42 },
  { label: "Baccarat", path: "/casino/baccarat", icon: Clover, color: "from-dp-yellow/20 to-dp-green/10", count: 18 },
  { label: "Canli Casino", path: "/casino/live", icon: Zap, color: "from-dp-blue/20 to-dp-green/10", count: 85 },
  { label: "VIP", path: "/casino/vip", icon: Crown, color: "from-dp-purple/20 to-dp-yellow/10", count: 15 },
];

const PLAYABLE_GAMES = [
  { name: "Coin Flip", path: "/game/coinflip", icon: Coins, color: "from-dp-yellow/20 to-dp-pink/10", desc: "Yazi mi Tura mi? 1.96x", hot: true },
  { name: "Dice", path: "/game/dice", icon: Dices, color: "from-dp-purple/20 to-dp-blue/10", desc: "Hedef sayiyi tut!", hot: true },
  { name: "Mines", path: "/game/mines", icon: Bomb, color: "from-dp-red/20 to-dp-pink/10", desc: "Mayinlardan kacin!", hot: true },
  { name: "Crash", path: "/game/crash", icon: Rocket, color: "from-dp-pink/20 to-dp-red/10", desc: "Dogru zamanda cik!", hot: true },
  { name: "Roulette", path: "/game/roulette", icon: CircleDot, color: "from-dp-green/20 to-dp-blue/10", desc: "Klasik Avrupa ruleti", hot: false },
  { name: "Plinko", path: "/game/plinko", icon: Triangle, color: "from-dp-blue/20 to-dp-green/10", desc: "Topu birak, kazan!", hot: false },
  { name: "Taş Kağıt Makas", path: "/game/rps", icon: Swords, color: "from-dp-yellow/20 to-dp-red/10", desc: "Kazanırsan 1.94x!", hot: true },
  { name: "Bingo", path: "/game/bingo", icon: Grid3x3, color: "from-dp-purple/20 to-dp-pink/10", desc: "Çizgi tamamla, 500x!", hot: false },
  { name: "Blackjack", path: "/game/blackjack", icon: Spade, color: "from-dp-green/20 to-dp-blue/10", desc: "21'e yaklaş, kazan!", hot: true },
  { name: "Keno", path: "/game/keno", icon: Dice5, color: "from-dp-blue/20 to-dp-purple/10", desc: "Sayı seç, 10.000x!", hot: true },
  { name: "Limbo", path: "/game/limbo", icon: Zap, color: "from-dp-yellow/20 to-dp-green/10", desc: "Hedef çarpanı geç!", hot: false },
  { name: "Hi-Lo", path: "/game/hilo", icon: ArrowUpDown, color: "from-dp-pink/20 to-dp-purple/10", desc: "Yüksek mi düşük mü?", hot: true },
];

const FEATURED_GAMES = [
  { name: "Sweet Bonanza", provider: "Pragmatic Play", category: "Slots", hot: true },
  { name: "Gates of Olympus", provider: "Pragmatic Play", category: "Slots", hot: true },
  { name: "Big Bass Bonanza", provider: "Pragmatic Play", category: "Slots", hot: false },
  { name: "Lightning Roulette", provider: "Evolution", category: "Rulet", hot: true },
  { name: "Crazy Time", provider: "Evolution", category: "Canlı", hot: true },
  { name: "Blackjack VIP", provider: "Evolution", category: "Blackjack", hot: false },
  { name: "Mega Ball", provider: "Evolution", category: "Canlı", hot: false },
  { name: "Book of Dead", provider: "Play'n GO", category: "Slots", hot: true },
  { name: "Starburst", provider: "NetEnt", category: "Slots", hot: false },
  { name: "Aviator", provider: "Spribe", category: "Crash", hot: true },
  { name: "Plinko", provider: "Spribe", category: "Arcade", hot: false },
  { name: "Mines", provider: "Spribe", category: "Arcade", hot: false },
];

export default function CasinoHome() {
  const [, setLocation] = useLocation();
  const bannersQuery = trpc.banners.casino.useQuery();

  // Use DB banners if available, fallback to static
  const slides: BannerSlide[] = useMemo(() => {
    if (bannersQuery.data && bannersQuery.data.length > 0) {
      return bannersQuery.data.map((b: any) => ({
        id: `banner-${b.id}`,
        imageUrl: b.imageUrl,
        ctaLink: b.ctaLink,
      }));
    }
    return CASINO_BANNERS;
  }, [bannersQuery.data]);

  return (
    <div className="p-4 md:p-6 space-y-5 md:space-y-8">
      {/* Banner Carousel */}
      <BannerCarousel
        slides={slides}
        autoPlayInterval={5000}
        className="group"
      />

      {/* Playable Games */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Gamepad2 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">Aninda Salgi</h2>
          <span className="text-[10px] font-bold bg-dp-green text-white px-1.5 py-0.5 rounded">CANLI</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {PLAYABLE_GAMES.map((game) => (
            <button
              key={game.path}
              onClick={() => setLocation(game.path)}
              className={`p-3 md:p-4 rounded-xl bg-gradient-to-br ${game.color} border border-border dp-card-hover group text-left relative overflow-hidden`}
            >
              {game.hot && (
                <span className="absolute top-2 right-2 dp-gradient-bg text-white text-[8px] font-bold px-1.5 py-0.5 rounded">
                  HOT
                </span>
              )}
              <game.icon className="h-6 w-6 md:h-8 md:w-8 text-foreground mb-2 md:mb-3 group-hover:text-primary transition-colors group-hover:scale-110 transform" />
              <div className="text-sm font-bold text-foreground">{game.name}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{game.desc}</div>
              <div className="mt-2 text-[10px] font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                Oyna →
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Categories Grid */}
      <div>
        <h2 className="text-lg font-bold text-foreground mb-4">Kategoriler</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {CATEGORIES.map(cat => (
            <button
              key={cat.path}
              onClick={() => setLocation(cat.path)}
              className={`p-3 md:p-4 rounded-xl bg-gradient-to-br ${cat.color} border border-border dp-card-hover group text-left`}
            >
              <cat.icon className="h-6 w-6 text-foreground mb-2 group-hover:text-primary transition-colors" />
              <div className="text-sm font-semibold text-foreground">{cat.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{cat.count} oyun</div>
            </button>
          ))}
        </div>
      </div>

      {/* Featured Games */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground">Popüler Oyunlar</h2>
          <button onClick={() => setLocation("/casino/popular")} className="text-sm text-primary hover:underline">
            Tümünü Gör →
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {FEATURED_GAMES.map((game, i) => (
            <button
              key={i}
              onClick={() => toast.info("Bu oyun yakında aktif olacak!")}
              className="group rounded-lg bg-card border border-border hover:border-primary/40 transition-all overflow-hidden"
            >
              <div className="aspect-square md:aspect-[3/4] bg-gradient-to-br from-secondary to-accent/30 flex items-center justify-center relative">
                <Cherry className="h-10 w-10 text-muted-foreground/40" />
                {game.hot && (
                  <span className="absolute top-2 right-2 bg-destructive text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                    HOT
                  </span>
                )}
              </div>
              <div className="p-2">
                <div className="text-xs font-semibold text-foreground truncate">{game.name}</div>
                <div className="text-[10px] text-muted-foreground truncate">{game.provider}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Promotions Banner */}
      <div className="rounded-xl bg-gradient-to-r from-dp-purple/10 to-dp-pink/10 border border-dp-purple/20 p-4 md:p-6">
        <div className="flex items-center gap-3 mb-3">
          <Gift className="h-6 w-6 text-dp-pink" />
          <h2 className="text-lg font-bold text-foreground">Serotonin Boost</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          {[
            { title: "Hoş Geldin Bonusu", desc: "İlk yatırımına %100 bonus, 1000 TL'ye kadar!", tag: "YENİ" },
            { title: "Haftalık Cashback", desc: "Her hafta kayıplarının %10'u geri iade!", tag: "AKTİF" },
            { title: "Arkadaşını Getir", desc: "Her arkadaşın için 50 TL bonus kazan!", tag: "SÜREKLİ" },
          ].map((promo, i) => (
            <div key={i} className="bg-card border border-border rounded-lg p-4 hover:border-primary/30 transition-colors cursor-pointer"
              onClick={() => toast.info("Promosyon detayları yakında!")}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">{promo.tag}</span>
              </div>
              <div className="text-sm font-semibold text-foreground">{promo.title}</div>
              <div className="text-xs text-muted-foreground mt-1">{promo.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Providers */}
      <div>
        <h2 className="text-lg font-bold text-foreground mb-4">Sağlayıcılar</h2>
        <div className="flex flex-wrap gap-2">
          {["Pragmatic Play", "Evolution", "NetEnt", "Play'n GO", "Spribe", "Microgaming", "Yggdrasil", "Red Tiger", "Hacksaw", "Push Gaming"].map(p => (
            <span key={p} className="px-3 py-1.5 bg-secondary border border-border rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors cursor-pointer">
              {p}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
