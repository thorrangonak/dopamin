import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { useLocation } from "wouter";
import { Loader2, Radio, RefreshCw, Clock, Trophy, Zap, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

interface LiveEvent {
  eventId: string;
  sportKey: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  isLive: number;
  completed: number;
  commenceTime: Date | string;
  scoresJson: any;
}

function ScoreCard({ event, onNavigate }: { event: LiveEvent; onNavigate: (path: string) => void }) {
  const isLive = event.isLive === 1;
  const isCompleted = event.completed === 1;
  const commence = new Date(event.commenceTime);

  return (
    <div className={`bg-card border rounded-lg p-4 transition-colors ${
      isLive ? "border-primary/40" : isCompleted ? "border-border opacity-60" : "border-border"
    }`}>
      {/* Status */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isLive ? (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/15 text-primary">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
              </span>
              <span className="text-[10px] font-bold uppercase">Canlı</span>
            </span>
          ) : isCompleted ? (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              <Trophy className="h-3 w-3" />
              <span className="text-[10px] font-bold uppercase">Bitti</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-stake-blue/10 text-stake-blue">
              <Clock className="h-3 w-3" />
              <span className="text-[10px] font-bold uppercase">Devam Ediyor</span>
            </span>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground">
          {format(commence, "dd MMM HH:mm", { locale: tr })}
        </span>
      </div>

      {/* Teams & Scores */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className={`text-sm font-semibold ${
            event.homeScore !== null && event.awayScore !== null && event.homeScore > event.awayScore
              ? "text-primary" : "text-foreground"
          }`}>
            {event.homeTeam}
          </span>
          <span className={`text-lg font-bold min-w-[2rem] text-right ${isLive ? "text-primary" : "text-foreground"}`}>
            {event.homeScore !== null ? event.homeScore : "-"}
          </span>
        </div>
        <div className="border-t border-border/50" />
        <div className="flex items-center justify-between">
          <span className={`text-sm font-semibold ${
            event.homeScore !== null && event.awayScore !== null && event.awayScore > event.homeScore
              ? "text-primary" : "text-foreground"
          }`}>
            {event.awayTeam}
          </span>
          <span className={`text-lg font-bold min-w-[2rem] text-right ${isLive ? "text-primary" : "text-foreground"}`}>
            {event.awayScore !== null ? event.awayScore : "-"}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground px-2 py-0.5 rounded bg-secondary">
          {event.sportKey.replace(/_/g, " ").toUpperCase()}
        </span>
        <button
          onClick={() => onNavigate(`/event/${event.sportKey}/${event.eventId}`)}
          className="flex items-center gap-1 text-[10px] text-primary hover:underline"
        >
          Detay <ExternalLink className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

export default function LiveScores() {
  const [, setLocation] = useLocation();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const liveQuery = trpc.liveScores.live.useQuery(undefined, {
    refetchInterval: autoRefresh ? 30000 : false,
  });
  const allScoresQuery = trpc.liveScores.bySport.useQuery(undefined, {
    refetchInterval: autoRefresh ? 30000 : false,
  });
  const refreshMut = trpc.liveScores.refresh.useMutation({
    onSuccess: () => {
      liveQuery.refetch();
      allScoresQuery.refetch();
    },
  });

  const liveEvents = (liveQuery.data ?? []) as LiveEvent[];
  const allEvents = (allScoresQuery.data ?? []) as LiveEvent[];

  const eventMap = new Map<string, LiveEvent>();
  for (const ev of [...liveEvents, ...allEvents]) {
    if (!eventMap.has(ev.eventId)) eventMap.set(ev.eventId, ev);
  }
  const events = Array.from(eventMap.values());
  const liveCount = events.filter(e => e.isLive === 1).length;
  const completedCount = events.filter(e => e.completed === 1).length;

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Radio className="h-5 w-5 text-primary" />
            Canlı Skorlar
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Devam eden maçları canlı takip edin</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${
              autoRefresh ? "border-primary/40 text-primary bg-primary/10" : "border-border text-muted-foreground"
            }`}
          >
            <Zap className="h-3 w-3" />
            {autoRefresh ? "Otomatik: Açık" : "Otomatik: Kapalı"}
          </button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshMut.mutate()}
            disabled={refreshMut.isPending}
          >
            {refreshMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Yenile
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-primary">{liveCount}</div>
          <div className="text-[10px] text-muted-foreground uppercase font-medium">Canlı</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-stake-blue">{events.length - liveCount - completedCount}</div>
          <div className="text-[10px] text-muted-foreground uppercase font-medium">Devam Eden</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-muted-foreground">{completedCount}</div>
          <div className="text-[10px] text-muted-foreground uppercase font-medium">Biten</div>
        </div>
      </div>

      {/* Events */}
      {liveQuery.isLoading && allScoresQuery.isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground text-sm">Skorlar yükleniyor...</span>
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-muted-foreground text-sm mb-4">Şu anda canlı maç bulunmuyor.</p>
          <Button variant="outline" size="sm" onClick={() => refreshMut.mutate()} disabled={refreshMut.isPending}>
            <RefreshCw className="h-4 w-4 mr-1" /> Skorları Güncelle
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {liveCount > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
                </span>
                Canlı Maçlar
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {events.filter(e => e.isLive === 1).map(event => (
                  <ScoreCard key={event.eventId} event={event} onNavigate={setLocation} />
                ))}
              </div>
            </div>
          )}

          {events.filter(e => e.isLive !== 1 && e.completed !== 1).length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-stake-blue mb-3 flex items-center gap-2">
                <Clock className="h-3.5 w-3.5" /> Devam Eden Maçlar
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {events.filter(e => e.isLive !== 1 && e.completed !== 1).map(event => (
                  <ScoreCard key={event.eventId} event={event} onNavigate={setLocation} />
                ))}
              </div>
            </div>
          )}

          {completedCount > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <Trophy className="h-3.5 w-3.5" /> Tamamlanan Maçlar
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {events.filter(e => e.completed === 1).map(event => (
                  <ScoreCard key={event.eventId} event={event} onNavigate={setLocation} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
