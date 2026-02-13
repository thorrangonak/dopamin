import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Dice5, Shield, Trash2 } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Link } from "wouter";

const KENO_MULTIPLIERS: Record<number, Record<number, number>> = {
  1:  { 0: 0, 1: 3.8 },
  2:  { 0: 0, 1: 1.5, 2: 8.5 },
  3:  { 0: 0, 1: 1, 2: 3, 3: 25 },
  4:  { 0: 0, 1: 0.5, 2: 2, 3: 8, 4: 80 },
  5:  { 0: 0, 1: 0, 2: 1.5, 3: 4, 4: 20, 5: 200 },
  6:  { 0: 0, 1: 0, 2: 1, 3: 2.5, 4: 8, 5: 50, 6: 500 },
  7:  { 0: 0, 1: 0, 2: 0.5, 3: 2, 4: 5, 5: 20, 6: 100, 7: 1000 },
  8:  { 0: 0, 1: 0, 2: 0, 3: 1.5, 4: 3, 5: 12, 6: 50, 7: 250, 8: 2000 },
  9:  { 0: 0, 1: 0, 2: 0, 3: 1, 4: 2.5, 5: 8, 6: 25, 7: 100, 8: 500, 9: 5000 },
  10: { 0: 0, 1: 0, 2: 0, 3: 0.5, 4: 2, 5: 5, 6: 15, 7: 50, 8: 250, 9: 1000, 10: 10000 },
};

