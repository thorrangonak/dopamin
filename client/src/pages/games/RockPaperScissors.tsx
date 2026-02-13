import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, Shield } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Link } from "wouter";

const CHOICES = [
  { value: "rock" as const, emoji: "🪨", label: "Taş" },
  { value: "paper" as const, emoji: "📄", label: "Kağıt" },
  { value: "scissors" as const, emoji: "✂️", label: "Makas" },
];

export default function RockPaperScissors() {
  const { isAuthenticated } = useAuth();
  const { formatAmount, currencySymbol } = useCurrency();
  const [stake, setStake] = useState("10");
  const [choice, setChoice] = useState<"rock" | "paper" | "scissors">("rock");
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [playCount, setPlayCount] = useState(0);

  const balanceQ = trpc.balance.get.useQuery(undefined, { enabled: isAuthenticated });
  const playMut = trpc.casino.playRPS.useMutation({
    onSuccess: (data) => {
      setResult(data);
      setPlaying(false);
      balanceQ.refetch();
      if (data.details.result === "win") {
        toast.success(`Kazandın! ${formatAmount(data.payout, { showSign: true })}`);
      } else if (data.details.result === "draw") {
        toast.info("Berabere! Bahsin iade edildi.");
      } else {
        toast.error("Kaybettin!");
      }
    },
    onError: (err) => {
      setPlaying(false);
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
    setPlaying(true);
    setResult(null);
    setPlayCount((c) => c + 1);
    playMut.mutate({ stake: s, choice });
  };

  const quickStakes = [5, 10, 25, 50, 100, 250];

  const getResultColor = () => {
    if (!result) return "";
    if (result.details.result === "win") return "bg-green-500/10 border border-green-500/30";
    if (result.details.result === "draw") return "bg-yellow-500/10 border border-yellow-500/30";
    return "bg-red-500/10 border border-red-500/30";
  };

  const houseEmoji = result ? CHOICES.find(c => c.value === result.details.houseChoice)?.emoji : "?";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
          <Swords className="w-5 h-5 text-orange-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Taş Kağıt Makas</h1>
          <p className="text-sm text-muted-foreground">Kazanırsan 1.94x, berabere iade!</p>
        </div>
      </div>

      {/* Game Area */}
      <div className="bg-card border border-border rounded-xl p-4 md:p-8 flex flex-col items-center">
        {/* VS Display */}
        <div className="flex items-center gap-6 md:gap-10 mb-6 md:mb-8">
          {/* Player */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-2">Sen</p>
            <motion.div
              key={`player-${playCount}`}
              initial={playing ? { scale: 0.8 } : {}}
              animate={{ scale: 1 }}
              className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-secondary/50 border-2 border-primary/30 flex items-center justify-center text-4xl md:text-5xl"
            >
              {playing ? (
                <motion.span
                  animate={{ rotate: [0, 10, -10, 10, 0] }}
                  transition={{ repeat: Infinity, duration: 0.5 }}
                >
                  ✊
                </motion.span>
              ) : (
                CHOICES.find(c => c.value === choice)?.emoji
              )}
            </motion.div>
            <p className="text-xs font-semibold mt-2 text-foreground">
              {CHOICES.find(c => c.value === choice)?.label}
            </p>
          </div>

          {/* VS */}
          <div className="text-xl font-bold text-muted-foreground">VS</div>

          {/* House */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-2">Kasa</p>
            <motion.div
              key={`house-${playCount}`}
              initial={result ? { rotateY: 180 } : {}}
              animate={{ rotateY: 0 }}
              transition={{ duration: 0.5 }}
              className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-secondary/50 border-2 border-border flex items-center justify-center text-4xl md:text-5xl"
            >
              {playing ? (
                <motion.span
                  animate={{ rotate: [0, -10, 10, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 0.5 }}
                >
                  ✊
                </motion.span>
              ) : result ? (
                houseEmoji
              ) : (
                "?"
              )}
            </motion.div>
            <p className="text-xs font-semibold mt-2 text-foreground">
              {result ? CHOICES.find(c => c.value === result.details.houseChoice)?.label : "???"}
            </p>
          </div>
        </div>

        {/* Result */}
        <AnimatePresence>
          {result && !playing && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`text-center mb-6 p-4 rounded-lg w-full max-w-xs ${getResultColor()}`}
            >
              <p className="text-lg font-bold">
                {result.details.result === "win" ? "Kazandın!" : result.details.result === "draw" ? "Berabere!" : "Kaybettin!"}
              </p>
              <p className={`text-2xl font-bold mt-1 ${
                result.details.result === "win" ? "text-green-400"
                  : result.details.result === "draw" ? "text-yellow-400"
                  : "text-red-400"
              }`}>
                {result.details.result === "win"
                  ? formatAmount(result.payout, { showSign: true })
                  : result.details.result === "draw"
                  ? "İade"
                  : `-${formatAmount(parseFloat(stake))}`}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Provably Fair Badge */}
        {result?.fairness && (
          <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground">
            <Shield className="w-3.5 h-3.5 text-green-500" />
            <span>Seed: {result.fairness.serverSeedHash.slice(0, 8)}... | Nonce: {result.fairness.nonce}</span>
            <Link href="/provably-fair" className="text-green-500 hover:underline">Doğrula</Link>
          </div>
        )}

        {/* Payout Table */}
        <div className="w-full max-w-sm mb-6 p-3 bg-secondary/30 rounded-lg">
          <p className="text-xs font-semibold text-foreground/80 mb-2">Ödeme Tablosu</p>
          <div className="grid grid-cols-3 gap-2 text-xs text-center">
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2">
              <p className="text-muted-foreground">Kazanç</p>
              <p className="text-green-400 font-bold text-lg">1.94x</p>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2">
              <p className="text-muted-foreground">Berabere</p>
              <p className="text-yellow-400 font-bold text-lg">1.0x</p>
              <p className="text-[10px] text-muted-foreground">İade</p>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2">
              <p className="text-muted-foreground">Kayıp</p>
              <p className="text-red-400 font-bold text-lg">0x</p>
            </div>
          </div>
        </div>

        {/* Choice Buttons */}
        <div className="flex gap-3 mb-6 w-full max-w-sm">
          {CHOICES.map((c) => (
            <button
              key={c.value}
              onClick={() => setChoice(c.value)}
              disabled={playing}
              className={`flex-1 py-3 rounded-lg font-semibold text-sm transition-all flex flex-col items-center gap-1 ${
                choice === c.value
                  ? "bg-primary text-primary-foreground ring-2 ring-primary/50"
                  : "bg-secondary text-foreground/80 hover:bg-accent"
              }`}
            >
              <span className="text-2xl">{c.emoji}</span>
              <span>{c.label}</span>
            </button>
          ))}
        </div>

        {/* Stake */}
        <div className="w-full max-w-xs space-y-3">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              className="bg-secondary border-border text-foreground"
              min={1}
              disabled={playing}
            />
            <span className="text-muted-foreground text-sm">{currencySymbol}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {quickStakes.map((qs) => (
              <button
                key={qs}
                onClick={() => setStake(String(qs))}
                disabled={playing}
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
              disabled={playing}
              className="px-3 py-1 text-xs rounded bg-secondary text-foreground/80 hover:bg-accent transition-colors"
            >
              1/2
            </button>
            <button
              onClick={() => {
                const max = balanceQ.data ? parseFloat(balanceQ.data.amount).toFixed(0) : "0";
                setStake(max);
              }}
              disabled={playing}
              className="px-3 py-1 text-xs rounded bg-secondary text-foreground/80 hover:bg-accent transition-colors"
            >
              Max
            </button>
          </div>

          <Button
            onClick={handlePlay}
            disabled={playing}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3"
          >
            {playing ? "Oynuyor..." : `Bahis Yap (${formatAmount(parseFloat(stake || "0"))})`}
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
          <li>• Taş, Kağıt veya Makas seçin</li>
          <li>• Bahis tutarınızı girin</li>
          <li>• Kazanırsanız 1.94x çarpan</li>
          <li>• Berabere = bahsiniz iade edilir</li>
          <li>• Ev avantajı: ~%2</li>
          <li>• <Shield className="w-3 h-3 inline text-green-500" /> Provably Fair — tüm sonuçlar doğrulanabilir</li>
        </ul>
      </div>
    </div>
  );
}
