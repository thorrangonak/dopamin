import { trpc } from "@/lib/trpc";
import { useBetSlip } from "@/contexts/BetSlipContext";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Clock, Radio, Trophy, TrendingUp, Shield, BarChart3 } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

export default function EventDetail() {
  const params = useParams<{ sportKey: string; eventId: string }>();
  const [, setLocation] = useLocation();
  const { addSelection, isSelected } = useBetSlip();

  const eventQuery = trpc.eventDetail.getWithOdds.useQuery(
    { eventId: params.eventId!, sportKey: params.sportKey! },
    { enabled: !!params.eventId && !!params.sportKey }
  );

  const cachedEvent = trpc.eventDetail.get.useQuery(
    { eventId: params.eventId! },
    { enabled: !!params.eventId }
  );

  const event = eventQuery.data;
  const cached = cachedEvent.data;
  const isLive = cached?.isLive === 1;
  const isCompleted = cached?.completed === 1;
  const homeScore = cached?.homeScore;
  const awayScore = cached?.awayScore;
  const commence = event?.commence_time ? new Date(event.commence_time) : cached?.commenceTime ? new Date(cached.commenceTime) : null;

  function getAllMarketsFromBookmakers(bookmakers: any[]) {
    if (!bookmakers?.length) return { h2h: null, spreads: null, totals: null, allBookmakers: [] };
    let h2h: any[] | null = null;
    let spreads: any[] | null = null;
    let totals: any[] | null = null;
    for (const bm of bookmakers) {
      for (const market of bm.markets || []) {
        if (market.key === "h2h" && !h2h) h2h = market.outcomes;
        if (market.key === "spreads" && !spreads) spreads = market.outcomes;
        if (market.key === "totals" && !totals) totals = market.outcomes;
      }
    }
    return { h2h, spreads, totals, allBookmakers: bookmakers };
  }

  function getBookmakerOddsForMarket(bookmakers: any[], marketKey: string) {
    const result: Array<{ bookmaker: string; outcomes: any[] }> = [];
    for (const bm of bookmakers) {
      const market = bm.markets?.find((m: any) => m.key === marketKey);
      if (market) result.push({ bookmaker: bm.title, outcomes: market.outcomes });
    }
    return result;
  }

  const markets = event?.bookmakers ? getAllMarketsFromBookmakers(event.bookmakers) : { h2h: null, spreads: null, totals: null, allBookmakers: [] };

  return (
    <div className="p-4 md:p-6">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setLocation("/sports")}
        className="mb-4 text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4 mr-1" /> Sporlar
      </Button>

      {eventQuery.isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground text-sm">Maç detayları yükleniyor...</span>
        </div>
      ) : !event && !cached ? (
        <div className="text-center py-20">
          <p className="text-muted-foreground text-sm">Maç bulunamadı.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Match Header */}
          <div className="bg-card border border-border rounded-lg p-6">
            {/* Status */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                {isLive ? (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 rounded-full">
                    <Radio className="h-3 w-3 text-primary animate-pulse" />
                    <span className="text-xs text-primary font-medium uppercase">Canlı</span>
                  </div>
                ) : isCompleted ? (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-muted rounded-full">
                    <Trophy className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground font-medium uppercase">Tamamlandı</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-stake-blue/10 rounded-full">
                    <Clock className="h-3 w-3 text-stake-blue" />
                    <span className="text-xs text-stake-blue font-medium uppercase">Yaklaşan</span>
                  </div>
                )}
              </div>
              {commence && (
                <span className="text-xs text-muted-foreground">
                  {format(commence, "dd MMMM yyyy · HH:mm", { locale: tr })}
                </span>
              )}
            </div>

            {/* Teams & Score */}
            <div className="flex items-center justify-center gap-6 md:gap-12">
              <div className="flex-1 text-center">
                <div className="w-14 h-14 md:w-16 md:h-16 mx-auto mb-3 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <span className="text-xl md:text-2xl font-bold text-primary">
                    {(event?.home_team || cached?.homeTeam || "?").charAt(0)}
                  </span>
                </div>
                <h2 className="font-bold text-base md:text-lg text-foreground">
                  {event?.home_team || cached?.homeTeam}
                </h2>
                <span className="text-xs text-muted-foreground">Ev Sahibi</span>
              </div>

              <div className="text-center">
                {(isLive || isCompleted) && homeScore !== null && awayScore !== null ? (
                  <div className="flex items-center gap-3">
                    <span className={`text-3xl md:text-4xl font-bold ${isLive ? "text-primary" : "text-foreground"}`}>{homeScore}</span>
                    <span className="text-xl text-muted-foreground">:</span>
                    <span className={`text-3xl md:text-4xl font-bold ${isLive ? "text-primary" : "text-foreground"}`}>{awayScore}</span>
                  </div>
                ) : (
                  <div className="px-4 py-2 bg-secondary rounded-lg">
                    <span className="text-xl font-bold text-muted-foreground">VS</span>
                  </div>
                )}
                {isLive && (
                  <div className="mt-2 flex items-center justify-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    <span className="text-[10px] text-primary uppercase font-medium">Devam Ediyor</span>
                  </div>
                )}
              </div>

              <div className="flex-1 text-center">
                <div className="w-14 h-14 md:w-16 md:h-16 mx-auto mb-3 rounded-full bg-stake-blue/10 border border-stake-blue/20 flex items-center justify-center">
                  <span className="text-xl md:text-2xl font-bold text-stake-blue">
                    {(event?.away_team || cached?.awayTeam || "?").charAt(0)}
                  </span>
                </div>
                <h2 className="font-bold text-base md:text-lg text-foreground">
                  {event?.away_team || cached?.awayTeam}
                </h2>
                <span className="text-xs text-muted-foreground">Deplasman</span>
              </div>
            </div>
          </div>

          {/* Markets */}
          {event?.bookmakers && event.bookmakers.length > 0 && (
            <>
              {/* Quick Bet */}
              <div className="bg-card border border-border rounded-lg p-5">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <h3 className="text-base font-bold text-foreground">Hızlı Bahis</h3>
                  <span className="text-xs text-muted-foreground ml-auto">En iyi oranlar</span>
                </div>

                {markets.h2h && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1 h-4 bg-primary rounded-full" />
                      <span className="text-xs text-muted-foreground uppercase font-medium">Maç Sonucu (1X2)</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {markets.h2h.map((o: any) => {
                        const sel = isSelected(params.eventId!, "h2h", o.name);
                        return (
                          <button
                            key={o.name}
                            onClick={() => addSelection({
                              eventId: params.eventId!, sportKey: params.sportKey!,
                              homeTeam: event.home_team, awayTeam: event.away_team,
                              commenceTime: event.commence_time,
                              marketKey: "h2h", outcomeName: o.name, outcomePrice: o.price,
                            })}
                            className={`py-3 px-3 rounded-lg text-center transition-all ${
                              sel ? "bg-primary/20 border border-primary text-primary" : "bg-secondary border border-transparent hover:bg-accent text-foreground"
                            }`}
                          >
                            <div className="text-[10px] text-muted-foreground mb-1 truncate">
                              {o.name === event.home_team ? "1 - Ev Sahibi" : o.name === event.away_team ? "2 - Deplasman" : "X - Beraberlik"}
                            </div>
                            <div className="text-lg font-bold">{o.price.toFixed(2)}</div>
                            <div className="text-[10px] text-muted-foreground truncate mt-0.5">{o.name}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {markets.spreads && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1 h-4 bg-stake-blue rounded-full" />
                      <span className="text-xs text-muted-foreground uppercase font-medium">Handikap (Spread)</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {markets.spreads.map((o: any) => {
                        const sel = isSelected(params.eventId!, "spreads", o.name);
                        return (
                          <button
                            key={o.name}
                            onClick={() => addSelection({
                              eventId: params.eventId!, sportKey: params.sportKey!,
                              homeTeam: event.home_team, awayTeam: event.away_team,
                              commenceTime: event.commence_time,
                              marketKey: "spreads", outcomeName: o.name, outcomePrice: o.price, point: o.point,
                            })}
                            className={`py-3 px-3 rounded-lg text-center transition-all ${
                              sel ? "bg-stake-blue/20 border border-stake-blue text-stake-blue" : "bg-secondary border border-transparent hover:bg-accent text-foreground"
                            }`}
                          >
                            <div className="text-[10px] text-muted-foreground mb-1 truncate">{o.name} ({o.point > 0 ? "+" : ""}{o.point})</div>
                            <div className="text-lg font-bold">{o.price.toFixed(2)}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {markets.totals && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1 h-4 bg-stake-green rounded-full" />
                      <span className="text-xs text-muted-foreground uppercase font-medium">Alt/Üst (Totals)</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {markets.totals.map((o: any) => {
                        const sel = isSelected(params.eventId!, "totals", o.name);
                        return (
                          <button
                            key={o.name}
                            onClick={() => addSelection({
                              eventId: params.eventId!, sportKey: params.sportKey!,
                              homeTeam: event.home_team, awayTeam: event.away_team,
                              commenceTime: event.commence_time,
                              marketKey: "totals", outcomeName: o.name, outcomePrice: o.price, point: o.point,
                            })}
                            className={`py-3 px-3 rounded-lg text-center transition-all ${
                              sel ? "bg-stake-green/20 border border-stake-green text-stake-green" : "bg-secondary border border-transparent hover:bg-accent text-foreground"
                            }`}
                          >
                            <div className="text-[10px] text-muted-foreground mb-1">{o.name === "Over" ? "Üst" : "Alt"} {o.point}</div>
                            <div className="text-lg font-bold">{o.price.toFixed(2)}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Bookmaker Comparison */}
              <div className="bg-card border border-border rounded-lg p-5">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="h-5 w-5 text-muted-foreground" />
                  <h3 className="text-base font-bold text-foreground">Bahisçi Karşılaştırma</h3>
                </div>

                {["h2h", "spreads", "totals"].map(marketKey => {
                  const bookmakers = getBookmakerOddsForMarket(event.bookmakers, marketKey);
                  if (bookmakers.length === 0) return null;
                  const label = marketKey === "h2h" ? "Maç Sonucu" : marketKey === "spreads" ? "Handikap" : "Alt/Üst";
                  return (
                    <div key={marketKey} className="mb-5 last:mb-0">
                      <div className="flex items-center gap-2 mb-3">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground uppercase font-medium">{label}</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left py-2 px-3 text-xs text-muted-foreground font-medium">Bahisçi</th>
                              {bookmakers[0]?.outcomes.map((o: any, i: number) => (
                                <th key={i} className="text-center py-2 px-3 text-xs text-muted-foreground font-medium">
                                  {marketKey === "h2h"
                                    ? (i === 0 ? "1" : i === bookmakers[0].outcomes.length - 1 ? "2" : "X")
                                    : `${o.name}${o.point !== undefined ? ` (${o.point > 0 ? "+" : ""}${o.point})` : ""}`
                                  }
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {bookmakers.map((bm, idx) => (
                              <tr key={idx} className="border-b border-border/30 hover:bg-accent/20 transition-colors">
                                <td className="py-2 px-3 text-foreground text-sm">{bm.bookmaker}</td>
                                {bm.outcomes.map((o: any, oi: number) => (
                                  <td key={oi} className="text-center py-2 px-3">
                                    <span className="text-sm font-semibold text-foreground">{o.price.toFixed(2)}</span>
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
