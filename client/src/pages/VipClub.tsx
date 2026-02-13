import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import {
  Crown, Star, Shield, Gem, Award, Zap,
  TrendingUp, Gift, Users, ChevronRight, Lock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useCurrency } from "@/contexts/CurrencyContext";

const TIER_ICONS: Record<string, React.ReactNode> = {
  bronze: <Shield className="w-6 h-6" />,
  silver: <Star className="w-6 h-6" />,
  gold: <Crown className="w-6 h-6" />,
  platinum: <Gem className="w-6 h-6" />,
  diamond: <Award className="w-6 h-6" />,
  elite: <Zap className="w-6 h-6" />,
};

const TIER_BG: Record<string, string> = {
  bronze: "from-amber-900/30 to-amber-800/10 border-amber-700/40",
  silver: "from-gray-400/20 to-gray-500/10 border-gray-400/40",
  gold: "from-yellow-600/25 to-yellow-700/10 border-yellow-500/40",
  platinum: "from-slate-300/20 to-slate-400/10 border-slate-300/40",
  diamond: "from-cyan-400/20 to-cyan-500/10 border-cyan-400/40",
  elite: "from-red-600/25 to-orange-600/10 border-red-500/40",
};

const TIER_TEXT: Record<string, string> = {
  bronze: "text-amber-500",
  silver: "text-gray-300",
  gold: "text-yellow-400",
  platinum: "text-slate-200",
  diamond: "text-cyan-300",
  elite: "text-red-400",
};

const TIER_GLOW: Record<string, string> = {
  bronze: "shadow-amber-900/20",
  silver: "shadow-gray-400/20",
  gold: "shadow-yellow-500/30",
  platinum: "shadow-slate-300/20",
  diamond: "shadow-cyan-400/30",
  elite: "shadow-red-500/40",
};

