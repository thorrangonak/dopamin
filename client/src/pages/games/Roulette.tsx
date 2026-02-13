import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { CircleDot, Shield } from "lucide-react";
import { Link } from "wouter";
import { useCurrency } from "@/contexts/CurrencyContext";

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

type BetType = "red" | "black" | "green" | "odd" | "even" | "high" | "low" | "number";

export default function Roulette() {
  const { isAuthenticated } = useAuth();
  const { formatAmount, currencySymbol } = useCurrency();
  const [stake, setStake] = useState("10");
  const [betType, setBetType] = useState<BetType>("red");
  const [betNumber, setBetNumber] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [spinRotation, setSpinRotation] = useState(0);

  const balanceQ = trpc.balance.get.useQuery(undefined, { enabled: isAuthenticated });
  const playMut = trpc.casino.playRoulette.useMutation({
    onSuccess: (data) => {
      // Calculate rotation to land on result number
      const resultNum = data.details.result;
      const slotAngle = 360 / 37;
      const targetAngle = resultNum * slotAngle;
      setSpinRotation((prev) => prev + 1440 + targetAngle); // 4 full rotations + target

      setTimeout(() => {
        setResult(data);
        setSpinning(false);
        balanceQ.refetch();
        if (data.result === "win") {
          toast.success(`Kazandın! ${formatAmount(data.payout, { showSign: true })} (${data.multiplier}x)`);
        } else {
          toast.error(`Kaybettin! Sonuç: ${data.details.result} (${data.details.color})`);
        }
      }, 2000);
    },
    onError: (err) => {
      setSpinning(false);
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
    setSpinning(true);
    setResult(null);
    playMut.mutate({
      stake: s,
      betType,
      number: betNumber,
    });
  };

  const getNumberColor = (n: number) => {
    if (n === 0) return "green";
    return RED_NUMBERS.includes(n) ? "red" : "black";
  };

  const getMultiplier = () => {
    switch (betType) {
      case "number": return "36x";
      case "green": return "36x";
      default: return "2x";
    }
  };

  const quickStakes = [5, 10, 25, 50, 100, 250];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
          <CircleDot className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Roulette</h1>
          <p className="text-sm text-muted-foreground">Klasik Avrupa ruleti - 0'dan 36'ya</p>
        </div>
      </div>

      {/* Game Area */}
      <div className="bg-card border border-border rounded-xl p-4 md:p-6">
        {/* Wheel */}
        <div className="flex justify-center mb-4 md:mb-6">
          <div className="relative w-40 h-40 md:w-48 md:h-48">
            <motion.div
              className="w-full h-full rounded-full border-4 border-yellow-600 bg-secondary flex items-center justify-center overflow-hidden"
              animate={{ rotate: spinRotation }}
              transition={{ duration: 2, ease: "easeOut" }}
            >
              {/* Simplified wheel segments */}
              <div className="absolute inset-2 rounded-full overflow-hidden">
                {Array.from({ length: 37 }, (_, i) => {
                  const color = getNumberColor(i);
                  const angle = (i / 37) * 360;
                  return (
                    <div
                      key={i}
                      className="absolute w-full h-full"
                      style={{
                        transform: `rotate(${angle}deg)`,
                        clipPath: "polygon(50% 50%, 48% 0%, 52% 0%)",
                        backgroundColor:
                          color === "red" ? "#dc2626" : color === "green" ? "#16a34a" : "#1a1a2e",
                      }}
                    />
                  );
                })}
              </div>
              {/* Center */}
              <div className="relative z-10 w-16 h-16 rounded-full bg-card border-2 border-yellow-600 flex items-center justify-center">
                <span className="text-lg font-bold text-foreground">
                  {result ? result.details.result : "?"}
                </span>
              </div>
            </motion.div>
            {/* Pointer */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 w-0 h-0 border-l-[8px] border-r-[8px] border-t-[16px] border-l-transparent border-r-transparent border-t-yellow-500 z-20" />
          </div>
        </div>

        {/* Result */}
        {result && !spinning && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`text-center mb-6 p-3 rounded-lg ${
              result.result === "win"
                ? "bg-green-500/10 border border-green-500/30"
                : "bg-red-500/10 border border-red-500/30"
            }`}
          >
            <div className="flex items-center justify-center gap-2 mb-1">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                  result.details.color === "red"
                    ? "bg-red-600"
                    : result.details.color === "green"
                    ? "bg-green-600"
                    : "bg-secondary border border-border"
                }`}
              >
                {result.details.result}
              </span>
              <span className="text-foreground/80 text-sm capitalize">{result.details.color}</span>
            </div>
            <p
              className={`text-xl font-bold ${
                result.result === "win" ? "text-green-400" : "text-red-400"
              }`}
            >
              {result.result === "win"
                ? formatAmount(result.payout, { showSign: true })
                : `-${formatAmount(parseFloat(stake))}`}
            </p>
          </motion.div>
        )}

        {/* Provably Fair Badge */}
        {result?.fairness && (
          <div className="flex items-center justify-center gap-2 mb-4 text-xs text-muted-foreground">
            <Shield className="w-3.5 h-3.5 text-green-500" />
            <span>Seed: {result.fairness.serverSeedHash.slice(0, 8)}... | Nonce: {result.fairness.nonce}</span>
            <Link href="/provably-fair" className="text-green-500 hover:underline">Doğrula</Link>
          </div>
        )}

        {/* Bet Type Selection */}
        <div className="space-y-3 mb-6">
          <label className="text-xs text-muted-foreground">Bahis Türü</label>

          {/* Color bets */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setBetType("red")}
              disabled={spinning}
              className={`py-2.5 rounded-lg text-sm font-semibold transition-all ${
                betType === "red"
                  ? "bg-red-600 text-white ring-2 ring-red-400"
                  : "bg-red-600/30 text-red-300 hover:bg-red-600/50"
              }`}
            >
              Kırmızı (2x)
            </button>
            <button
              onClick={() => setBetType("green")}
              disabled={spinning}
              className={`py-2.5 rounded-lg text-sm font-semibold transition-all ${
                betType === "green"
                  ? "bg-green-600 text-white ring-2 ring-green-400"
                  : "bg-green-600/30 text-green-300 hover:bg-green-600/50"
              }`}
            >
              Yeşil (36x)
            </button>
            <button
              onClick={() => setBetType("black")}
              disabled={spinning}
              className={`py-2.5 rounded-lg text-sm font-semibold transition-all ${
                betType === "black"
                  ? "bg-secondary text-foreground ring-2 ring-muted-foreground"
                  : "bg-secondary/50 text-foreground/80 hover:bg-secondary"
              }`}
            >
              Siyah (2x)
            </button>
          </div>

          {/* Other bets */}
          <div className="grid grid-cols-4 gap-2">
            {(["odd", "even", "low", "high"] as BetType[]).map((bt) => {
              const labels: Record<string, string> = {
                odd: "Tek", even: "Çift", low: "1-18", high: "19-36",
              };
              return (
                <button
                  key={bt}
                  onClick={() => setBetType(bt)}
                  disabled={spinning}
                  className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                    betType === bt
                      ? "bg-blue-600 text-white ring-2 ring-blue-400"
                      : "bg-secondary text-foreground/80 hover:bg-accent"
                  }`}
                >
                  {labels[bt]} (2x)
                </button>
              );
            })}
          </div>

          {/* Number bet */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBetType("number")}
              disabled={spinning}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                betType === "number"
                  ? "bg-yellow-600 text-white ring-2 ring-yellow-400"
                  : "bg-secondary text-foreground/80 hover:bg-accent"
              }`}
            >
              Numara (36x)
            </button>
            {betType === "number" && (
              <Input
                type="number"
                value={betNumber}
                onChange={(e) => setBetNumber(Math.max(0, Math.min(36, parseInt(e.target.value) || 0)))}
                className="w-20 bg-secondary border-border text-foreground text-sm"
                min={0}
                max={36}
                disabled={spinning}
              />
            )}
          </div>

          {/* Number grid */}
          {betType === "number" && (
            <div className="grid grid-cols-6 sm:grid-cols-9 md:grid-cols-12 gap-1">
              {Array.from({ length: 37 }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setBetNumber(i)}
                  disabled={spinning}
                  className={`w-full aspect-square rounded text-[10px] font-bold transition-all ${
                    betNumber === i
                      ? "ring-2 ring-yellow-400 scale-110 z-10"
                      : ""
                  } ${
                    i === 0
                      ? "bg-green-600 text-white col-span-1"
                      : RED_NUMBERS.includes(i)
                      ? "bg-red-600 text-white"
                      : "bg-secondary text-foreground/80 border border-border"
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Stake & Play */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              className="bg-secondary border-border text-foreground"
              min={1}
              disabled={spinning}
            />
            <span className="text-muted-foreground text-sm">{currencySymbol}</span>
            <span className="text-xs text-muted-foreground">Çarpan: {getMultiplier()}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {quickStakes.map((qs) => (
              <button
                key={qs}
                onClick={() => setStake(String(qs))}
                disabled={spinning}
                className="px-3 py-1.5 text-xs rounded bg-secondary text-foreground/80 hover:bg-accent transition-colors"
              >
                {qs}
              </button>
            ))}
          </div>

          <Button
            onClick={handlePlay}
            disabled={spinning}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3"
          >
            {spinning ? "Çark Dönüyor..." : `Çevir (${formatAmount(parseFloat(stake || "0"))})`}
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
          <li>• Kırmızı/Siyah/Yeşil, Tek/Çift, Düşük/Yüksek veya Numara seçin</li>
          <li>• Kırmızı/Siyah/Tek/Çift/1-18/19-36: 2x çarpan</li>
          <li>• Yeşil (0) veya Numara: 36x çarpan</li>
          <li>• Avrupa ruleti: 0-36 arası 37 numara</li>
        </ul>
      </div>
    </div>
  );
}
