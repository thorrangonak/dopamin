import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Shield } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Link } from "wouter";

export default function Limbo() {
  const { isAuthenticated } = useAuth();
  const { formatAmount, currencySymbol } = useCurrency();
  const [stake, setStake] = useState("10");
  const [target, setTarget] = useState("2.00");
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [playCount, setPlayCount] = useState(0);

  const balanceQ = trpc.balance.get.useQuery(undefined, { enabled: isAuthenticated });
  const playMut = trpc.casino.playLimbo.useMutation({
    onSuccess: (data) => {
      setResult(data);
      setPlaying(false);
      balanceQ.refetch();
      if (data.result === "win") {
        toast.success(`Kazandın! ${formatAmount(data.payout, { showSign: true })} (${data.multiplier}x)`);
      } else {
        toast.error(`${data.details.result}x — Hedef: ${data.details.target}x — Kaybettin!`);
      }
    },
    onError: (err) => {
      setPlaying(false);
      toast.error(err.message);
    },
  });

  const handlePlay = () => {
    if (!isAuthenticated) { window.location.href = getLoginUrl(); return; }
    const s = parseFloat(stake);
    const t = parseFloat(target);
    if (isNaN(s) || s < 1) { toast.error(`Minimum bahis ${formatAmount(1)}`); return; }
    if (isNaN(t) || t < 1.01) { toast.error("Minimum hedef: 1.01x"); return; }
    setPlaying(true);
    setResult(null);
    setPlayCount((c) => c + 1);
    playMut.mutate({ stake: s, target: t });
  };

  const winChance = Math.min(97, parseFloat((97 / parseFloat(target || "2")).toFixed(2)));
  const quickTargets = [1.5, 2, 3, 5, 10, 50, 100];
  const quickStakes = [5, 10, 25, 50, 100, 250];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
          <Zap className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Limbo</h1>
          <p className="text-sm text-muted-foreground">Hedef çarpan belirle — sistem onu geçerse kazan!</p>
        </div>
      </div>

      {/* Game Area */}
      <div className="bg-card border border-border rounded-xl p-4 md:p-8 flex flex-col items-center">
        {/* Payout Info */}
        <div className="w-full max-w-sm mb-6 p-3 bg-secondary/30 rounded-lg">
          <div className="grid grid-cols-3 gap-2 text-xs text-center">
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2">
              <p className="text-muted-foreground">Hedef</p>
              <p className="text-amber-400 font-bold text-base">{parseFloat(target || "0").toFixed(2)}x</p>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2">
              <p className="text-muted-foreground">Şans</p>
              <p className="text-blue-400 font-bold text-base">{isNaN(winChance) ? "—" : `%${winChance}`}</p>
            </div>
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2">
              <p className="text-muted-foreground">Kazanç</p>
              <p className="text-green-400 font-bold text-base">
                {formatAmount(parseFloat(stake || "0") * parseFloat(target || "0"))}
              </p>
            </div>
          </div>
        </div>

        {/* Result Display */}
        <div className="relative w-48 h-48 md:w-56 md:h-56 mb-6 flex items-center justify-center">
          <div className={`w-full h-full rounded-full border-4 flex items-center justify-center transition-all duration-500 ${
            result
              ? result.result === "win"
                ? "bg-green-500/10 border-green-500"
                : "bg-red-500/10 border-red-500"
              : "bg-secondary/50 border-border"
          }`}>
            <AnimatePresence mode="wait">
              {playing ? (
                <motion.div
                  key="playing"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ repeat: Infinity, duration: 0.8 }}
                  className="text-4xl font-bold text-muted-foreground"
                >
                  ...
                </motion.div>
              ) : result ? (
                <motion.div
                  key={`result-${playCount}`}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-center"
                >
                  <p className={`text-4xl md:text-5xl font-black ${
                    result.result === "win" ? "text-green-400" : "text-red-400"
                  }`}>
                    {result.details.result}x
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Hedef: {result.details.target}x
                  </p>
                </motion.div>
              ) : (
                <motion.div key="idle" className="text-center">
                  <Zap className="w-12 h-12 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Hedef Belirle</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Win/Loss Banner */}
        <AnimatePresence>
          {result && !playing && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`text-center mb-6 p-4 rounded-lg w-full max-w-sm ${
                result.result === "win"
                  ? "bg-green-500/10 border border-green-500/30"
                  : "bg-red-500/10 border border-red-500/30"
              }`}
            >
              <p className={`text-2xl font-bold ${
                result.result === "win" ? "text-green-400" : "text-red-400"
              }`}>
                {result.result === "win"
                  ? formatAmount(result.payout, { showSign: true })
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

        {/* Target Input */}
        <div className="w-full max-w-xs space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Hedef Çarpan</label>
            <Input
              type="number" value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="bg-secondary border-border text-foreground text-lg font-bold text-center"
              min={1.01} step={0.1} disabled={playing}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {quickTargets.map((qt) => (
              <button key={qt} onClick={() => setTarget(String(qt.toFixed(2)))} disabled={playing}
                className={`px-3 py-1.5 text-xs rounded transition-colors ${
                  parseFloat(target) === qt
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-foreground/80 hover:bg-accent"
                }`}
              >{qt}x</button>
            ))}
          </div>

          {/* Stake */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Bahis Tutarı</label>
            <div className="flex items-center gap-2">
              <Input
                type="number" value={stake} onChange={(e) => setStake(e.target.value)}
                className="bg-secondary border-border text-foreground" min={1} disabled={playing}
              />
              <span className="text-muted-foreground text-sm">{currencySymbol}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {quickStakes.map((qs) => (
              <button key={qs} onClick={() => setStake(String(qs))} disabled={playing}
                className="px-3 py-1.5 text-xs rounded bg-secondary text-foreground/80 hover:bg-accent transition-colors"
              >{qs}</button>
            ))}
            <button onClick={() => { const h = balanceQ.data ? (parseFloat(balanceQ.data.amount) / 2).toFixed(0) : "0"; setStake(h); }}
              disabled={playing} className="px-3 py-1 text-xs rounded bg-secondary text-foreground/80 hover:bg-accent transition-colors">1/2</button>
            <button onClick={() => { const m = balanceQ.data ? parseFloat(balanceQ.data.amount).toFixed(0) : "0"; setStake(m); }}
              disabled={playing} className="px-3 py-1 text-xs rounded bg-secondary text-foreground/80 hover:bg-accent transition-colors">Max</button>
          </div>

          <Button onClick={handlePlay} disabled={playing}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3">
            {playing ? "Hesaplanıyor..." : `Bahis Yap (${formatAmount(parseFloat(stake || "0"))})`}
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
          <li>• Hedef çarpan belirleyin (1.01x - 1.000.000x)</li>
          <li>• Sistem rastgele bir çarpan üretir</li>
          <li>• Sonuç hedefinize eşit veya yüksekse kazanırsınız</li>
          <li>• Yüksek hedef = yüksek ödeme, düşük şans</li>
          <li>• Ev avantajı: %3</li>
          <li>• <Shield className="w-3 h-3 inline text-green-500" /> Provably Fair — tüm sonuçlar doğrulanabilir</li>
        </ul>
      </div>
    </div>
  );
}
