import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Rocket, TrendingUp } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";

export default function Crash() {
  const { isAuthenticated } = useAuth();
  const { formatAmount, currencySymbol } = useCurrency();
  const [stake, setStake] = useState("10");
  const [cashOutAt, setCashOutAt] = useState("2.00");
  const [gameState, setGameState] = useState<"idle" | "running" | "crashed" | "cashedOut">("idle");
  const [currentMultiplier, setCurrentMultiplier] = useState(1.0);
  const [crashPoint, setCrashPoint] = useState(0);
  const [result, setResult] = useState<any>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);

  const balanceQ = trpc.balance.get.useQuery(undefined, { enabled: isAuthenticated });
  const playMut = trpc.casino.play.useMutation({
    onSuccess: (data) => {
      setCrashPoint(data.details.crashPoint);
      balanceQ.refetch();
      setResult(data);
    },
    onError: (err) => {
      setGameState("idle");
      toast.error(err.message);
    },
  });

  // Simulate multiplier climbing
  useEffect(() => {
    if (gameState === "running") {
      startTimeRef.current = Date.now();
      intervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        const mult = Math.pow(Math.E, 0.08 * elapsed);
        setCurrentMultiplier(parseFloat(mult.toFixed(2)));

        // Check if we've reached the crash point (from server)
        if (crashPoint > 0 && mult >= crashPoint) {
          setGameState("crashed");
          setCurrentMultiplier(crashPoint);
          if (intervalRef.current) clearInterval(intervalRef.current);
        }

        // Auto cash out
        const target = parseFloat(cashOutAt);
        if (crashPoint > 0 && target <= crashPoint && mult >= target && gameState === "running") {
          setGameState("cashedOut");
          setCurrentMultiplier(target);
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      }, 50);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [gameState, crashPoint, cashOutAt]);

  // Show toast when game ends
  useEffect(() => {
    if (gameState === "crashed" && result) {
      toast.error(`Patladı! ${crashPoint}x'de çöktü`);
    } else if (gameState === "cashedOut" && result) {
      toast.success(`Cash Out! ${formatAmount(result.payout, { showSign: true })}`);
    }
  }, [gameState, result, crashPoint]);

  const handlePlay = () => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    const s = parseFloat(stake);
    const co = parseFloat(cashOutAt);
    if (isNaN(s) || s < 1) {
      toast.error(`Minimum bahis ${formatAmount(1)}`);
      return;
    }
    if (isNaN(co) || co < 1.01) {
      toast.error("Minimum cash out 1.01x");
      return;
    }

    setGameState("running");
    setCurrentMultiplier(1.0);
    setCrashPoint(0);
    setResult(null);

    playMut.mutate({
      gameType: "crash",
      stake: s,
      params: { cashOutAt: co },
    });
  };

  const handleReset = () => {
    setGameState("idle");
    setCurrentMultiplier(1.0);
    setCrashPoint(0);
    setResult(null);
  };

  // History from result
  const history = result?.details?.history || [];

  const quickStakes = [5, 10, 25, 50, 100, 250];
  const quickCashOuts = [1.5, 2, 3, 5, 10, 20];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
          <Rocket className="w-5 h-5 text-orange-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Crash</h1>
          <p className="text-sm text-zinc-400">Çarpan yükselirken doğru zamanda çık!</p>
        </div>
      </div>

      {/* Game Area */}
      <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-6">
        {/* Multiplier Display */}
        <div className="relative h-48 bg-zinc-900/50 rounded-xl mb-6 flex items-center justify-center overflow-hidden">
          {/* Background graph effect */}
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

          <motion.div
            key={gameState}
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="text-center z-10"
          >
            <p
              className={`text-5xl font-bold ${
                gameState === "crashed"
                  ? "text-red-400"
                  : gameState === "cashedOut"
                  ? "text-green-400"
                  : gameState === "running"
                  ? "text-white"
                  : "text-zinc-500"
              }`}
            >
              {currentMultiplier.toFixed(2)}x
            </p>
            <p className="text-sm mt-2 text-zinc-400">
              {gameState === "idle" && "Bahis yaparak başla"}
              {gameState === "running" && "Yükseliyor..."}
              {gameState === "crashed" && `${crashPoint}x'de patladı!`}
              {gameState === "cashedOut" && `${parseFloat(cashOutAt).toFixed(2)}x'de çıktın!`}
            </p>
          </motion.div>

          {/* Rocket animation */}
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

        {/* Result */}
        {(gameState === "crashed" || gameState === "cashedOut") && result && (
          <div
            className={`p-3 rounded-lg mb-4 text-center ${
              result.result === "win"
                ? "bg-green-500/10 border border-green-500/30"
                : "bg-red-500/10 border border-red-500/30"
            }`}
          >
            <p
              className={`text-xl font-bold ${
                result.result === "win" ? "text-green-400" : "text-red-400"
              }`}
            >
              {result.result === "win"
                ? formatAmount(result.payout, { showSign: true })
                : `-${formatAmount(parseFloat(stake))}`}
            </p>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="flex gap-1.5 mb-6 overflow-x-auto pb-2">
            {history.map((h: number, i: number) => (
              <span
                key={i}
                className={`px-2 py-1 text-xs rounded font-mono whitespace-nowrap ${
                  h >= 2 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                }`}
              >
                {h.toFixed(2)}x
              </span>
            ))}
          </div>
        )}

        {/* Controls */}
        <div className="grid grid-cols-2 gap-4">
          {/* Stake */}
          <div className="space-y-2">
            <label className="text-xs text-zinc-400">Bahis Tutarı</label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={stake}
                onChange={(e) => setStake(e.target.value)}
                className="bg-zinc-900 border-zinc-700 text-white text-sm"
                min={1}
                disabled={gameState === "running"}
              />
              <span className="text-zinc-400 text-xs">{currencySymbol}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {quickStakes.map((qs) => (
                <button
                  key={qs}
                  onClick={() => setStake(String(qs))}
                  disabled={gameState === "running"}
                  className="px-2 py-0.5 text-[10px] rounded bg-zinc-700 text-zinc-300 hover:bg-zinc-600 transition-colors"
                >
                  {qs}
                </button>
              ))}
            </div>
          </div>

          {/* Cash Out */}
          <div className="space-y-2">
            <label className="text-xs text-zinc-400">Otomatik Cash Out</label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={cashOutAt}
                onChange={(e) => setCashOutAt(e.target.value)}
                className="bg-zinc-900 border-zinc-700 text-white text-sm"
                min={1.01}
                step={0.1}
                disabled={gameState === "running"}
              />
              <span className="text-zinc-400 text-xs">x</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {quickCashOuts.map((qc) => (
                <button
                  key={qc}
                  onClick={() => setCashOutAt(qc.toFixed(2))}
                  disabled={gameState === "running"}
                  className="px-2 py-0.5 text-[10px] rounded bg-zinc-700 text-zinc-300 hover:bg-zinc-600 transition-colors"
                >
                  {qc}x
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4">
          {gameState === "idle" ? (
            <Button
              onClick={handlePlay}
              className="w-full bg-green-500 hover:bg-green-600 text-black font-bold py-3"
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              Bahis Yap ({formatAmount(parseFloat(stake || "0"))})
            </Button>
          ) : gameState === "running" ? (
            <Button disabled className="w-full bg-yellow-500/50 text-black font-bold py-3">
              <Rocket className="w-4 h-4 mr-2 animate-bounce" />
              Yükseliyor... {currentMultiplier.toFixed(2)}x
            </Button>
          ) : (
            <Button
              onClick={handleReset}
              className="w-full bg-zinc-700 hover:bg-zinc-600 text-white font-bold py-3"
            >
              Yeni Oyun
            </Button>
          )}
        </div>

        {isAuthenticated && balanceQ.data && (
          <p className="text-center text-xs text-zinc-500 mt-3">
            Bakiye: {formatAmount(balanceQ.data.amount)}
          </p>
        )}
      </div>

      {/* Info */}
      <div className="bg-zinc-800/30 border border-zinc-700/30 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-zinc-300 mb-2">Nasıl Oynanır?</h3>
        <ul className="text-xs text-zinc-500 space-y-1">
          <li>• Bahis tutarı ve otomatik cash out çarpanını belirleyin</li>
          <li>• Çarpan 1.00x'den yükselmeye başlar</li>
          <li>• Belirlediğiniz çarpana ulaşırsa otomatik cash out yapılır</li>
          <li>• Çarpan, cash out noktanızdan önce patlarsa kaybedersiniz</li>
          <li>• Ev avantajı: %3</li>
        </ul>
      </div>
    </div>
  );
}
