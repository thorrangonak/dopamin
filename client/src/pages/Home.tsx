import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import {
  Activity, TrendingUp, Ticket, Radio, Bot, Wallet,
  ArrowRight, Trophy, Zap, Shield, ChevronRight, Crown, Flame, Star
} from "lucide-react";
import BannerCarousel from "@/components/BannerCarousel";
import { SPORTS_BANNERS } from "@/data/banners";
import type { BannerSlide } from "@/components/BannerCarousel";
import { useMemo } from "react";

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const sportsQuery = trpc.sports.list.useQuery();
  const bannersQuery = trpc.banners.sports.useQuery();

  // Use DB banners if available, fallback to static
  const slides: BannerSlide[] = useMemo(() => {
    if (bannersQuery.data && bannersQuery.data.length > 0) {
      return bannersQuery.data.map((b: any) => ({
        id: `banner-${b.id}`,
        imageUrl: b.imageUrl,
        ctaLink: b.ctaLink,
      }));
    }
    return SPORTS_BANNERS;
  }, [bannersQuery.data]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Banner Carousel */}
      <BannerCarousel
        slides={slides}
        autoPlayInterval={5000}
        className="group"
      />

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Spor Dali", value: sportsQuery.data?.length ?? "70+", icon: Activity, gradient: "from-dp-purple/20 to-dp-pink/10" },
          { label: "Canli Mac", value: "Anlik", icon: Radio, gradient: "from-dp-green/20 to-dp-blue/10" },
          { label: "Market Cesidi", value: "3+", icon: TrendingUp, gradient: "from-dp-blue/20 to-dp-purple/10" },
          { label: "AI Asistan", value: "Aktif", icon: Bot, gradient: "from-dp-pink/20 to-dp-yellow/10" },
        ].map((stat) => (
          <div key={stat.label} className={`bg-gradient-to-br ${stat.gradient} border border-border rounded-xl p-3 md:p-4 dp-card-hover`}>
            <stat.icon className="h-5 w-5 text-primary mb-2" />
            <div className="text-lg font-bold text-foreground">{stat.value}</div>
            <div className="text-xs text-muted-foreground">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Features */}
      <div className="grid md:grid-cols-3 gap-3">
        <FeatureCard
          icon={<Trophy className="h-5 w-5 text-dp-purple" />}
          title="Spor Bahisleri"
          desc="Futbol, basketbol, tenis ve 70+ spor dalinda en iyi oranlarla bahis yapin."
          gradient="from-dp-purple/10 to-transparent"
          onClick={() => setLocation("/sports")}
        />
        <FeatureCard
          icon={<Zap className="h-5 w-5 text-dp-green" />}
          title="Canli Skor"
          desc="Devam eden maclarin skorlarini anlik takip edin, kuponlarinizi canli izleyin."
          gradient="from-dp-green/10 to-transparent"
          onClick={() => setLocation("/live")}
        />
        <FeatureCard
          icon={<Bot className="h-5 w-5 text-dp-blue" />}
          title="AI Asistan"
          desc="Yapay zeka destekli bahis onerileri ve mac analizleri alin."
          gradient="from-dp-blue/10 to-transparent"
          onClick={() => setLocation("/assistant")}
        />
      </div>

      {/* Popular sports */}
      {sportsQuery.data && sportsQuery.data.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Flame className="h-4 w-4 text-dp-pink" />
              Dopamin Rush
            </h2>
            <button
              onClick={() => setLocation("/sports")}
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              Tumunu Gor <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {sportsQuery.data.slice(0, 10).map((sport: any, idx: number) => (
              <button
                key={sport.sportKey || sport.key || `sport-${idx}`}
                onClick={() => setLocation(`/sports?sport=${sport.groupName?.toLowerCase() || sport.group?.toLowerCase()}`)}
                className="bg-card border border-border rounded-lg p-3 text-left dp-card-hover"
              >
                <div className="text-sm font-medium text-foreground truncate">{sport.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{sport.groupName || sport.group}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* VIP & AI promo */}
      <div className="grid md:grid-cols-2 gap-3">
        <button
          onClick={() => setLocation("/vip")}
          className="rounded-xl bg-gradient-to-br from-dp-purple/15 to-dp-pink/10 border border-dp-purple/20 p-4 md:p-5 text-left dp-card-hover group"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg dp-gradient-bg flex items-center justify-center dp-glow-sm">
              <Crown className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">Endorphin Elite</h3>
              <p className="text-xs text-muted-foreground">Ozel oduller ve ayricaliklar</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">Bahisleriniz ile XP kazanin, seviyeleri asarak ozel bonuslar ve ayricaliklar elde edin.</p>
        </button>
        <button
          onClick={() => setLocation("/assistant")}
          className="rounded-xl bg-gradient-to-br from-dp-blue/15 to-dp-green/10 border border-dp-blue/20 p-4 md:p-5 text-left dp-card-hover group"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-dp-blue flex items-center justify-center">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">AI Asistan</h3>
              <p className="text-xs text-muted-foreground">Akilli bahis onerileri</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">Yapay zeka ile mac analizleri yapin, istatistiklere dayali bahis onerileri alin.</p>
        </button>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, desc, gradient, onClick }: { icon: React.ReactNode; title: string; desc: string; gradient: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`bg-gradient-to-br ${gradient} border border-border rounded-xl p-4 md:p-5 text-left dp-card-hover group`}
    >
      <div className="mb-3">{icon}</div>
      <h3 className="text-sm font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">{title}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
    </button>
  );
}