export default function Keno() {
  const { isAuthenticated } = useAuth();
  const { formatAmount, currencySymbol } = useCurrency();
  const [stake, setStake] = useState("10");
  const [picks, setPicks] = useState<number[]>([]);
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [drawnBalls, setDrawnBalls] = useState<number[]>([]);
  const [visibleBalls, setVisibleBalls] = useState<number[]>([]);
  const [animating, setAnimating] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const balanceQ = trpc.balance.get.useQuery(undefined, { enabled: isAuthenticated });
  const playMut = trpc.casino.playKeno.useMutation({
    onSuccess: (data) => {
      setResult(data);
      setDrawnBalls(data.details.drawnBalls);
      setVisibleBalls([]);
      setAnimating(true);
      balanceQ.refetch();
    },
    onError: (err) => {
      setPlaying(false);
      toast.error(err.message);
    },
  });

  // Ball draw animation
  useEffect(() => {
    if (!animating || drawnBalls.length === 0) return;
    let idx = 0;
    intervalRef.current = setInterval(() => {
      idx++;
      if (idx > drawnBalls.length) {
        clearInterval(intervalRef.current!);
        setAnimating(false);
        setPlaying(false);
        if (result) {
          if (result.result === "win") {
            toast.success(`Kazandın! ${formatAmount(result.payout, { showSign: true })} (${result.multiplier}x) — ${result.details.hits} isabet`);
          } else {
            toast.error(`${result.details.hits} isabet — Kaybettin!`);
          }
        }
        return;
      }
      setVisibleBalls((vb) => [...vb, drawnBalls[idx - 1]]);
    }, 150);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [animating, drawnBalls]);

  const togglePick = (num: number) => {
    if (playing || animating) return;
    setPicks((prev) => {
      if (prev.includes(num)) return prev.filter((n) => n !== num);
      if (prev.length >= 10) { toast.error("Maksimum 10 sayı seçebilirsiniz"); return prev; }
      return [...prev, num].sort((a, b) => a - b);
    });
  };

  const handlePlay = () => {
    if (!isAuthenticated) { window.location.href = getLoginUrl(); return; }
    const s = parseFloat(stake);
    if (isNaN(s) || s < 1) { toast.error(`Minimum bahis ${formatAmount(1)}`); return; }
    if (picks.length === 0) { toast.error("En az 1 sayı seçin"); return; }
    setPlaying(true);
    setResult(null);
    setVisibleBalls([]);
    playMut.mutate({ stake: s, picks });
  };

  const handleQuickPick = (count: number) => {
    if (playing || animating) return;
    const nums: number[] = [];
    const pool = Array.from({ length: 40 }, (_, i) => i + 1);
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      nums.push(pool[idx]);
      pool.splice(idx, 1);
    }
    setPicks(nums.sort((a, b) => a - b));
  };

  const getCellState = (num: number) => {
    const isPicked = picks.includes(num);
    const isDrawn = visibleBalls.includes(num);
    const isHit = isPicked && isDrawn;
    return { isPicked, isDrawn, isHit };
  };

  const currentTable = KENO_MULTIPLIERS[picks.length] || {};
  const quickStakes = [5, 10, 25, 50, 100, 250];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
          <Dice5 className="w-5 h-5 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Keno</h1>
          <p className="text-sm text-muted-foreground">1-10 sayı seç, 10 top çekilir — 10000x'e kadar!</p>
        </div>
      </div>

      {/* Game Area */}
      <div className="bg-card border border-border rounded-xl p-4 md:p-6">
        {/* Multiplier Table */}
        {picks.length > 0 && (
          <div className="mb-4 p-3 bg-secondary/30 rounded-lg">
            <p className="text-xs font-semibold text-foreground/80 mb-2">
              Çarpan Tablosu ({picks.length} seçim)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(currentTable).map(([hits, mult]) => (
                <div key={hits} className={`px-2 py-1 rounded text-[11px] text-center ${
                  result && !animating && result.details.hits === Number(hits)
                    ? "bg-green-500/20 border border-green-500/50 text-green-400 font-bold"
                    : "bg-secondary border border-border text-muted-foreground"
                }`}>
                  <span>{hits} isabet</span>
                  <span className="ml-1 font-bold text-foreground">{mult}x</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {picks.length === 0 && (
          <div className="mb-4 p-3 bg-secondary/30 rounded-lg">
            <p className="text-xs font-semibold text-foreground/80 mb-2">Çarpan Örnekleri</p>
            <div className="grid grid-cols-3 gap-2 text-xs text-center">
              <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-2">
                <p className="text-muted-foreground">1 seçim, 1 isabet</p>
                <p className="text-cyan-400 font-bold text-base">3.8x</p>
              </div>
              <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-2">
                <p className="text-muted-foreground">5 seçim, 5 isabet</p>
                <p className="text-cyan-400 font-bold text-base">200x</p>
              </div>
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2">
                <p className="text-muted-foreground">10 seçim, 10 isabet</p>
                <p className="text-green-400 font-bold text-base">10000x</p>
              </div>
            </div>
          </div>
        )}

        {/* Number Grid 8x5 */}
        <div className="grid grid-cols-8 gap-1.5 mb-4 max-w-[420px] mx-auto">
          {Array.from({ length: 40 }, (_, i) => i + 1).map((num) => {
            const { isPicked, isDrawn, isHit } = getCellState(num);
            return (
              <motion.button
                key={num}
                onClick={() => togglePick(num)}
                disabled={playing && !isPicked}
                animate={isHit ? { scale: [1, 1.2, 1] } : {}}
                transition={{ duration: 0.3 }}
                className={`aspect-square rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
                  isHit
                    ? "bg-green-500/30 border-2 border-green-500 text-green-400"
                    : isPicked && isDrawn === false
                    ? "bg-primary/20 border-2 border-primary text-primary"
                    : isDrawn && !isPicked
                    ? "bg-red-500/10 border border-red-500/30 text-red-400/60"
                    : "bg-secondary border border-border text-foreground/70 hover:bg-accent"
                }`}
              >
                {num}
              </motion.button>
            );
          })}
        </div>

        {/* Quick Pick & Clear */}
        <div className="flex gap-2 justify-center mb-4">
          {[1, 3, 5, 7, 10].map((n) => (
            <button
              key={n}
              onClick={() => handleQuickPick(n)}
              disabled={playing || animating}
              className="px-2.5 py-1 text-[11px] rounded bg-secondary text-foreground/80 hover:bg-accent transition-colors"
            >
              Rastgele {n}
            </button>
          ))}
          <button
            onClick={() => setPicks([])}
            disabled={playing || animating}
            className="px-2.5 py-1 text-[11px] rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>

        {/* Selected Count */}
        <p className="text-center text-xs text-muted-foreground mb-3">
          Seçilen: <span className="text-primary font-bold">{picks.length}</span>/10
          {picks.length > 0 && ` — [${picks.join(", ")}]`}
        </p>

        {/* Drawn Balls */}
        {visibleBalls.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-muted-foreground mb-2">
              Çekilen ({visibleBalls.length}/10)
              {animating && <span className="ml-2 text-primary animate-pulse">Çekiliyor...</span>}
            </p>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {visibleBalls.map((ball, i) => {
                const isHit = picks.includes(ball);
                return (
                  <motion.span
                    key={i}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${
                      isHit
                        ? "bg-green-500/20 text-green-400 border-2 border-green-500"
                        : "bg-secondary text-muted-foreground border border-border"
                    }`}
                  >
                    {ball}
                  </motion.span>
                );
              })}
            </div>
          </div>
        )}

        {/* Result */}
        <AnimatePresence>
          {result && !animating && !playing && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`text-center mb-4 p-4 rounded-lg ${
                result.result === "win"
                  ? "bg-green-500/10 border border-green-500/30"
                  : "bg-red-500/10 border border-red-500/30"
              }`}
            >
              <p className="text-lg font-bold">
                {result.details.hits} / {result.details.pickCount} İsabet
              </p>
              <p className={`text-2xl font-bold mt-1 ${
                result.result === "win" ? "text-green-400" : "text-red-400"
              }`}>
                {result.result === "win"
                  ? `${formatAmount(result.payout, { showSign: true })} (${result.multiplier}x)`
                  : `-${formatAmount(parseFloat(stake))}`}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Provably Fair Badge */}
        {result?.fairness && !animating && (
          <div className="flex items-center justify-center gap-2 mb-4 text-xs text-muted-foreground">
            <Shield className="w-3.5 h-3.5 text-green-500" />
            <span>Seed: {result.fairness.serverSeedHash.slice(0, 8)}... | Nonce: {result.fairness.nonce}</span>
            <Link href="/provably-fair" className="text-green-500 hover:underline">Doğrula</Link>
          </div>
        )}

        {/* Stake & Play */}
        <div className="max-w-xs mx-auto space-y-3">
          <div className="flex items-center gap-2">
            <Input
              type="number" value={stake} onChange={(e) => setStake(e.target.value)}
              className="bg-secondary border-border text-foreground" min={1}
              disabled={playing || animating}
            />
            <span className="text-muted-foreground text-sm">{currencySymbol}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {quickStakes.map((qs) => (
              <button key={qs} onClick={() => setStake(String(qs))} disabled={playing || animating}
                className="px-3 py-1.5 text-xs rounded bg-secondary text-foreground/80 hover:bg-accent transition-colors"
              >{qs}</button>
            ))}
            <button onClick={() => { const h = balanceQ.data ? (parseFloat(balanceQ.data.amount) / 2).toFixed(0) : "0"; setStake(h); }}
              disabled={playing || animating}
              className="px-3 py-1 text-xs rounded bg-secondary text-foreground/80 hover:bg-accent transition-colors">1/2</button>
            <button onClick={() => { const m = balanceQ.data ? parseFloat(balanceQ.data.amount).toFixed(0) : "0"; setStake(m); }}
              disabled={playing || animating}
              className="px-3 py-1 text-xs rounded bg-secondary text-foreground/80 hover:bg-accent transition-colors">Max</button>
          </div>
          <Button onClick={handlePlay} disabled={playing || animating || picks.length === 0}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3">
            {playing || animating ? "Çekiliyor..." : `Oyna (${formatAmount(parseFloat(stake || "0"))})`}
          </Button>
          {isAuthenticated && balanceQ.data && (
            <p className="text-center text-xs text-muted-foreground">Bakiye: {formatAmount(balanceQ.data.amount)}</p>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="bg-card/50 border border-border/50 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-foreground/80 mb-2">Nasıl Oynanır?</h3>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>• 1-40 arasından 1 ile 10 arası sayı seçin</li>
          <li>• 40 toptan 10 tanesi çekilir</li>
          <li>• Ne kadar çok isabet, o kadar yüksek çarpan</li>
          <li>• 10/10 isabet = 10.000x!</li>
          <li>• <Shield className="w-3 h-3 inline text-green-500" /> Provably Fair — tüm sonuçlar doğrulanabilir</li>
        </ul>
      </div>
    </div>
  );
}