export default function VipClub() {
  const { user, loading: authLoading } = useAuth();
  const { formatAmount } = useCurrency();
  const tiersQuery = trpc.vip.tiers.useQuery();
  const profileQuery = trpc.vip.profile.useQuery(undefined, { enabled: !!user });
  const leaderboardQuery = trpc.vip.leaderboard.useQuery();

  const tiers = tiersQuery.data ?? [];
  const profile = profileQuery.data;
  const leaderboard = leaderboardQuery.data ?? [];

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 pb-8">
      {/* Header */}
      <div className="text-center py-8">
        <div className="inline-flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-xl dp-gradient-bg flex items-center justify-center dp-glow-sm">
            <Crown className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold dp-gradient-text">VIP Kulup</h1>
        </div>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Bahis yaptıkça XP kazan, seviye atla ve özel avantajların kilidini aç.
          Her {formatAmount(10)} bahis = 1 XP
        </p>
      </div>

      {/* Current VIP Status */}
      {user && profile ? (
        <div className={`rounded-xl border bg-gradient-to-br p-6 ${TIER_BG[profile.currentTier]} shadow-lg ${TIER_GLOW[profile.currentTier]}`}>
          <div className="flex flex-col md:flex-row items-center gap-6">
            {/* Tier Badge */}
            <div className="flex flex-col items-center gap-2">
              <div className={`w-20 h-20 rounded-full border-2 flex items-center justify-center ${TIER_TEXT[profile.currentTier]} bg-background/30`}
                style={{ borderColor: profile.currentTierInfo?.color }}>
                <div className="scale-150">
                  {TIER_ICONS[profile.currentTier]}
                </div>
              </div>
              <span className={`text-lg font-bold ${TIER_TEXT[profile.currentTier]}`}>
                {profile.currentTierInfo?.label}
              </span>
            </div>

            {/* Progress */}
            <div className="flex-1 w-full space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Toplam XP</span>
                <span className="font-bold text-lg">{profile.totalXp.toLocaleString()} XP</span>
              </div>

              {profile.nextTierInfo ? (
                <>
                  <Progress value={profile.progress} className="h-3" />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{profile.currentTierInfo?.label}</span>
                    <span>{profile.xpForNextTier.toLocaleString()} XP kaldı</span>
                    <span className={TIER_TEXT[profile.nextTierInfo.name]}>
                      {profile.nextTierInfo.label}
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-center text-sm text-primary font-medium">
                  En yüksek seviyedesiniz!
                </div>
              )}

              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-4 pt-2">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Toplam Bahis</p>
                  <p className="font-bold">{profile.totalBets}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Toplam Oynanan</p>
                  <p className="font-bold">{formatAmount(parseFloat(profile.totalWagered))}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Cashback Oranı</p>
                  <p className="font-bold text-primary">{(parseFloat(profile.cashbackRate) * 100).toFixed(1)}%</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : !user ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Lock className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground mb-4">VIP durumunuzu görmek için giriş yapın</p>
          <Button onClick={() => window.location.href = getLoginUrl()}>
            Giriş Yap
          </Button>
        </div>
      ) : null}

      {/* Tier Cards */}
      <div>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          VIP Seviyeleri
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tiers.map((tier, idx) => {
            const isCurrentTier = profile?.currentTier === tier.name;
            const isUnlocked = profile ? profile.totalXp >= tier.minXp : false;

            return (
              <div
                key={tier.name}
                className={`rounded-xl border p-5 transition-all relative overflow-hidden
                  ${isCurrentTier
                    ? `bg-gradient-to-br ${TIER_BG[tier.name]} shadow-lg ${TIER_GLOW[tier.name]} ring-1 ring-primary/30`
                    : isUnlocked
                      ? `bg-gradient-to-br ${TIER_BG[tier.name]} opacity-80`
                      : "bg-card border-border opacity-60"
                  }`}
              >
                {isCurrentTier && (
                  <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-[10px] px-2 py-0.5 rounded-full font-bold">
                    AKTİF
                  </div>
                )}

                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center border ${TIER_TEXT[tier.name]}`}
                    style={{ borderColor: tier.color, backgroundColor: `${tier.color}15` }}
                  >
                    {TIER_ICONS[tier.name]}
                  </div>
                  <div>
                    <h3 className={`font-bold text-lg ${TIER_TEXT[tier.name]}`}>{tier.label}</h3>
                    <p className="text-xs text-muted-foreground">
                      {tier.minXp === 0 ? "Başlangıç" : `${tier.minXp.toLocaleString()} XP`}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {tier.benefits.map((benefit, bIdx) => (
                    <div key={bIdx} className="flex items-center gap-2 text-sm">
                      <ChevronRight className="w-3 h-3 text-primary flex-shrink-0" />
                      <span className={isUnlocked ? "text-foreground" : "text-muted-foreground"}>
                        {benefit}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Cashback</span>
                  <span className="font-bold" style={{ color: tier.color }}>
                    {(tier.cashbackRate * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs mt-1">
                  <span className="text-muted-foreground">Bonus Çarpanı</span>
                  <span className="font-bold" style={{ color: tier.color }}>
                    {tier.bonusMultiplier.toFixed(2)}x
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Leaderboard */}
      <div>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          VIP Sıralaması
        </h2>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {leaderboard.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Henüz VIP üye bulunmuyor
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-3 text-xs text-muted-foreground font-medium w-12">#</th>
                  <th className="text-left p-3 text-xs text-muted-foreground font-medium">Üye</th>
                  <th className="text-left p-3 text-xs text-muted-foreground font-medium">Seviye</th>
                  <th className="text-right p-3 text-xs text-muted-foreground font-medium">XP</th>
                  <th className="text-right p-3 text-xs text-muted-foreground font-medium hidden sm:table-cell">Toplam Bahis</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry, idx) => (
                  <tr key={entry.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="p-3 text-sm font-bold">
                      {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : idx + 1}
                    </td>
                    <td className="p-3 text-sm">
                      <span className="font-medium">Üye #{entry.userId}</span>
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 text-sm font-medium ${TIER_TEXT[entry.currentTier]}`}>
                        {TIER_ICONS[entry.currentTier]}
                        <span className="hidden sm:inline">
                          {tiers.find(t => t.name === entry.currentTier)?.label ?? entry.currentTier}
                        </span>
                      </span>
                    </td>
                    <td className="p-3 text-right text-sm font-bold">{entry.totalXp.toLocaleString()}</td>
                    <td className="p-3 text-right text-sm text-muted-foreground hidden sm:table-cell">{entry.totalBets}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* How it works */}
      <div>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Gift className="w-5 h-5 text-primary" />
          Nasıl Çalışır?
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-gradient-to-br from-dp-purple/10 to-transparent p-5 dp-card-hover">
            <div className="w-10 h-10 rounded-lg dp-gradient-bg flex items-center justify-center mb-3 dp-glow-sm">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <h3 className="font-bold mb-1">XP Kazan</h3>
            <p className="text-sm text-muted-foreground">
              Her {formatAmount(10)} bahis veya casino oyunu icin 1 XP kazanirsiniz. Spor bahisleri ve casino oyunlari dahil.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-gradient-to-br from-dp-blue/10 to-transparent p-5 dp-card-hover">
            <div className="w-10 h-10 rounded-lg bg-dp-blue flex items-center justify-center mb-3">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <h3 className="font-bold mb-1">Seviye Atla</h3>
            <p className="text-sm text-muted-foreground">
              Yeterli XP topladiginizda otomatik olarak bir ust seviyeye gecersiniz. 6 farkli VIP seviyesi mevcut.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-gradient-to-br from-dp-pink/10 to-transparent p-5 dp-card-hover">
            <div className="w-10 h-10 rounded-lg bg-dp-pink flex items-center justify-center mb-3">
              <Gift className="w-5 h-5 text-white" />
            </div>
            <h3 className="font-bold mb-1">Avantajlari Kullan</h3>
            <p className="text-sm text-muted-foreground">
              Her seviyede artan cashback orani, bonus carpani ve ozel ayricaliklar sizi bekliyor.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
