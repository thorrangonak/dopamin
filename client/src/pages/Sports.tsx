import { trpc } from "@/lib/trpc";
import { useBetSlip } from "@/contexts/BetSlipContext";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Loader2, Search, Clock, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

export default function Sports() {
  const sportsQuery = trpc.sports.list.useQuery();
  const [selectedSport, setSelectedSport] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const eventsQuery = trpc.events.bySport.useQuery(
    { sportKey: selectedSport! },
    { enabled: !!selectedSport }
  );
  const [, setLocation] = useLocation();
  const { addSelection, isSelected } = useBetSlip();

  const groupedSports = useMemo(() => {
    if (!sportsQuery.data) return {};
    const groups: Record<string, typeof sportsQuery.data> = {};
    for (const s of sportsQuery.data) {
      const g = s.groupName;
      if (!groups[g]) groups[g] = [];
      groups[g].push(s);
    }
    return groups;
  }, [sportsQuery.data]);

  const filteredGroups = useMemo(() => {
    if (!searchTerm) return groupedSports;
    const term = searchTerm.toLowerCase();
    const result: Record<string, typeof sportsQuery.data> = {};
    for (const [group, sports] of Object.entries(groupedSports)) {
      const filtered = (sports ?? []).filter(s =>
        s.title.toLowerCase().includes(term) || s.groupName.toLowerCase().includes(term)
      );
      if (filtered.length > 0) result[group] = filtered;
    }
    return result;
  }, [groupedSports, searchTerm]);

  function getBestOdds(bookmakers: any[], marketKey: string) {
    if (!bookmakers?.length) return null;
    for (const bm of bookmakers) {
      const market = bm.markets?.find((m: any) => m.key === marketKey);
      if (market) return market.outcomes;
    }
    return null;
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex gap-6">
        {/* Inline sport filter for this page (sidebar already has global nav) */}
        <div className="w-56 shrink-0 hidden lg:block">
          <div className="sticky top-4">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Spor ara..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-secondary border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="h-[calc(100vh-10rem)] overflow-y-auto space-y-3 pr-1">
              {Object.entries(filteredGroups).map(([group, sports]) => (
                <div key={group}>
                  <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1 px-2 font-medium">
                    {group}
                  </div>
                  {(sports ?? []).map(s => (
                    <button
                      key={s.sportKey}
                      onClick={() => setSelectedSport(s.sportKey)}
                      className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
                        selectedSport === s.sportKey
                          ? "bg-primary/15 text-primary font-medium"
                          : "text-foreground hover:bg-accent"
                      }`}
                    >
                      {s.title}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Mobile sport selector */}
          <div className="lg:hidden mb-4">
            <select
              value={selectedSport || ""}
              onChange={e => setSelectedSport(e.target.value || null)}
              className="w-full p-2 bg-secondary border border-border rounded-md text-sm text-foreground"
            >
              <option value="">Spor seçin...</option>
              {sportsQuery.data?.map(s => (
                <option key={s.sportKey} value={s.sportKey}>{s.title}</option>
              ))}
            </select>
          </div>

          {!selectedSport ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
                <Search className="h-7 w-7 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">Spor Seçin</h2>
              <p className="text-muted-foreground text-sm">Menüden bir spor dalı seçerek maçları ve oranları görüntüleyin.</p>
            </div>
          ) : eventsQuery.isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground text-sm">Oranlar yükleniyor...</span>
            </div>
          ) : eventsQuery.data?.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-muted-foreground text-sm">Bu spor dalında şu an aktif maç bulunmuyor.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-foreground">
                  {eventsQuery.data?.[0]?.sport_title || selectedSport}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {eventsQuery.data?.length} maç
                </span>
              </div>

              {eventsQuery.data?.map((event: any) => {
                const h2h = getBestOdds(event.bookmakers, "h2h");
                const spreads = getBestOdds(event.bookmakers, "spreads");
                const totals = getBestOdds(event.bookmakers, "totals");
                const commence = new Date(event.commence_time);

                return (
                  <div key={event.id} className="bg-card border border-border rounded-lg p-4 hover:bg-accent/20 transition-colors">
                    {/* Time + Detail link */}
                    <div className="flex items-center gap-2 mb-3">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {format(commence, "dd MMM HH:mm", { locale: tr })}
                      </span>
                      <button
                        onClick={() => setLocation(`/event/${event.sport_key}/${event.id}`)}
                        className="ml-auto flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        Detay <ExternalLink className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Teams */}
                    <div className="mb-3 cursor-pointer" onClick={() => setLocation(`/event/${event.sport_key}/${event.id}`)}>
                      <div className="text-sm font-semibold text-foreground hover:text-primary transition-colors">{event.home_team}</div>
                      <div className="text-sm font-semibold text-foreground hover:text-primary transition-colors">{event.away_team}</div>
                    </div>

                    {/* Odds */}
                    <div className="space-y-2">
                      {h2h && (
                        <div>
                          <div className="text-[10px] text-muted-foreground uppercase mb-1 font-medium">Maç Sonucu</div>
                          <div className="grid grid-cols-3 gap-1.5">
                            {h2h.map((o: any) => {
                              const sel = isSelected(event.id, "h2h", o.name);
                              return (
                                <button
                                  key={o.name}
                                  onClick={() => addSelection({
                                    eventId: event.id, sportKey: event.sport_key,
                                    homeTeam: event.home_team, awayTeam: event.away_team,
                                    commenceTime: event.commence_time,
                                    marketKey: "h2h", outcomeName: o.name, outcomePrice: o.price,
                                  })}
                                  className={`py-2 px-2 rounded-md text-center transition-all ${
                                    sel
                                      ? "bg-primary/20 border border-primary text-primary"
                                      : "bg-secondary border border-transparent hover:bg-accent text-foreground"
                                  }`}
                                >
                                  <div className="text-[10px] text-muted-foreground truncate">
                                    {o.name === event.home_team ? "1" : o.name === event.away_team ? "2" : "X"}
                                  </div>
                                  <div className="text-sm font-bold">{o.price.toFixed(2)}</div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {spreads && (
                        <div>
                          <div className="text-[10px] text-muted-foreground uppercase mb-1 font-medium">Handikap</div>
                          <div className="grid grid-cols-2 gap-1.5">
                            {spreads.map((o: any) => {
                              const sel = isSelected(event.id, "spreads", o.name);
                              return (
                                <button
                                  key={o.name}
                                  onClick={() => addSelection({
                                    eventId: event.id, sportKey: event.sport_key,
                                    homeTeam: event.home_team, awayTeam: event.away_team,
                                    commenceTime: event.commence_time,
                                    marketKey: "spreads", outcomeName: o.name, outcomePrice: o.price, point: o.point,
                                  })}
                                  className={`py-2 px-2 rounded-md text-center transition-all ${
                                    sel
                                      ? "bg-stake-blue/20 border border-stake-blue text-stake-blue"
                                      : "bg-secondary border border-transparent hover:bg-accent text-foreground"
                                  }`}
                                >
                                  <div className="text-[10px] text-muted-foreground truncate">{o.name} ({o.point > 0 ? "+" : ""}{o.point})</div>
                                  <div className="text-sm font-bold">{o.price.toFixed(2)}</div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {totals && (
                        <div>
                          <div className="text-[10px] text-muted-foreground uppercase mb-1 font-medium">Alt/Üst</div>
                          <div className="grid grid-cols-2 gap-1.5">
                            {totals.map((o: any) => {
                              const sel = isSelected(event.id, "totals", o.name);
                              return (
                                <button
                                  key={o.name}
                                  onClick={() => addSelection({
                                    eventId: event.id, sportKey: event.sport_key,
                                    homeTeam: event.home_team, awayTeam: event.away_team,
                                    commenceTime: event.commence_time,
                                    marketKey: "totals", outcomeName: o.name, outcomePrice: o.price, point: o.point,
                                  })}
                                  className={`py-2 px-2 rounded-md text-center transition-all ${
                                    sel
                                      ? "bg-stake-green/20 border border-stake-green text-stake-green"
                                      : "bg-secondary border border-transparent hover:bg-accent text-foreground"
                                  }`}
                                >
                                  <div className="text-[10px] text-muted-foreground">{o.name === "Over" ? "Üst" : "Alt"} {o.point}</div>
                                  <div className="text-sm font-bold">{o.price.toFixed(2)}</div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
