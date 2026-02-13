import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Grid3x3, Shield } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Link } from "wouter";

const BINGO_HEADERS = ["B", "I", "N", "G", "O"];

export default function Bingo() {
  const { isAuthenticated } = useAuth();
  const { formatAmount, currencySymbol } = useCurrency();
  const [stake, setStake] = useState("10");
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [card, setCard] = useState<number[][] | null>(null);
  const [drawnBalls, setDrawnBalls] = useState<number[]>([]);
  const [visibleBalls, setVisibleBalls] = useState<number[]>([]);
  const [markedCells, setMarkedCells] = useState<boolean[][]>([]);
  const [animating, setAnimating] = useState(false);
  const [currentBallIdx, setCurrentBallIdx] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const balanceQ = trpc.balance.get.useQuery(undefined, { enabled: isAuthenticated });
  const playMut = trpc.casino.playBingo.useMutation({
    onSuccess: (data) => {
      setResult(data);
      setCard(data.details.card);
      setDrawnBalls(data.details.drawnBalls);
      setMarkedCells(data.details.marked);
      setVisibleBalls([]);
      setCurrentBallIdx(0);
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

    intervalRef.current = setInterval(() => {
      setCurrentBallIdx((prev) => {
        const next = prev + 1;
        if (next > drawnBalls.length) {
          clearInterval(intervalRef.current!);
          setAnimating(false);
          setPlaying(false);
          // Show final result
          if (result) {
            if (result.result === "win") {
              toast.success(`Kazandın! ${formatAmount(result.payout, { showSign: true })} (${result.multiplier}x)`);
            } else {
              toast.error("Bingo yok! Kaybettin.");
            }
          }
          return prev;
        }
        setVisibleBalls((vb) => [...vb, drawnBalls[next - 1]]);
        return next;
      });
    }, 100);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [animating, drawnBalls]);

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
    setPlaying(true);
    setResult(null);
    setCard(null);
    setVisibleBalls([]);
    setCurrentBallIdx(0);
    playMut.mutate({ stake: s });
  };

  const isCellMarked = (row: number, col: number): boolean => {
    if (!card || !markedCells.length) return false;
    // Check if this cell's number has been drawn up to currentBallIdx
    if (row === 2 && col === 2) return true; // Free space
    const cellNumber = card[col][row];
    const drawnSoFar = visibleBalls;
    return drawnSoFar.includes(cellNumber);
  };

  const getBallLetter = (num: number): string => {
    if (num <= 15) return "B";
    if (num <= 30) return "I";
    if (num <= 45) return "N";
    if (num <= 60) return "G";
    return "O";
  };

  const quickStakes = [5, 10, 25, 50, 100, 250];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
          <Grid3x3 className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Bingo</h1>
          <p className="text-sm text-muted-foreground">30 top, 5x5 kart — çizgi tamamla, kazan!</p>
        </div>
      </div>

      {/* Game Area */}
      <div className="bg-card border border-border rounded-xl p-4 md:p-6">
        {/* Bingo Card */}
        {card && (
          <div className="mb-4">
            {/* Header Row */}
            <div className="grid grid-cols-5 gap-1 max-w-[320px] mx-auto mb-1">
              {BINGO_HEADERS.map((h) => (
                <div key={h} className="text-center text-sm font-bold text-primary py-1">
                  {h}
                </div>
              ))}
            </div>
            {/* Card Grid */}
            <div className="grid grid-cols-5 gap-1 max-w-[320px] mx-auto">
              {Array.from({ length: 5 }, (_, row) =>
                Array.from({ length: 5 }, (_, col) => {
                  const isFree = row === 2 && col === 2;
                  const cellNumber = card[col][row];
                  const isMarked = isCellMarked(row, col);
                  return (
                    <motion.div
                      key={`${row}-${col}`}
                      animate={isMarked && !isFree ? { scale: [1, 1.1, 1] } : {}}
                      transition={{ duration: 0.3 }}
                      className={`aspect-square rounded-lg flex items-center justify-center text-sm font-bold transition-all ${
                        isFree
                          ? "bg-primary/20 border-2 border-primary text-primary"
                          : isMarked
                          ? "bg-green-500/20 border-2 border-green-500 text-green-400"
                          : "bg-secondary border border-border text-foreground/70"
                      }`}
                    >
                      {isFree ? "★" : cellNumber}
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Drawn Balls */}
        {visibleBalls.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-muted-foreground mb-2">
              Çekilen Toplar ({visibleBalls.length}/30)
              {animating && <span className="ml-2 text-primary animate-pulse">Çekiliyor...</span>}
            </p>
            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
              {visibleBalls.map((ball, i) => {
                const isOnCard = card ? card.some(col => col.includes(ball)) : false;
                return (
                  <motion.span
                    key={i}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-[10px] font-bold ${
                      isOnCard
                        ? "bg-green-500/20 text-green-400 border border-green-500/50"
                        : "bg-secondary text-muted-foreground border border-border"
                    }`}
                  >
                    {getBallLetter(ball)}{ball}
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
                {result.details.isFullHouse
                  ? "FULL HOUSE!"
                  : result.details.lineCount > 0
                  ? `${result.details.lineCount} Çizgi!`
                  : "Bingo Yok"}
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

        {/* Multiplier Table */}
        <div className="mb-4 p-3 bg-secondary/30 rounded-lg">
          <p className="text-xs font-semibold text-foreground/80 mb-2">Çarpan Tablosu</p>
          <div className="grid grid-cols-4 gap-2 text-xs text-center">
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2">
              <p className="text-muted-foreground">1 Çizgi</p>
              <p className="text-yellow-400 font-bold text-base">5x</p>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2">
              <p className="text-muted-foreground">2 Çizgi</p>
              <p className="text-yellow-400 font-bold text-base">12x</p>
            </div>
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-2">
              <p className="text-muted-foreground">3+ Çizgi</p>
              <p className="text-orange-400 font-bold text-base">30x</p>
            </div>
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2">
              <p className="text-muted-foreground">Full House</p>
              <p className="text-green-400 font-bold text-base">500x</p>
            </div>
          </div>
        </div>

        {/* Stake & Play */}
        <div className="max-w-xs mx-auto space-y-3">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              className="bg-secondary border-border text-foreground"
              min={1}
              disabled={playing || animating}
            />
            <span className="text-muted-foreground text-sm">{currencySymbol}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {quickStakes.map((qs) => (
              <button
                key={qs}
                onClick={() => setStake(String(qs))}
                disabled={playing || animating}
                className="px-3 py-1.5 text-xs rounded bg-secondary text-foreground/80 hover:bg-accent transition-colors"
              >
                {qs}
              </button>
            ))}
            <button
              onClick={() => {
                const half = balanceQ.data ? (parseFloat(balanceQ.data.amount) / 2).toFixed(0) : "0";
                setStake(half);
              }}
              disabled={playing || animating}
              className="px-3 py-1 text-xs rounded bg-secondary text-foreground/80 hover:bg-accent transition-colors"
            >
              1/2
            </button>
            <button
              onClick={() => {
                const max = balanceQ.data ? parseFloat(balanceQ.data.amount).toFixed(0) : "0";
                setStake(max);
              }}
              disabled={playing || animating}
              className="px-3 py-1 text-xs rounded bg-secondary text-foreground/80 hover:bg-accent transition-colors"
            >
              Max
            </button>
          </div>

          <Button
            onClick={handlePlay}
            disabled={playing || animating}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3"
          >
            {playing || animating ? "Çekiliyor..." : `Oyna (${formatAmount(parseFloat(stake || "0"))})`}
          </Button>

          {isAuthenticated && balanceQ.data && (
            <p className="text-center text-xs text-muted-foreground">
              Bakiye: {formatAmount(balanceQ.data.amount)}
            </p>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="bg-card/50 border border-border/50 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-foreground/80 mb-2">Nasıl Oynanır?</h3>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>• 5x5 Bingo kartı otomatik oluşturulur</li>
          <li>• 75 toptan 30 tanesi çekilir</li>
          <li>• Ortadaki hücre ücretsiz (FREE)</li>
          <li>• Yatay, dikey veya çapraz çizgi tamamlayın</li>
          <li>• 1 çizgi=5x, 2 çizgi=12x, 3+=30x, Full House=500x</li>
          <li>• <Shield className="w-3 h-3 inline text-green-500" /> Provably Fair — tüm sonuçlar doğrulanabilir</li>
        </ul>
      </div>
    </div>
  );
}
