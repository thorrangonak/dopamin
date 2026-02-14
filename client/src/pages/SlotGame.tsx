import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useEffect } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";

export default function SlotGame() {
  const [, params] = useRoute("/slot/:gameId");
  const [, setLocation] = useLocation();
  const gameId = params?.gameId || "";

  const launchMut = trpc.slots.launch.useMutation();
  const balQ = trpc.balance.get.useQuery(undefined, { refetchInterval: 10_000 });

  useEffect(() => {
    if (gameId && !launchMut.data && !launchMut.isPending && !launchMut.isError) {
      launchMut.mutate({ gameId });
    }
  }, [gameId]);

  const handleClose = () => {
    setLocation("/casino/slots");
  };

  if (launchMut.isPending) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground text-sm">Oyun yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (launchMut.isError) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <div className="text-center space-y-3">
          <p className="text-destructive font-medium">Oyun başlatılamadı</p>
          <p className="text-muted-foreground text-sm">{launchMut.error.message}</p>
          <button onClick={handleClose} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm">
            Geri Dön
          </button>
        </div>
      </div>
    );
  }

  if (!launchMut.data?.url) return null;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border">
        <button onClick={handleClose} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Kapat
        </button>
        <span className="text-xs text-muted-foreground">
          Bakiye: <span className="text-foreground font-medium">{balQ.data?.amount ?? "..."} USDT</span>
        </span>
      </div>
      {/* Game iframe */}
      <iframe
        src={launchMut.data.url}
        className="flex-1 w-full border-0"
        allow="autoplay; fullscreen"
        allowFullScreen
      />
    </div>
  );
}
