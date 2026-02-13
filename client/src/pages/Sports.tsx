import { trpc } from "@/lib/trpc";
import { useBetSlip } from "@/contexts/BetSlipContext";
import { useMemo } from "react";
import { useLocation } from "wouter";
import { Loader2, Clock, ExternalLink, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { useSection } from "@/components/AppLayout";

export default function Sports() {
  const sportsQuery = trpc.sports.list.useQuery();
  const { selectedLeague: selectedSport, setSelectedLeague: setSelectedSport } = useSection();
  const [, setLocation] = useLocation();
  const { addSelection, isSelected } = useBetSlip();

  // Featured events (all popular leagues) — loads immediately
  const featuredQuery = trpc.events.featured.useQuery(undefined, {
    enabled: !selectedSport,
  });

  // Single sport events — loads when a league is selected
  const sportQuery = trpc.events.bySport.useQuery(
    { sportKey: selectedSport! },
    { enabled: !!selectedSport }
  );

  // Active query based on mode
  const events = selectedSport ? sportQuery.data : featuredQuery.data;
  const isLoading = selectedSport ? sportQuery.isLoading : featuredQuery.isLoading;

  // Group events by sport_key for the "all" view
  const groupedEvents = useMemo(() => {
    if (!events || selectedSport) return null;
    const groups: Record<string, { title: string; events: any[] }> = {};
    for (const e of events) {
      const key = e.sport_key;
      if (!groups[key]) {
        // Find sport title from sports list
        const sport = sportsQuery.data?.find(s => s.sportKey === key);
        groups[key] = { title: sport?.title || e.sport_title || key, events: [] };
      }
      groups[key].events.push(e);
    }
    return groups;
  }, [events, selectedSport, sportsQuery.data]);

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
          {/* Loading */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground text-sm">Maçlar yükleniyor...</span>
            </div>
          ) : events?.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-muted-foreground text-sm">Bu ligde şu an aktif maç bulunmuyor.</p>
            </div>
          ) : !selectedSport && groupedEvents ? (
            /* ─── ALL LEAGUES VIEW ─── */
            <div className="space-y-6">
              {Object.entries(groupedEvents).map(([sportKey, group]) => (
                <div key={sportKey}>
                  {/* League header */}
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full dp-gradient-bg" />
                      {group.title}
                    </h2>
                    <button
                      onClick={() => setSelectedSport(sportKey)}
                      className="text-[11px] text-primary hover:underline flex items-center gap-0.5"
                    >
                      Tümü <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                  {/* Events */}
                  <div className="space-y-2">
                    {group.events.map((event: any) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        getBestOdds={getBestOdds}
                        addSelection={addSelection}
                        isSelected={isSelected}
                        setLocation={setLocation}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* ─── SINGLE LEAGUE VIEW ─── */
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-foreground">
                  {events?.[0]?.sport_title || sportsQuery.data?.find(s => s.sportKey === selectedSport)?.title || selectedSport}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {events?.length} maç
                </span>
              </div>
              {events?.map((event: any) => (
                <EventCard
                  key={event.id}
                  event={event}
                  getBestOdds={getBestOdds}
                  addSelection={addSelection}
                  isSelected={isSelected}
                  setLocation={setLocation}
                />
              ))}
            </div>
          )}
    </div>
  );
}

/* ─── Event Card Component ─── */
function EventCard({
  event,
  getBestOdds,
  addSelection,
  isSelected,
  setLocation,
}: {
  event: any;
  getBestOdds: (bookmakers: any[], marketKey: string) => any[] | null;
  addSelection: (sel: any) => void;
  isSelected: (eventId: string, marketKey: string, outcomeName: string) => boolean;
  setLocation: (path: string) => void;
}) {
  const h2h = getBestOdds(event.bookmakers, "h2h");
  const spreads = getBestOdds(event.bookmakers, "spreads");
  const totals = getBestOdds(event.bookmakers, "totals");
  const commence = new Date(event.commence_time);

  return (
    <div className="bg-card border border-border rounded-lg p-3 md:p-4 hover:bg-accent/20 transition-colors">
      {/* Time + Detail link */}
      <div className="flex items-center gap-2 mb-2">
        <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-[11px] text-muted-foreground">
          {format(commence, "dd MMM HH:mm", { locale: tr })}
        </span>
        <button
          onClick={() => setLocation(`/event/${event.sport_key}/${event.id}`)}
          className="ml-auto flex items-center gap-1 text-[11px] text-primary hover:underline shrink-0"
        >
          Detay <ExternalLink className="h-3 w-3" />
        </button>
      </div>

      {/* Teams + Odds in a single row on desktop, stacked on mobile */}
      <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
        {/* Teams */}
        <div className="md:w-48 shrink-0 cursor-pointer" onClick={() => setLocation(`/event/${event.sport_key}/${event.id}`)}>
          <div className="text-sm font-semibold text-foreground hover:text-primary transition-colors truncate">{event.home_team}</div>
          <div className="text-sm font-semibold text-foreground hover:text-primary transition-colors truncate">{event.away_team}</div>
        </div>

        {/* Odds - responsive grid */}
        <div className="flex-1 flex flex-wrap gap-2">
          {h2h && (
            <div className="flex-1 min-w-0">
              <div className="text-[9px] text-muted-foreground uppercase mb-1 font-medium">Maç Sonucu</div>
              <div className="grid grid-cols-3 gap-1">
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
                      className={`py-1.5 px-1 rounded-md text-center transition-all ${
                        sel
                          ? "bg-primary/20 border border-primary text-primary"
                          : "bg-secondary border border-transparent hover:bg-accent text-foreground"
                      }`}
                    >
                      <div className="text-[9px] text-muted-foreground truncate">
                        {o.name === event.home_team ? "1" : o.name === event.away_team ? "2" : "X"}
                      </div>
                      <div className="text-xs font-bold">{o.price.toFixed(2)}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {spreads && (
            <div className="flex-1 min-w-0 hidden sm:block">
              <div className="text-[9px] text-muted-foreground uppercase mb-1 font-medium">Handikap</div>
              <div className="grid grid-cols-2 gap-1">
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
                      className={`py-1.5 px-1 rounded-md text-center transition-all ${
                        sel
                          ? "bg-primary/20 border border-primary text-primary"
                          : "bg-secondary border border-transparent hover:bg-accent text-foreground"
                      }`}
                    >
                      <div className="text-[9px] text-muted-foreground truncate">{o.point > 0 ? "+" : ""}{o.point}</div>
                      <div className="text-xs font-bold">{o.price.toFixed(2)}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {totals && (
            <div className="flex-1 min-w-0 hidden md:block">
              <div className="text-[9px] text-muted-foreground uppercase mb-1 font-medium">Alt/Üst</div>
              <div className="grid grid-cols-2 gap-1">
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
                      className={`py-1.5 px-1 rounded-md text-center transition-all ${
                        sel
                          ? "bg-primary/20 border border-primary text-primary"
                          : "bg-secondary border border-transparent hover:bg-accent text-foreground"
                      }`}
                    >
                      <div className="text-[9px] text-muted-foreground">{o.name === "Over" ? "Ü" : "A"} {o.point}</div>
                      <div className="text-xs font-bold">{o.price.toFixed(2)}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
