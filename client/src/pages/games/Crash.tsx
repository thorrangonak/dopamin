import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Rocket, TrendingUp, DollarSign, Shield } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Link } from "wouter";

export default function Crash() {
  const { isAuthenticated } = useAuth();
  const { formatAmount, currencySymbol } = useCurrency();
  const [stake, setStake] = useState("10");
  const [autoCashOutAt, setAutoCashOutAt] = useState("0");
  const [gameState, setGameState] = useState<"idle" | "running" | "crashed" | "cashedOut">("idle");
  const [currentMultiplier, setCurrentMultiplier] = useState(1.0);
  const [crashPoint, setCrashPoint] = useState(0);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [commitHash, setCommitHash] = useState<string | null>(null);
  const [fairness, setFairness] = useState<any>(null);
  const [payout, setPayout] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const cashingOutRef = useRef(false);
  const gameStateRef = useRef(gameState);

  // Keep ref in sync with state for interval callback
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const balanceQ = trpc.balance.get.useQuery(undefined, { enabled: isAuthenticated });

  const startMut = trpc.casino.startCrash.useMutation({
    onSuccess: (data) => {
      setSessionId(data.sessionId);
      setCommitHash(data.commitHash);
      setFairness(data.fairness);
      balanceQ.refetch();
      // Animation starts — crash point is unknown to client
      setGameState("running");
      startTimeRef.current = Date.now();
      cashingOutRef.current = false;
    },
    onError: (err) => {
      setGameState("idle");
      toast.error(err.message);
    },
  });

  const cashOutMut = trpc.casino.crashCashOut.useMutation({
    onSuccess: (data) => {
      if (intervalRef.current) clearInterval(intervalRef.current);

      setCrashPoint(data.crashPoint);

      if (data.won) {
        setGameState("cashedOut");
        setCurrentMultiplier(data.multiplier);
        setPayout(data.payout);
        toast.success(`Cash Out! ${formatAmount(data.payout, { showSign: true })} (${data.multiplier.toFixed(2)}x)`);
      } else {
        setGameState("crashed");
        setCurrentMultiplier(data.crashPoint);
        setPayout(0);
        toast.error(`Patladı! ${data.crashPoint}x'de çöktü`);
      }
      balanceQ.refetch();
    },
    onError: (err) => {
      cashingOutRef.current = false;
      toast.error(err.message);
    },
  });

  const doCashOut = useCallback((multiplier: number) => {
    if (cashingOutRef.current || !sessionId) return;
    cashingOutRef.current = true;
    cashOutMut.mutate({ sessionId, cashOutAt: parseFloat(multiplier.toFixed(2)) });
  }, [sessionId, cashOutMut]);

  // Animation interval
  useEffect(() => {
    if (gameState === "running") {
      intervalRef.current = setInterval(() => {
        if (gameStateRef.current !== "running") return;

        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        const mult = parseFloat(Math.pow(Math.E, 0.08 * elapsed).toFixed(2));
        setCurrentMultiplier(mult);

        // Auto-cashout check (client-side safety net)
        const autoTarget = parseFloat(autoCashOutAt);
        if (autoTarget >= 1.01 && mult >= autoTarget && !cashingOutRef.current) {
          doCashOut(autoTarget);
        }
      }, 50);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [gameState, autoCashOutAt, doCashOut]);

  const handlePlay = () => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    const s = parseFloat(stake);
    if (isNaN(s) || s < 1) {
      toast.error(`Minimum bahis ${formatAmount(1)}`);
      return;
    }

    setGameState("idle"); // reset first
    setCurrentMultiplier(1.0);
    setCrashPoint(0);
    setPayout(0);
    setSessionId(null);
    setCommitHash(null);

    startMut.mutate({ stake: s });
  };

  const handleCashOut = () => {
    if (gameState !== "running") return;
    doCashOut(currentMultiplier);
  };

  const handleReset = () => {
    setGameState("idle");
    setCurrentMultiplier(1.0);
    setCrashPoint(0);
    setPayout(0);
    setSessionId(null);
    setCommitHash(null);
  };

  const quickStakes = [5, 10, 25, 50, 100, 250];
  const quickCashOuts = [1.5, 2, 3, 5, 10, 20];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
          <Rocket className="w-5 h-5 text-orange-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Crash</h1>
          <p className="text-sm text-muted-foreground">Çarpan yükselirken doğru zamanda çık!</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 md:p-6">
        <div className="relative h-40 md:h-48 bg-secondary/50 rounded-xl mb-4 md:mb-6 flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <svg className="w-full h-full" viewBox="0 0 400 200">
              <path
                d={`M 0 200 Q ${currentMultiplier * 30} ${200 - currentMultiplier * 20} ${Math.min(400, currentMultiplier * 60)} ${Math.max(0, 200 - currentMultiplier * 30)}`}
                fill="none"
                stroke={gameState === "crashed" ? "#ef4444" : "#22c55e"}
                strokeWidth="2"
              />
            </svg>
          </div>

          <motion.div key={gameState} initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="text-center z-10">
            <p className={`text-4xl md:text-5xl font-bold ${
              gameState === "crashed" ? "text-red-400" :
              gameState === "cashedOut" ? "text-green-400" :
              gameState === "running" ? "text-foreground" : "text-muted-foreground"
            }`}>
              {currentMultiplier.toFixed(2)}x
            </p>
            <p className="text-sm mt-2 text-muted-foreground">
              {gameState === "idle" && "Bahis yaparak başla"}
              {gameState === "running" && "Yükseliyor..."}
              {gameState === "crashed" && `${crashPoint}x'de patladı!`}
              {gameState === "cashedOut" && `${currentMultiplier.toFixed(2)}x'de çıktın!`}
            </p>
          </motion.div>

          {gameState === "running" && (
            <motion.div
              className="absolute bottom-4 left-1/2 -translate-x-1/2"
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 0.5 }}
            >
              <Rocket className="w-8 h-8 text-orange-400 -rotate-45" />
            </motion.div>
          )}
        </div>

        {/* Commit Hash */}
        {commitHash && gameState === "running" && (
          <div className="flex items-center justify-center gap-2 mb-3 text-[10px] text-muted-foreground">
            <Shield className="w-3 h-3 text-green-500" />
            <span>Commit: {commitHash.slice(0, 16)}...</span>
          </div>
        )}

        {(gameState === "crashed" || gameState === "cashedOut") && (
          <div className={`p-3 rounded-lg mb-4 text-center ${
            gameState === "cashedOut"
              ? "bg-green-500/10 border border-green-500/30"
              : "bg-red-500/10 border border-red-500/30"
          }`}>
            <p className={`text-xl font-bold ${gameState === "cashedOut" ? "text-green-400" : "text-red-400"}`}>
              {gameState === "cashedOut"
                ? formatAmount(payout, { showSign: true })
                : `-${formatAmount(parseFloat(stake))}`}
            </p>
            {crashPoint > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Crash noktası: {crashPoint}x
              </p>
            )}
          </div>
        )}

        {/* Provably Fair Badge */}
        {(gameState === "crashed" || gameState === "cashedOut") && fairness && (
          <div className="flex items-center justify-center gap-2 mb-4 text-xs text-muted-foreground">
            <Shield className="w-3.5 h-3.5 text-green-500" />
            <span>Seed: {fairness.serverSeedHash.slice(0, 8)}... | Nonce: {fairness.nonce}</span>
            <Link href="/provably-fair" className="text-green-500 hover:underline">Doğrula</Link>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Bahis Tutarı</label>
            <div className="flex items-center gap-2">
              <Input type="number" value={stake} onChange={(e) => setStake(e.target.value)}
                className="bg-secondary border-border text-foreground text-sm" min={1} disabled={gameState === "running"} />
              <span className="text-muted-foreground text-xs">{currencySymbol}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {quickStakes.map((qs) => (
                <button key={qs} onClick={() => setStake(String(qs))} disabled={gameState === "running"}
                  className="px-2.5 py-1.5 text-[11px] rounded bg-secondary text-foreground/80 hover:bg-accent transition-colors">
                  {qs}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Otomatik Cash Out</label>
            <div className="flex items-center gap-2">
              <Input type="number" value={autoCashOutAt} onChange={(e) => setAutoCashOutAt(e.target.value)}
                className="bg-secondary border-border text-foreground text-sm" min={0} step={0.1} disabled={gameState === "running"}
                placeholder="0 = kapalı" />
              <span className="text-muted-foreground text-xs">x</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {quickCashOuts.map((qc) => (
                <button key={qc} onClick={() => setAutoCashOutAt(qc.toFixed(2))} disabled={gameState === "running"}
                  className="px-2.5 py-1.5 text-[11px] rounded bg-secondary text-foreground/80 hover:bg-accent transition-colors">
                  {qc}x
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4">
          {gameState === "idle" ? (
            <Button onClick={handlePlay} disabled={startMut.isPending}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3">
              <TrendingUp className="w-4 h-4 mr-2" />
              {startMut.isPending ? "Başlatılıyor..." : `Bahis Yap (${formatAmount(parseFloat(stake || "0"))})`}
            </Button>
          ) : gameState === "running" ? (
            <Button onClick={handleCashOut} disabled={cashOutMut.isPending || cashingOutRef.current}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3">
              <DollarSign className="w-4 h-4 mr-2" />
              {cashOutMut.isPending ? "Çekiliyor..." : `Cash Out (${currentMultiplier.toFixed(2)}x)`}
            </Button>
          ) : (
            <Button onClick={handleReset} className="w-full bg-secondary hover:bg-accent text-foreground font-bold py-3">
              Yeni Oyun
            </Button>
          )}
        </div>

        {isAuthenticated && balanceQ.data && (
          <p className="text-center text-xs text-muted-foreground mt-3">
            Bakiye: {formatAmount(balanceQ.data.amount)}
          </p>
        )}
      </div>

      <div className="bg-card/50 border border-border/50 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-foreground/80 mb-2">Nasıl Oynanır?</h3>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>• Bahis tutarınızı girin ve oyunu başlatın</li>
          <li>• Çarpan 1.00x'den yükselmeye başlar</li>
          <li>• "Cash Out" butonuna tıklayarak istediğiniz zaman çekin</li>
          <li>• Opsiyonel: Otomatik cash out ayarlayın (güvenlik ağı)</li>
          <li>• Çarpan cash out yapmadan önce patlarsa kaybedersiniz</li>
          <li>• Ev avantajı: %3</li>
          <li>• <Shield className="w-3 h-3 inline text-green-500" /> Provably Fair — tüm sonuçlar doğrulanabilir</li>
        </ul>
      </div>
    </div>
  );
}
