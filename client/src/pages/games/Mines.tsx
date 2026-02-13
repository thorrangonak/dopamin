import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Bomb, Gem, DollarSign } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";

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
  const [currentMultiplier, setCurrentMultiplier] = useState(1);
  const [totalWin, setTotalWin] = useState(0);
  const [minePositions, setMinePositions] = useState<number[]>([]);

  const balanceQ = trpc.balance.get.useQuery(undefined, { enabled: isAuthenticated });
  const playMut = trpc.casino.play.useMutation({
    onSuccess: (data) => {
      balanceQ.refetch();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // Calculate multiplier for current revealed count
  const calcMultiplier = (revealed: number, mines: number) => {
    const total = 25;
    const safe = total - mines;
    let mult = 1;
    for (let i = 0; i < revealed; i++) {
      mult *= (total - i) / (safe - i);
    }
    return parseFloat((mult * 0.97).toFixed(4));
  };

  const nextMultiplier = useMemo(
    () => calcMultiplier(revealedCount + 1, mineCount),
    [revealedCount, mineCount]
  );

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

    // Generate mine positions locally
    const mines = new Set<number>();
    while (mines.size < mineCount) {
      mines.add(Math.floor(Math.random() * 25));
    }
    setMinePositions(Array.from(mines));

    setGrid(Array(25).fill("hidden"));
    setRevealedCount(0);
    setGameOver(false);
    setCurrentMultiplier(1);
    setTotalWin(0);
    setPlaying(true);
  };

  const handleCellClick = (index: number) => {
    if (!playing || gameOver || grid[index] !== "hidden") return;

    const newGrid = [...grid];
    const isMine = minePositions.includes(index);

    if (isMine) {
      // Hit a mine - reveal all
      newGrid[index] = "mine";
      minePositions.forEach((pos) => {
        newGrid[pos] = "mine";
      });
      setGrid(newGrid);
      setGameOver(true);
      setPlaying(false);

      // Send loss to server
      const s = parseFloat(stake);
      playMut.mutate({
        gameType: "mines",
        stake: s,
        params: { mines: mineCount, revealed: revealedCount, cashOut: false },
      });
      toast.error("Mayına bastın! 💥");
    } else {
      // Safe cell
      newGrid[index] = "safe";
      const newRevealed = revealedCount + 1;
      const newMult = calcMultiplier(newRevealed, mineCount);
      setGrid(newGrid);
      setRevealedCount(newRevealed);
      setCurrentMultiplier(newMult);

      // Check if all safe cells revealed
      if (newRevealed >= 25 - mineCount) {
        handleCashOut(newRevealed);
      }
    }
  };

  const handleCashOut = (overrideRevealed?: number) => {
    const revealed = overrideRevealed ?? revealedCount;
    if (revealed === 0) return;

    const s = parseFloat(stake);
    const mult = calcMultiplier(revealed, mineCount);
    const payout = s * mult;

    // Reveal all mines
    const newGrid = [...grid];
    minePositions.forEach((pos) => {
      if (newGrid[pos] === "hidden") newGrid[pos] = "mine";
    });
    setGrid(newGrid);
    setGameOver(true);
    setPlaying(false);
    setTotalWin(payout);

    // Send win to server
    playMut.mutate({
      gameType: "mines",
      stake: s,
      params: { mines: mineCount, revealed, cashOut: true },
    });
    toast.success(`Cash Out! ${formatAmount(payout, { showSign: true })} (${mult.toFixed(2)}x)`);
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
          <h1 className="text-xl font-bold text-white">Mines</h1>
          <p className="text-sm text-zinc-400">Mayınlardan kaçın, çarpanı artır!</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-4">
        {/* Game Grid */}
        <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4">
          {/* Multiplier Bar */}
          {playing && revealedCount > 0 && (
            <div className="flex items-center justify-between mb-4 p-3 bg-zinc-900/50 rounded-lg">
              <div>
                <p className="text-xs text-zinc-500">Mevcut Çarpan</p>
                <p className="text-lg font-bold text-green-400">{currentMultiplier.toFixed(2)}x</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Potansiyel Kazanç</p>
                <p className="text-lg font-bold text-yellow-400">
                  {formatAmount(parseFloat(stake) * currentMultiplier)}
                </p>
              </div>
              <Button
                onClick={() => handleCashOut()}
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
              >
                <DollarSign className="w-4 h-4 mr-1" />
                Cash Out
              </Button>
            </div>
          )}

          {/* 5x5 Grid */}
          <div className="grid grid-cols-5 gap-2 max-w-[400px] mx-auto">
            {grid.map((cell, i) => (
              <motion.button
                key={i}
                onClick={() => handleCellClick(i)}
                disabled={!playing || gameOver || cell !== "hidden"}
                whileHover={cell === "hidden" && playing ? { scale: 1.05 } : {}}
                whileTap={cell === "hidden" && playing ? { scale: 0.95 } : {}}
                initial={cell !== "hidden" ? { rotateY: 180 } : { rotateY: 0 }}
                animate={{ rotateY: cell !== "hidden" ? 0 : 0 }}
                className={`aspect-square rounded-lg flex items-center justify-center text-lg font-bold transition-all ${
                  cell === "hidden"
                    ? playing
                      ? "bg-zinc-700 hover:bg-zinc-600 cursor-pointer border border-zinc-600"
                      : "bg-zinc-700/50 border border-zinc-700 cursor-default"
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
        </div>

        {/* Controls */}
        <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 space-y-4">
          {/* Mine Count */}
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Mayın Sayısı</label>
            <div className="flex flex-wrap gap-1.5">
              {mineOptions.map((m) => (
                <button
                  key={m}
                  onClick={() => !playing && setMineCount(m)}
                  disabled={playing}
                  className={`px-2.5 py-1 text-xs rounded transition-colors ${
                    mineCount === m
                      ? "bg-red-500 text-white"
                      : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Stake */}
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Bahis Tutarı</label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={stake}
                onChange={(e) => setStake(e.target.value)}
                className="bg-zinc-900 border-zinc-700 text-white text-sm"
                min={1}
                disabled={playing}
              />
              <span className="text-zinc-400 text-xs">{currencySymbol}</span>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {quickStakes.map((qs) => (
                <button
                  key={qs}
                  onClick={() => setStake(String(qs))}
                  disabled={playing}
                  className="px-2 py-0.5 text-[10px] rounded bg-zinc-700 text-zinc-300 hover:bg-zinc-600 transition-colors"
                >
                  {qs}
                </button>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-zinc-400">
              <span>Mayınlar</span>
              <span className="text-red-400">{mineCount}</span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span>Güvenli Hücre</span>
              <span className="text-green-400">{25 - mineCount}</span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span>Açılan</span>
              <span className="text-white">{revealedCount}</span>
            </div>
            {playing && (
              <div className="flex justify-between text-zinc-400">
                <span>Sonraki Çarpan</span>
                <span className="text-yellow-400">{nextMultiplier.toFixed(2)}x</span>
              </div>
            )}
          </div>

          {!playing ? (
            <Button
              onClick={handleStart}
              className="w-full bg-green-500 hover:bg-green-600 text-black font-bold"
            >
              Oyunu Başlat
            </Button>
          ) : (
            <Button
              onClick={() => {
                setPlaying(false);
                setGameOver(true);
                const newGrid = [...grid];
                minePositions.forEach((pos) => {
                  if (newGrid[pos] === "hidden") newGrid[pos] = "mine";
                });
                setGrid(newGrid);
              }}
              variant="outline"
              className="w-full border-zinc-600 text-zinc-300"
            >
              Oyunu Bırak
            </Button>
          )}

          {isAuthenticated && balanceQ.data && (
            <p className="text-center text-[10px] text-zinc-500">
              Bakiye: {formatAmount(balanceQ.data.amount)}
            </p>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="bg-zinc-800/30 border border-zinc-700/30 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-zinc-300 mb-2">Nasıl Oynanır?</h3>
        <ul className="text-xs text-zinc-500 space-y-1">
          <li>• Mayın sayısını ve bahis tutarını belirleyin</li>
          <li>• Hücrelere tıklayarak açın - her güvenli hücre çarpanı artırır</li>
          <li>• İstediğiniz zaman Cash Out yaparak kazancınızı alın</li>
          <li>• Mayına basarsanız tüm bahsinizi kaybedersiniz</li>
          <li>• Daha fazla mayın = daha yüksek çarpanlar</li>
        </ul>
      </div>
    </div>
  );
}
