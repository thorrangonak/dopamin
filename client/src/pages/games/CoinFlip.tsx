import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Coins, RotateCcw } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";

export default function CoinFlip() {
  const { user, isAuthenticated } = useAuth();
  const { formatAmount, currencySymbol } = useCurrency();
  const [stake, setStake] = useState("10");
  const [choice, setChoice] = useState<"heads" | "tails">("heads");
  const [flipping, setFlipping] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [flipCount, setFlipCount] = useState(0);

  const balanceQ = trpc.balance.get.useQuery(undefined, { enabled: isAuthenticated });
  const playMut = trpc.casino.play.useMutation({
    onSuccess: (data) => {
      setResult(data);
      setFlipping(false);
      balanceQ.refetch();
      if (data.result === "win") {
        toast.success(`Kazandın! ${formatAmount(data.payout, { showSign: true })}`);
      } else {
        toast.error("Kaybettin!");
      }
    },
    onError: (err) => {
      setFlipping(false);
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
    setFlipping(true);
    setResult(null);
    setFlipCount((c) => c + 1);
    playMut.mutate({ gameType: "coinflip", stake: s, params: { choice } });
  };

  const quickStakes = [5, 10, 25, 50, 100, 250];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
          <Coins className="w-5 h-5 text-yellow-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Coin Flip</h1>
          <p className="text-sm text-zinc-400">Yazı mı Tura mı? 1.96x çarpan</p>
        </div>
      </div>

      {/* Game Area */}
      <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 md:p-8 flex flex-col items-center">
        {/* Coin */}
        <div className="relative w-32 h-32 md:w-40 md:h-40 mb-6 md:mb-8">
          <motion.div
            key={flipCount}
            className="w-full h-full"
            animate={flipping ? { rotateY: [0, 1800] } : {}}
            transition={{ duration: 1.5, ease: "easeOut" }}
          >
            <div
              className={`w-full h-full rounded-full border-4 flex items-center justify-center text-3xl font-bold transition-colors duration-300 ${
                result
                  ? result.details.flip === "heads"
                    ? "bg-yellow-500/30 border-yellow-500 text-yellow-400"
                    : "bg-blue-500/30 border-blue-500 text-blue-400"
                  : "bg-zinc-700/50 border-zinc-600 text-zinc-400"
              }`}
            >
              {flipping ? (
                <RotateCcw className="w-12 h-12 animate-spin" />
              ) : result ? (
                result.details.flip === "heads" ? "Y" : "T"
              ) : (
                "?"
              )}
            </div>
          </motion.div>
        </div>

        {/* Result */}
        <AnimatePresence>
          {result && !flipping && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`text-center mb-6 p-4 rounded-lg ${
                result.result === "win"
                  ? "bg-green-500/10 border border-green-500/30"
                  : "bg-red-500/10 border border-red-500/30"
              }`}
            >
              <p className="text-lg font-bold">
                {result.details.flip === "heads" ? "Yazı" : "Tura"}
              </p>
              <p
                className={`text-2xl font-bold mt-1 ${
                  result.result === "win" ? "text-green-400" : "text-red-400"
                }`}
              >
                {result.result === "win"
                  ? formatAmount(result.payout, { showSign: true })
                  : `-${formatAmount(parseFloat(stake))}`}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Choice */}
        <div className="flex gap-3 mb-6 w-full max-w-xs">
          <button
            onClick={() => setChoice("heads")}
            disabled={flipping}
            className={`flex-1 py-3 rounded-lg font-semibold text-sm transition-all ${
              choice === "heads"
                ? "bg-yellow-500 text-black"
                : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
            }`}
          >
            Yazı
          </button>
          <button
            onClick={() => setChoice("tails")}
            disabled={flipping}
            className={`flex-1 py-3 rounded-lg font-semibold text-sm transition-all ${
              choice === "tails"
                ? "bg-blue-500 text-white"
                : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
            }`}
          >
            Tura
          </button>
        </div>

        {/* Stake */}
        <div className="w-full max-w-xs space-y-3">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              className="bg-zinc-900 border-zinc-700 text-white"
              min={1}
              disabled={flipping}
            />
            <span className="text-zinc-400 text-sm">{currencySymbol}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {quickStakes.map((qs) => (
              <button
                key={qs}
                onClick={() => setStake(String(qs))}
                disabled={flipping}
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
              disabled={flipping}
              className="px-3 py-1 text-xs rounded bg-zinc-700 text-zinc-300 hover:bg-zinc-600 transition-colors"
            >
              1/2
            </button>
            <button
              onClick={() => {
                const max = balanceQ.data ? parseFloat(balanceQ.data.amount).toFixed(0) : "0";
                setStake(max);
              }}
              disabled={flipping}
              className="px-3 py-1 text-xs rounded bg-zinc-700 text-zinc-300 hover:bg-zinc-600 transition-colors"
            >
              Max
            </button>
          </div>

          <Button
            onClick={handlePlay}
            disabled={flipping}
            className="w-full bg-green-500 hover:bg-green-600 text-black font-bold py-3"
          >
            {flipping ? "Atılıyor..." : `Bahis Yap (${formatAmount(parseFloat(stake || "0"))})`}
          </Button>

          {isAuthenticated && balanceQ.data && (
            <p className="text-center text-xs text-zinc-500">
              Bakiye: {formatAmount(balanceQ.data.amount)}
            </p>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="bg-zinc-800/30 border border-zinc-700/30 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-zinc-300 mb-2">Nasıl Oynanır?</h3>
        <ul className="text-xs text-zinc-500 space-y-1">
          <li>• Yazı veya Tura seçin</li>
          <li>• Bahis tutarınızı girin</li>
          <li>• Doğru tahmin = 1.96x kazanç</li>
          <li>• Ev avantajı: %2</li>
        </ul>
      </div>
    </div>
  );
}
