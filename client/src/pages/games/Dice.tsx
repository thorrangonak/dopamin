import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Dices, Shield } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Link } from "wouter";

export default function Dice() {
  const { isAuthenticated } = useAuth();
  const { formatAmount, currencySymbol } = useCurrency();
  const [stake, setStake] = useState("10");
  const [target, setTarget] = useState(50);
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<any>(null);

  const balanceQ = trpc.balance.get.useQuery(undefined, { enabled: isAuthenticated });
  const playMut = trpc.casino.playDice.useMutation({
    onSuccess: (data) => {
      setResult(data);
      setRolling(false);
      balanceQ.refetch();
      if (data.result === "win") {
        toast.success(`Kazandın! ${formatAmount(data.payout, { showSign: true })}`);
      } else {
        toast.error(`Kaybettin! Zar: ${data.details.roll}`);
      }
    },
    onError: (err) => {
      setRolling(false);
      toast.error(err.message);
    },
  });

  const multiplier = target > 1 ? (98 / target).toFixed(4) : "0";
  const winChance = target;

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
    setRolling(true);
    setResult(null);
    playMut.mutate({ stake: s, target });
  };

  const quickStakes = [5, 10, 25, 50, 100, 250];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
          <Dices className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Dice</h1>
          <p className="text-sm text-muted-foreground">Hedef sayının altına düşür, kazan!</p>
        </div>
      </div>

      {/* Game Area */}
      <div className="bg-card border border-border rounded-xl p-4 md:p-8">
        {/* Result Display */}
        <div className="flex justify-center mb-6 md:mb-8">
          <motion.div
            key={result?.details?.roll}
            initial={result ? { scale: 0.5, opacity: 0 } : false}
            animate={{ scale: 1, opacity: 1 }}
            className={`w-24 h-24 md:w-32 md:h-32 rounded-2xl border-4 flex items-center justify-center text-3xl md:text-4xl font-bold ${
              result
                ? result.result === "win"
                  ? "bg-green-500/20 border-green-500 text-green-400"
                  : "bg-red-500/20 border-red-500 text-red-400"
                : "bg-secondary/50 border-border text-muted-foreground"
            }`}
          >
            {rolling ? (
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.3 }}
              >
                🎲
              </motion.span>
            ) : result ? (
              result.details.roll
            ) : (
              "?"
            )}
          </motion.div>
        </div>

        {/* Result Message */}
        <AnimatePresence>
          {result && !rolling && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`text-center mb-6 p-3 rounded-lg ${
                result.result === "win"
                  ? "bg-green-500/10 border border-green-500/30"
                  : "bg-red-500/10 border border-red-500/30"
              }`}
            >
              <p className="text-sm text-foreground/80">
                Zar: <span className="font-bold text-foreground">{result.details.roll}</span>
                {" | "}Hedef: <span className="font-bold text-foreground">≤{result.details.target}</span>
              </p>
              <p
                className={`text-xl font-bold mt-1 ${
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

        {/* Provably Fair Badge */}
        {result?.fairness && (
          <div className="flex items-center justify-center gap-2 mb-4 text-xs text-muted-foreground">
            <Shield className="w-3.5 h-3.5 text-green-500" />
            <span>Seed: {result.fairness.serverSeedHash.slice(0, 8)}... | Nonce: {result.fairness.nonce}</span>
            <Link href="/provably-fair" className="text-green-500 hover:underline">Doğrula</Link>
          </div>
        )}

        {/* Slider */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>1</span>
            <span>Hedef: ≤{target}</span>
            <span>95</span>
          </div>
          <Slider
            value={[target]}
            onValueChange={(v) => setTarget(v[0])}
            min={2}
            max={95}
            step={1}
            disabled={rolling}
            className="mb-4"
          />
          <div className="relative h-2 bg-secondary rounded-full overflow-hidden -mt-2 mb-4">
            <div
              className="absolute left-0 top-0 h-full bg-green-500/40 rounded-full transition-all"
              style={{ width: `${((target - 2) / 93) * 100}%` }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-secondary/50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Çarpan</p>
            <p className="text-lg font-bold text-foreground">{multiplier}x</p>
          </div>
          <div className="bg-secondary/50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Kazanma Şansı</p>
            <p className="text-lg font-bold text-green-400">{winChance}%</p>
          </div>
          <div className="bg-secondary/50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Potansiyel Kazanç</p>
            <p className="text-lg font-bold text-yellow-400">
              {formatAmount(parseFloat(stake || "0") * parseFloat(multiplier))}
            </p>
          </div>
        </div>

        {/* Stake */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              className="bg-secondary border-border text-foreground"
              min={1}
              disabled={rolling}
            />
            <span className="text-muted-foreground text-sm">{currencySymbol}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {quickStakes.map((qs) => (
              <button
                key={qs}
                onClick={() => setStake(String(qs))}
                disabled={rolling}
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
              disabled={rolling}
              className="px-3 py-1 text-xs rounded bg-secondary text-foreground/80 hover:bg-accent transition-colors"
            >
              1/2
            </button>
            <button
              onClick={() => {
                const max = balanceQ.data ? parseFloat(balanceQ.data.amount).toFixed(0) : "0";
                setStake(max);
              }}
              disabled={rolling}
              className="px-3 py-1 text-xs rounded bg-secondary text-foreground/80 hover:bg-accent transition-colors"
            >
              Max
            </button>
          </div>

          <Button
            onClick={handlePlay}
            disabled={rolling}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3"
          >
            {rolling ? "Zar Atılıyor..." : `Zar At (${formatAmount(parseFloat(stake || "0"))})`}
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
          <li>• Slider ile hedef sayıyı belirleyin (2-95)</li>
          <li>• Zar 0.00-99.99 arasında atılır</li>
          <li>• Zar hedef sayının altında gelirse kazanırsınız</li>
          <li>• Düşük hedef = yüksek çarpan, yüksek hedef = düşük çarpan</li>
          <li>• Ev avantajı: %2</li>
          <li>• <Shield className="w-3 h-3 inline text-green-500" /> Provably Fair — tüm sonuçlar doğrulanabilir</li>
        </ul>
      </div>
    </div>
  );
}
