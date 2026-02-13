import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Bomb, Gem, DollarSign, Shield } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Link } from "wouter";

type CellState = "hidden" | "safe" | "mine";

export default function Mines() {
  const { isAuthenticated } = useAuth();
  const { formatAmount, currencySymbol } = useCurrency();
  const [stake, setStake] = useState("10");
  const [mineCount, setMineCount] = useState(5);
  const [playing, setPlaying] = useState(false);
  const [grid, setGrid] = useState<CellState[]>(Array(25).fill("hidden"));
  const [revealedCount, setRevealedCount] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [currentMultiplier, setCurrentMultiplier] = useState(0);
  const [nextMult, setNextMult] = useState(0);
  const [totalWin, setTotalWin] = useState(0);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [minePositions, setMinePositions] = useState<number[]>([]);
  const [commitHash, setCommitHash] = useState<string | null>(null);
  const [fairness, setFairness] = useState<any>(null);

  const balanceQ = trpc.balance.get.useQuery(undefined, { enabled: isAuthenticated });

  // Check for existing active session on mount
  const activeSessionQ = trpc.casino.getActiveSession.useQuery(undefined, {
    enabled: isAuthenticated && !playing && !gameOver,
    refetchOnWindowFocus: false,
  });

  // Resume active session if exists
  useMemo(() => {
    if (activeSessionQ.data && !playing && !gameOver) {
      const s = activeSessionQ.data;
      setSessionId(s.sessionId);
      setMineCount(s.mineCount);
      setStake(String(s.stake));
      setRevealedCount(s.revealedCells.length);
      setCurrentMultiplier(s.multiplier);
      setNextMult(s.nextMultiplier);
      setCommitHash(s.commitHash);
      setPlaying(true);

      // Restore grid
      const newGrid: CellState[] = Array(25).fill("hidden");
      s.revealedCells.forEach((i: number) => {
        newGrid[i] = "safe";
      });
      setGrid(newGrid);
    }
  }, [activeSessionQ.data]);

  const startMut = trpc.casino.startMines.useMutation({
    onSuccess: (data) => {
      setSessionId(data.sessionId);
      setCommitHash(data.commitHash);
      setFairness(data.fairness);
      setPlaying(true);
      setGrid(Array(25).fill("hidden"));
      setRevealedCount(0);
      setCurrentMultiplier(0);
      setNextMult(0);
      setGameOver(false);
      setTotalWin(0);
      setMinePositions([]);
      balanceQ.refetch();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const revealMut = trpc.casino.revealMine.useMutation({
    onSuccess: (data) => {
      const newGrid = [...grid];

      if (data.isMine) {
        // Hit mine — reveal all mines
        data.minePositions!.forEach((pos: number) => {
          newGrid[pos] = "mine";
        });
        // Keep safe cells revealed
        data.revealedCells.forEach((pos: number) => {
          if (!data.minePositions!.includes(pos)) {
            newGrid[pos] = "safe";
          }
        });
        setGrid(newGrid);
        setGameOver(true);
        setPlaying(false);
        setMinePositions(data.minePositions!);
        toast.error("Mayına bastın! 💥");
      } else {
        // Safe cell
        data.revealedCells.forEach((pos: number) => {
          newGrid[pos] = "safe";
        });
        setGrid(newGrid);
        setRevealedCount(data.revealedCells.length);
        setCurrentMultiplier(data.multiplier);
        setNextMult(data.nextMultiplier || 0);

        if (data.gameOver) {
          // All safe cells revealed — auto cash out
          setGameOver(true);
          setPlaying(false);
          setTotalWin(data.payout!);
          if (data.minePositions) setMinePositions(data.minePositions);
          // Reveal mines on grid
          if (data.minePositions) {
            data.minePositions.forEach((pos: number) => {
              newGrid[pos] = "mine";
            });
            setGrid([...newGrid]);
          }
          balanceQ.refetch();
          toast.success(`Tüm hücreler açıldı! ${formatAmount(data.payout!, { showSign: true })} (${data.multiplier}x)`);
        }
      }
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const cashOutMut = trpc.casino.cashOutMines.useMutation({
    onSuccess: (data) => {
      setGameOver(true);
      setPlaying(false);
      setTotalWin(data.payout);
      setCurrentMultiplier(data.multiplier);
      setMinePositions(data.minePositions);

      // Reveal mines on grid
      const newGrid = [...grid];
      data.minePositions.forEach((pos: number) => {
        if (newGrid[pos] === "hidden") newGrid[pos] = "mine";
      });
      setGrid(newGrid);
      balanceQ.refetch();
      toast.success(`Cash Out! ${formatAmount(data.payout, { showSign: true })} (${data.multiplier.toFixed(2)}x)`);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleStart = () => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    const s = parseFloat(stake);
    if (isNaN(s) || s < 1) {
      toast.error(`Minimum bahis ${formatAmount(1)}`);
      return;
    }
    startMut.mutate({ stake: s, mineCount });
  };

  const handleCellClick = (index: number) => {
    if (!playing || gameOver || grid[index] !== "hidden" || !sessionId) return;
    if (revealMut.isPending) return;
    revealMut.mutate({ sessionId, cellIndex: index });
  };

  const handleCashOut = () => {
    if (!sessionId || revealedCount === 0) return;
    cashOutMut.mutate({ sessionId });
  };

  const handleNewGame = () => {
    setPlaying(false);
    setGameOver(false);
    setGrid(Array(25).fill("hidden"));
    setRevealedCount(0);
    setCurrentMultiplier(0);
    setNextMult(0);
    setTotalWin(0);
    setSessionId(null);
    setMinePositions([]);
    setCommitHash(null);
  };

  const quickStakes = [5, 10, 25, 50, 100];
  const mineOptions = [1, 3, 5, 10, 15, 20, 24];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
          <Bomb className="w-5 h-5 text-red-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Mines</h1>
          <p className="text-sm text-muted-foreground">Mayınlardan kaçın, çarpanı artır!</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-4">
        {/* Game Grid */}
        <div className="bg-card border border-border rounded-xl p-4">
          {/* Multiplier Bar */}
          {playing && revealedCount > 0 && (
            <div className="flex items-center justify-between mb-4 p-3 bg-secondary/50 rounded-lg">
              <div>
                <p className="text-xs text-muted-foreground">Mevcut Çarpan</p>
                <p className="text-lg font-bold text-green-400">{currentMultiplier.toFixed(2)}x</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Potansiyel Kazanç</p>
                <p className="text-lg font-bold text-yellow-400">
                  {formatAmount(parseFloat(stake) * currentMultiplier)}
                </p>
              </div>
              <Button
                onClick={handleCashOut}
                disabled={cashOutMut.isPending}
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
              >
                <DollarSign className="w-4 h-4 mr-1" />
                Cash Out
              </Button>
            </div>
          )}

          {/* Commit Hash */}
          {commitHash && playing && (
            <div className="flex items-center gap-2 mb-3 text-[10px] text-muted-foreground">
              <Shield className="w-3 h-3 text-green-500" />
              <span>Commit: {commitHash.slice(0, 12)}...</span>
            </div>
          )}

          {/* 5x5 Grid */}
          <div className="grid grid-cols-5 gap-2 max-w-[400px] mx-auto">
            {grid.map((cell, i) => (
              <motion.button
                key={i}
                onClick={() => handleCellClick(i)}
                disabled={!playing || gameOver || cell !== "hidden" || revealMut.isPending}
                whileHover={cell === "hidden" && playing ? { scale: 1.05 } : {}}
                whileTap={cell === "hidden" && playing ? { scale: 0.95 } : {}}
                className={`aspect-square rounded-lg flex items-center justify-center text-lg font-bold transition-all ${
                  cell === "hidden"
                    ? playing
                      ? "bg-secondary hover:bg-accent cursor-pointer border border-border"
                      : "bg-secondary/50 border border-border cursor-default"
                    : cell === "safe"
                    ? "bg-green-500/20 border-2 border-green-500"
                    : "bg-red-500/20 border-2 border-red-500"
                }`}
              >
                {cell === "safe" && <Gem className="w-5 h-5 text-green-400" />}
                {cell === "mine" && <Bomb className="w-5 h-5 text-red-400" />}
              </motion.button>
            ))}
          </div>

          {/* Game Over Message */}
          {gameOver && totalWin > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-center"
            >
              <p className="text-green-400 font-bold text-lg">
                {formatAmount(totalWin, { showSign: true })} ({currentMultiplier.toFixed(2)}x)
              </p>
            </motion.div>
          )}

          {/* Provably Fair Badge */}
          {gameOver && fairness && (
            <div className="flex items-center justify-center gap-2 mt-4 text-xs text-muted-foreground">
              <Shield className="w-3.5 h-3.5 text-green-500" />
              <span>Seed: {fairness.serverSeedHash.slice(0, 8)}... | Nonce: {fairness.nonce}</span>
              <Link href="/provably-fair" className="text-green-500 hover:underline">Doğrula</Link>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-4">
          {/* Mine Count */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Mayın Sayısı</label>
            <div className="flex flex-wrap gap-1.5">
              {mineOptions.map((m) => (
                <button
                  key={m}
                  onClick={() => !playing && setMineCount(m)}
                  disabled={playing}
                  className={`px-2.5 py-1.5 text-xs rounded transition-colors ${
                    mineCount === m
                      ? "bg-red-500 text-white"
                      : "bg-secondary text-foreground/80 hover:bg-accent"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Stake */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Bahis Tutarı</label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={stake}
                onChange={(e) => setStake(e.target.value)}
                className="bg-secondary border-border text-foreground text-sm"
                min={1}
                disabled={playing}
              />
              <span className="text-muted-foreground text-xs">{currencySymbol}</span>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {quickStakes.map((qs) => (
                <button
                  key={qs}
                  onClick={() => setStake(String(qs))}
                  disabled={playing}
                  className="px-2.5 py-1.5 text-[11px] rounded bg-secondary text-foreground/80 hover:bg-accent transition-colors"
                >
                  {qs}
                </button>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Mayınlar</span>
              <span className="text-red-400">{mineCount}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Güvenli Hücre</span>
              <span className="text-green-400">{25 - mineCount}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Açılan</span>
              <span className="text-foreground">{revealedCount}</span>
            </div>
            {playing && nextMult > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Sonraki Çarpan</span>
                <span className="text-yellow-400">{nextMult.toFixed(2)}x</span>
              </div>
            )}
          </div>

          {!playing && !gameOver ? (
            <Button
              onClick={handleStart}
              disabled={startMut.isPending}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
            >
              {startMut.isPending ? "Başlatılıyor..." : "Oyunu Başlat"}
            </Button>
          ) : gameOver ? (
            <Button
              onClick={handleNewGame}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
            >
              Yeni Oyun
            </Button>
          ) : (
            <Button
              onClick={handleCashOut}
              disabled={revealedCount === 0 || cashOutMut.isPending}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
            >
              <DollarSign className="w-4 h-4 mr-1" />
              {cashOutMut.isPending ? "Ödeniyor..." : "Cash Out"}
            </Button>
          )}

          {isAuthenticated && balanceQ.data && (
            <p className="text-center text-[10px] text-muted-foreground">
              Bakiye: {formatAmount(balanceQ.data.amount)}
            </p>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="bg-card/50 border border-border/50 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-foreground/80 mb-2">Nasıl Oynanır?</h3>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>• Mayın sayısını ve bahis tutarını belirleyin</li>
          <li>• Hücrelere tıklayarak açın - her güvenli hücre çarpanı artırır</li>
          <li>• İstediğiniz zaman Cash Out yaparak kazancınızı alın</li>
          <li>• Mayına basarsanız tüm bahsinizi kaybedersiniz</li>
          <li>• Daha fazla mayın = daha yüksek çarpanlar</li>
          <li>• Ev avantajı: %3</li>
          <li>• <Shield className="w-3 h-3 inline text-green-500" /> Provably Fair — tüm sonuçlar doğrulanabilir</li>
        </ul>
      </div>
    </div>
  );
}
