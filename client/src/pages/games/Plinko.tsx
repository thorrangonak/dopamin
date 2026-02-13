import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Triangle } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";

const ROWS = 8;
const SLOTS = ROWS + 1; // 9 slots at bottom
const MULTIPLIERS = [8.9, 3.0, 1.4, 1.1, 1.0, 1.1, 1.4, 3.0, 8.9];
const SLOT_COLORS = [
  "bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-green-500/70", "bg-green-500",
  "bg-green-500/70", "bg-yellow-500", "bg-orange-500", "bg-red-500",
];

export default function Plinko() {
  const { isAuthenticated } = useAuth();
  const { formatAmount, currencySymbol } = useCurrency();
  const [stake, setStake] = useState("10");
  const [dropping, setDropping] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [ballPath, setBallPath] = useState<{ x: number; y: number }[]>([]);
  const [landedSlot, setLandedSlot] = useState<number | null>(null);
  const animRef = useRef(0);

  const balanceQ = trpc.balance.get.useQuery(undefined, { enabled: isAuthenticated });
  const playMut = trpc.casino.play.useMutation({
    onSuccess: (data) => {
      // Simulate ball path
      const path: { x: number; y: number }[] = [];
      let xPos = 4; // Start center (0-8 grid)
      path.push({ x: xPos, y: 0 });

      // Generate path based on result slot
      const targetSlot = data.details.slot;
      const drift = targetSlot - 4; // How far from center
      const stepsNeeded = Math.abs(drift);

      for (let row = 1; row <= ROWS; row++) {
        // Bias direction toward target
        const remaining = ROWS - row;
        const currentDrift = xPos - 4;
        const neededDrift = drift - currentDrift;

        let goRight: boolean;
        if (Math.abs(neededDrift) > remaining) {
          goRight = neededDrift > 0;
        } else {
          goRight = Math.random() > 0.5 ? neededDrift >= 0 : neededDrift > 0;
        }

        xPos += goRight ? 0.5 : -0.5;
        xPos = Math.max(0, Math.min(8, xPos));
        path.push({ x: xPos, y: row });
      }

      setBallPath(path);
      setLandedSlot(targetSlot);
      animRef.current++;

      // Show result after animation
      setTimeout(() => {
        setResult(data);
        setDropping(false);
        balanceQ.refetch();
        if (data.result === "win") {
          toast.success(`Kazandın! ${formatAmount(data.payout, { showSign: true })} (${data.multiplier}x)`);
        } else {
          toast.error(`${MULTIPLIERS[targetSlot]}x - ${formatAmount(data.payout)}`);
        }
      }, 1500);
    },
    onError: (err) => {
      setDropping(false);
      toast.error(err.message);
    },
  });

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
    setDropping(true);
    setResult(null);
    setLandedSlot(null);
    setBallPath([]);
    playMut.mutate({ gameType: "plinko", stake: s, params: {} });
  };

  const quickStakes = [5, 10, 25, 50, 100, 250];

  // Board dimensions - responsive
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  const boardWidth = isMobile ? Math.min(320, window.innerWidth - 64) : 360;
  const boardHeight = isMobile ? Math.min(280, boardWidth * 0.88) : 320;
  const pinSpacing = boardWidth / (ROWS + 2);
  const rowHeight = boardHeight / (ROWS + 1);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
          <Triangle className="w-5 h-5 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Plinko</h1>
          <p className="text-sm text-zinc-400">Topu bırak, çarpana güven!</p>
        </div>
      </div>

      {/* Game Area */}
      <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 md:p-6">
        {/* Plinko Board */}
        <div className="flex justify-center mb-6">
          <div className="relative" style={{ width: boardWidth, height: boardHeight + 50 }}>
            {/* Background */}
            <div className="absolute inset-0 bg-zinc-900/80 rounded-xl" />

            {/* Pins */}
            {Array.from({ length: ROWS }, (_, row) => {
              const pinsInRow = row + 3;
              const startX = (boardWidth - (pinsInRow - 1) * pinSpacing) / 2;
              return Array.from({ length: pinsInRow }, (_, pin) => (
                <div
                  key={`${row}-${pin}`}
                  className="absolute w-2 h-2 rounded-full bg-zinc-500"
                  style={{
                    left: startX + pin * pinSpacing - 4,
                    top: (row + 1) * rowHeight - 4,
                  }}
                />
              ));
            })}

            {/* Ball animation */}
            <AnimatePresence>
              {ballPath.length > 0 && dropping && (
                <motion.div
                  key={animRef.current}
                  className="absolute w-4 h-4 rounded-full bg-yellow-400 shadow-lg shadow-yellow-400/50 z-10"
                  initial={{ left: boardWidth / 2 - 8, top: 0 }}
                  animate={{
                    left: ballPath.map((p) => {
                      const normalizedX = p.x / 8;
                      return normalizedX * (boardWidth - 40) + 12;
                    }),
                    top: ballPath.map((p) => p.y * rowHeight),
                  }}
                  transition={{
                    duration: 1.2,
                    ease: "easeIn",
                    times: ballPath.map((_, i) => i / (ballPath.length - 1)),
                  }}
                />
              )}
            </AnimatePresence>

            {/* Bottom slots */}
            <div
              className="absolute bottom-0 left-0 right-0 flex gap-1 px-1"
              style={{ height: 40 }}
            >
              {MULTIPLIERS.map((mult, i) => (
                <div
                  key={i}
                  className={`flex-1 rounded-b-lg flex items-center justify-center text-[10px] font-bold text-white transition-all ${
                    SLOT_COLORS[i]
                  } ${landedSlot === i ? "ring-2 ring-yellow-400 scale-105" : "opacity-70"}`}
                >
                  {mult}x
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Result */}
        {result && !dropping && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`text-center mb-4 p-3 rounded-lg ${
              result.multiplier >= 1.4
                ? "bg-green-500/10 border border-green-500/30"
                : result.multiplier >= 1.0
                ? "bg-yellow-500/10 border border-yellow-500/30"
                : "bg-red-500/10 border border-red-500/30"
            }`}
          >
            <p className="text-sm text-zinc-300">
              Slot: {landedSlot! + 1} | Çarpan: {result.multiplier}x
            </p>
            <p
              className={`text-xl font-bold mt-1 ${
                result.result === "win" ? "text-green-400" : "text-red-400"
              }`}
            >
              {result.result === "win"
                ? formatAmount(result.payout, { showSign: true })
                : formatAmount(result.payout)}
            </p>
          </motion.div>
        )}

        {/* Stake & Play */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              className="bg-zinc-900 border-zinc-700 text-white"
              min={1}
              disabled={dropping}
            />
            <span className="text-zinc-400 text-sm">{currencySymbol}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {quickStakes.map((qs) => (
              <button
                key={qs}
                onClick={() => setStake(String(qs))}
                disabled={dropping}
                className="px-3 py-1.5 text-xs rounded bg-zinc-700 text-zinc-300 hover:bg-zinc-600 transition-colors"
              >
                {qs}
              </button>
            ))}
            <button
              onClick={() => {
                const half = balanceQ.data ? (parseFloat(balanceQ.data.amount) / 2).toFixed(0) : "0";
                setStake(half);
              }}
              disabled={dropping}
              className="px-3 py-1 text-xs rounded bg-zinc-700 text-zinc-300 hover:bg-zinc-600 transition-colors"
            >
              1/2
            </button>
            <button
              onClick={() => {
                const max = balanceQ.data ? parseFloat(balanceQ.data.amount).toFixed(0) : "0";
                setStake(max);
              }}
              disabled={dropping}
              className="px-3 py-1 text-xs rounded bg-zinc-700 text-zinc-300 hover:bg-zinc-600 transition-colors"
            >
              Max
            </button>
          </div>

          <Button
            onClick={handlePlay}
            disabled={dropping}
            className="w-full bg-green-500 hover:bg-green-600 text-black font-bold py-3"
          >
            {dropping ? "Top Düşüyor..." : `Topu Bırak (${formatAmount(parseFloat(stake || "0"))})`}
          </Button>

          {isAuthenticated && balanceQ.data && (
            <p className="text-center text-xs text-zinc-500">
              Bakiye: {formatAmount(balanceQ.data.amount)}
            </p>
          )}
        </div>
      </div>

      {/* Multiplier Table */}
      <div className="bg-zinc-800/30 border border-zinc-700/30 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-zinc-300 mb-3">Çarpan Tablosu</h3>
        <div className="grid grid-cols-9 gap-1">
          {MULTIPLIERS.map((mult, i) => (
            <div
              key={i}
              className={`text-center py-2 rounded text-xs font-bold text-white ${SLOT_COLORS[i]}`}
            >
              {mult}x
            </div>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="bg-zinc-800/30 border border-zinc-700/30 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-zinc-300 mb-2">Nasıl Oynanır?</h3>
        <ul className="text-xs text-zinc-500 space-y-1">
          <li>• Bahis tutarınızı girin ve topu bırakın</li>
          <li>• Top pimlere çarparak aşağı düşer</li>
          <li>• Düştüğü slot'un çarpanı kazancınızı belirler</li>
          <li>• Kenarlardaki slotlar daha yüksek çarpanlara sahip</li>
          <li>• Ortadaki slotlar daha düşük ama daha olası</li>
        </ul>
      </div>
    </div>
  );
}
