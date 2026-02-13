import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Ticket, Loader2, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { getLoginUrl } from "@/const";
import { format } from "date-fns";
import { useCurrency } from "@/contexts/CurrencyContext";

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Bekliyor", color: "text-stake-blue", icon: Clock },
  won: { label: "Kazandı", color: "text-primary", icon: CheckCircle },
  lost: { label: "Kaybetti", color: "text-destructive", icon: XCircle },
  partial: { label: "Kısmi", color: "text-stake-yellow", icon: Clock },
  refunded: { label: "İade", color: "text-muted-foreground", icon: Clock },
};

function LiveScoreBadge({ homeScore, awayScore, isLive }: { homeScore: number | null; awayScore: number | null; isLive: boolean }) {
  if (homeScore === null || awayScore === null) return null;
  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold ${
      isLive ? "bg-primary/15 text-primary" : "bg-stake-blue/10 text-stake-blue"
    }`}>
      {isLive && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
        </span>
      )}
      {homeScore} - {awayScore}
    </div>
  );
}

export default function MyBets() {
  const { isAuthenticated, loading } = useAuth();
  const { formatAmount } = useCurrency();
  const [filter, setFilter] = useState("all");
  const [expandedBet, setExpandedBet] = useState<number | null>(null);

  const betsQuery = trpc.bets.myBets.useQuery({ status: filter }, { enabled: isAuthenticated });
  const betDetailQuery = trpc.bets.detail.useQuery(
    { betId: expandedBet! },
    { enabled: !!expandedBet && isAuthenticated }
  );

  const myBetScoresQuery = trpc.liveScores.myBetScores.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  const eventScores = myBetScoresQuery.data?.eventScores ?? {};
  const betEventMap = myBetScoresQuery.data?.betEventMap ?? {};

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-20 p-4">
        <Ticket className="h-10 w-10 text-muted-foreground mb-4" />
        <h2 className="text-lg font-bold mb-2 text-foreground">Giriş Gerekli</h2>
        <p className="text-muted-foreground text-sm mb-4">Kuponlarınızı görmek için giriş yapın.</p>
        <Button onClick={() => { window.location.href = getLoginUrl(); }} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">Giriş Yap</Button>
      </div>
    );
  }

  const filters = [
    { value: "all", label: "Tümü" },
    { value: "pending", label: "Bekleyen" },
    { value: "won", label: "Kazanan" },
    { value: "lost", label: "Kaybeden" },
  ];

  function betHasLiveEvents(betId: number): boolean {
    const eventIds = betEventMap[betId] ?? [];
    return eventIds.some(eid => eventScores[eid]?.isLive);
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-foreground">Kuponlarım</h1>
        <span className="text-xs text-muted-foreground">{betsQuery.data?.length || 0} kupon</span>
      </div>

      <div className="flex gap-2 mb-4">
        {filters.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === f.value ? "bg-primary/15 text-primary" : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {betsQuery.isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : !betsQuery.data?.length ? (
        <div className="text-center py-20">
          <Ticket className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Henüz kupon yok</p>
        </div>
      ) : (
        <div className="space-y-2">
          {betsQuery.data.map((bet: any) => {
            const sc = statusConfig[bet.status] || statusConfig.pending;
            const isExpanded = expandedBet === bet.id;
            const hasLive = bet.status === "pending" && betHasLiveEvents(bet.id);
            return (
              <div key={bet.id} className={`bg-card border rounded-lg overflow-hidden transition-colors ${
                hasLive ? "border-primary/40" : "border-border hover:bg-accent/20"
              }`}>
                <button onClick={() => setExpandedBet(isExpanded ? null : bet.id)} className="w-full px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <sc.icon className={`h-5 w-5 ${sc.color}`} />
                    <div className="text-left">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-foreground">#{bet.id}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${sc.color}`}>{sc.label}</span>
                        <span className="text-xs text-muted-foreground">{bet.type === "combo" ? "Kombine" : "Tekli"}</span>
                        {hasLive && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-primary">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
                            </span>
                            CANLI
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(bet.createdAt), "dd.MM.yy HH:mm")}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Bahis: {formatAmount(bet.stake)}</div>
                      <div className="text-sm font-bold text-primary">{formatAmount(bet.potentialWin)}</div>
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>

                {isExpanded && betDetailQuery.data && (
                  <div className="border-t border-border px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                      <span>Toplam Oran: {parseFloat(betDetailQuery.data.totalOdds).toFixed(2)}</span>
                    </div>
                    {betDetailQuery.data.items?.map((item: any) => {
                      const itemSc = statusConfig[item.status] || statusConfig.pending;
                      const liveScore = eventScores[item.eventId];
                      return (
                        <div key={item.id} className={`flex items-center justify-between py-2 border-b border-border/30 last:border-0 ${
                          liveScore?.isLive ? "bg-primary/5 -mx-2 px-2 rounded" : ""
                        }`}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-foreground">{item.homeTeam} vs {item.awayTeam}</span>
                              {liveScore && (
                                <LiveScoreBadge homeScore={liveScore.homeScore} awayScore={liveScore.awayScore} isLive={liveScore.isLive} />
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {item.marketKey === "h2h" ? "Maç Sonucu" : item.marketKey === "spreads" ? "Handikap" : "Alt/Üst"}: {item.outcomeName}
                              {item.point && ` (${item.point})`}
                            </div>
                            {!liveScore && item.homeScore !== null && item.awayScore !== null && (
                              <div className="text-xs text-stake-blue mt-0.5">Skor: {item.homeScore} - {item.awayScore}</div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-sm font-bold text-foreground">{parseFloat(item.outcomePrice).toFixed(2)}</span>
                            <itemSc.icon className={`h-4 w-4 ${itemSc.color}`} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {isExpanded && betDetailQuery.isLoading && (
                  <div className="border-t border-border px-4 py-4 text-center">
                    <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
