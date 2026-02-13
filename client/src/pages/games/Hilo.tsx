import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpDown, DollarSign, Shield, ChevronUp, ChevronDown } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Link } from "wouter";

type HiloCard = { rank: string; suit: string; numericValue: number };

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠",
};
const SUIT_COLORS: Record<string, string> = {
  hearts: "text-red-500", diamonds: "text-red-500", clubs: "text-foreground", spades: "text-foreground",
};

function CardDisplay({ card, size = "normal" }: { card: HiloCard; size?: "normal" | "large" }) {
  const isLarge = size === "large";
  return (
    <motion.div
      initial={{ opacity: 0, rotateY: 180 }}
      animate={{ opacity: 1, rotateY: 0 }}
      transition={{ duration: 0.4 }}
      className={`${isLarge ? "w-20 h-28 md:w-24 md:h-36" : "w-12 h-17 md:w-14 md:h-20"} rounded-lg border-2 bg-card border-border flex flex-col items-center justify-center shadow-md`}
    >
      <span className={`${isLarge ? "text-2xl md:text-3xl" : "text-sm"} font-bold ${SUIT_COLORS[card.suit]}`}>
        {card.rank}
      </span>
      <span className={`${isLarge ? "text-2xl md:text-3xl" : "text-base"} ${SUIT_COLORS[card.suit]}`}>
        {SUIT_SYMBOLS[card.suit]}
      </span>
    </motion.div>
  );
}

export default function Hilo() {
  const { isAuthenticated } = useAuth();
  const { formatAmount, currencySymbol } = useCurrency();
  const [stake, setStake] = useState("10");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [currentCard, setCurrentCard] = useState<HiloCard | null>(null);
  const [prevCards, setPrevCards] = useState<HiloCard[]>([]);
  const [correctGuesses, setCorrectGuesses] = useState(0);
  const [currentMultiplier, setCurrentMultiplier] = useState(1);
  const [nextMultHigher, setNextMultHigher] = useState(0);
  const [nextMultLower, setNextMultLower] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [commitHash, setCommitHash] = useState<string | null>(null);
  const [fairness, setFairness] = useState<any>(null);

  const balanceQ = trpc.balance.get.useQuery(undefined, { enabled: isAuthenticated });

  // Resume session
  const activeSessionQ = trpc.casino.getActiveHiloSession.useQuery(undefined, {
    enabled: isAuthenticated && !sessionId && !gameOver,
    refetchOnWindowFocus: false,
  });

  useMemo(() => {
    if (activeSessionQ.data && !sessionId && !gameOver) {
      const s = activeSessionQ.data;
      setSessionId(s.sessionId);
      setCurrentCard(s.currentCard);
      setCorrectGuesses(s.correctGuesses);
      setCurrentMultiplier(s.currentMultiplier);
      setNextMultHigher(s.nextMultiplierHigher);
      setNextMultLower(s.nextMultiplierLower);
      setCommitHash(s.commitHash);
      setStake(String(s.stake));
    }
  }, [activeSessionQ.data]);

  const startMut = trpc.casino.startHilo.useMutation({
    onSuccess: (data) => {
      setSessionId(data.sessionId);
      setCurrentCard(data.currentCard);
      setPrevCards([]);
      setCorrectGuesses(0);
      setCurrentMultiplier(1);
      setGameOver(false);
      setLastResult(null);
      setCommitHash(data.commitHash);
      setFairness(data.fairness);
      balanceQ.refetch();

      // Calculate initial multipliers
      const v = data.currentCard.numericValue;
      const higher = (13 - v) * 4;
      const lower = (v - 1) * 4;
      setNextMultHigher(higher > 0 ? parseFloat((0.97 * 51 / higher).toFixed(4)) : 0);
      setNextMultLower(lower > 0 ? parseFloat((0.97 * 51 / lower).toFixed(4)) : 0);
    },
    onError: (err) => toast.error(err.message),
  });

  const guessMut = trpc.casino.hiloGuess.useMutation({
    onSuccess: (data) => {
      if (currentCard) setPrevCards((p) => [...p, currentCard]);
      setCurrentCard(data.nextCard);

      if (data.correct) {
        setCorrectGuesses(data.correctGuesses);
        setCurrentMultiplier(data.multiplier);
        if (data.nextMultiplierHigher !== undefined) {
          setNextMultHigher(data.nextMultiplierHigher);
          setNextMultLower(data.nextMultiplierLower!);
        }

        if (data.gameOver) {
          setGameOver(true);
          setSessionId(null);
          setLastResult({ won: true, payout: data.payout, multiplier: data.multiplier });
          balanceQ.refetch();
          toast.success(`Deste bitti! ${formatAmount(data.payout!, { showSign: true })} (${data.multiplier}x)`);
        }
      } else {
        setGameOver(true);
        setSessionId(null);
        setLastResult({ won: false });
        toast.error("Yanlış tahmin! Kaybettin.");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const cashOutMut = trpc.casino.cashOutHilo.useMutation({
    onSuccess: (data) => {
      setGameOver(true);
      setSessionId(null);
      setLastResult({ won: true, payout: data.payout, multiplier: data.multiplier });
      balanceQ.refetch();
      toast.success(`Cash Out! ${formatAmount(data.payout, { showSign: true })} (${data.multiplier.toFixed(2)}x)`);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleStart = () => {
    if (!isAuthenticated) { window.location.href = getLoginUrl(); return; }
    const s = parseFloat(stake);
    if (isNaN(s) || s < 1) { toast.error(`Minimum bahis ${formatAmount(1)}`); return; }
    startMut.mutate({ stake: s });
  };

  const handleGuess = (guess: "higher" | "lower") => {
    if (!sessionId) return;
    guessMut.mutate({ sessionId, guess });
  };

  const handleCashOut = () => {
    if (!sessionId || correctGuesses === 0) return;
    cashOutMut.mutate({ sessionId });
  };

  const handleNewGame = () => {
    setSessionId(null);
    setCurrentCard(null);
    setPrevCards([]);
    setCorrectGuesses(0);
    setCurrentMultiplier(1);
    setGameOver(false);
    setLastResult(null);
    setCommitHash(null);
  };

  const isPlaying = sessionId !== null && !gameOver;
  const quickStakes = [5, 10, 25, 50, 100];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
          <ArrowUpDown className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Hi-Lo</h1>
          <p className="text-sm text-muted-foreground">Sonraki kart yüksek mi düşük mü? Doğru tahmin et!</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-4">
        {/* Game Area */}
        <div className="bg-card border border-border rounded-xl p-4">
          {/* Payout Table */}
          <div className="mb-4 p-3 bg-secondary/30 rounded-lg">
            <p className="text-xs font-semibold text-foreground/80 mb-2">Nasıl Çalışır</p>
            <div className="grid grid-cols-3 gap-2 text-xs text-center">
              <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-2">
                <p className="text-muted-foreground">Mekanik</p>
                <p className="text-indigo-400 font-bold text-sm">Kümülatif</p>
                <p className="text-[10px] text-muted-foreground">Çarpanlar çarpılır</p>
              </div>
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2">
                <p className="text-muted-foreground">Cash Out</p>
                <p className="text-green-400 font-bold text-sm">Her an</p>
                <p className="text-[10px] text-muted-foreground">1+ doğru sonra</p>
              </div>
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2">
                <p className="text-muted-foreground">Yanlış</p>
                <p className="text-red-400 font-bold text-sm">0x</p>
                <p className="text-[10px] text-muted-foreground">Her şeyi kaybedersin</p>
              </div>
            </div>
          </div>

          {/* Commit Hash */}
          {commitHash && isPlaying && (
            <div className="flex items-center gap-2 mb-3 text-[10px] text-muted-foreground">
              <Shield className="w-3 h-3 text-green-500" />
              <span>Commit: {commitHash.slice(0, 12)}...</span>
            </div>
          )}

          {/* Multiplier Bar */}
          {isPlaying && correctGuesses > 0 && (
            <div className="flex items-center justify-between mb-4 p-3 bg-secondary/50 rounded-lg">
              <div>
                <p className="text-xs text-muted-foreground">Çarpan</p>
                <p className="text-lg font-bold text-green-400">{currentMultiplier.toFixed(2)}x</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Kazanç</p>
                <p className="text-lg font-bold text-yellow-400">
                  {formatAmount(parseFloat(stake) * currentMultiplier)}
                </p>
              </div>
              <Button onClick={handleCashOut} disabled={cashOutMut.isPending}
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold">
                <DollarSign className="w-4 h-4 mr-1" /> Cash Out
              </Button>
            </div>
          )}

          {/* Previous Cards */}
          {prevCards.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-2">Önceki Kartlar</p>
              <div className="flex gap-1.5 flex-wrap">
                {prevCards.map((c, i) => (
                  <CardDisplay key={i} card={c} size="normal" />
                ))}
              </div>
            </div>
          )}

          {/* Current Card */}
          {currentCard && (
            <div className="flex flex-col items-center my-6">
              <p className="text-xs text-muted-foreground mb-2">Mevcut Kart</p>
              <CardDisplay card={currentCard} size="large" />
              <p className="text-sm font-bold mt-2 text-foreground">
                {currentCard.rank} {SUIT_SYMBOLS[currentCard.suit]}
              </p>
            </div>
          )}

          {/* Guess Buttons */}
          {isPlaying && currentCard && (
            <div className="flex gap-3 justify-center mb-4">
              <Button
                onClick={() => handleGuess("higher")}
                disabled={guessMut.isPending || nextMultHigher === 0}
                className="flex-1 max-w-[160px] bg-green-600 hover:bg-green-700 text-white font-bold py-6"
              >
                <ChevronUp className="w-5 h-5 mr-1" />
                Yüksek
                {nextMultHigher > 0 && (
                  <span className="ml-1 text-xs opacity-80">{nextMultHigher.toFixed(2)}x</span>
                )}
              </Button>
              <Button
                onClick={() => handleGuess("lower")}
                disabled={guessMut.isPending || nextMultLower === 0}
                className="flex-1 max-w-[160px] bg-red-600 hover:bg-red-700 text-white font-bold py-6"
              >
                <ChevronDown className="w-5 h-5 mr-1" />
                Düşük
                {nextMultLower > 0 && (
                  <span className="ml-1 text-xs opacity-80">{nextMultLower.toFixed(2)}x</span>
                )}
              </Button>
            </div>
          )}

          {/* Game Over Result */}
          <AnimatePresence>
            {gameOver && lastResult && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`text-center mb-4 p-4 rounded-lg ${
                  lastResult.won
                    ? "bg-green-500/10 border border-green-500/30"
                    : "bg-red-500/10 border border-red-500/30"
                }`}
              >
                <p className="text-lg font-bold">
                  {lastResult.won ? "Kazandın!" : "Yanlış Tahmin!"}
                </p>
                <p className={`text-2xl font-bold mt-1 ${lastResult.won ? "text-green-400" : "text-red-400"}`}>
                  {lastResult.won
                    ? `${formatAmount(lastResult.payout, { showSign: true })} (${lastResult.multiplier.toFixed(2)}x)`
                    : `-${formatAmount(parseFloat(stake))}`}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

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
          {/* Stats */}
          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Doğru Tahmin</span>
              <span className="text-green-400 font-bold">{correctGuesses}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Çarpan</span>
              <span className="text-yellow-400 font-bold">{currentMultiplier.toFixed(2)}x</span>
            </div>
            {isPlaying && (
              <div className="flex justify-between text-muted-foreground">
                <span>Potansiyel</span>
                <span className="text-foreground font-bold">
                  {formatAmount(parseFloat(stake) * currentMultiplier)}
                </span>
              </div>
            )}
          </div>

          {/* Stake */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Bahis Tutarı</label>
            <div className="flex items-center gap-2">
              <Input type="number" value={stake} onChange={(e) => setStake(e.target.value)}
                className="bg-secondary border-border text-foreground text-sm" min={1} disabled={isPlaying} />
              <span className="text-muted-foreground text-xs">{currencySymbol}</span>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {quickStakes.map((qs) => (
                <button key={qs} onClick={() => setStake(String(qs))} disabled={isPlaying}
                  className="px-2.5 py-1.5 text-[11px] rounded bg-secondary text-foreground/80 hover:bg-accent transition-colors">{qs}</button>
              ))}
            </div>
          </div>

          {!isPlaying && !gameOver ? (
            <Button onClick={handleStart} disabled={startMut.isPending}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
              {startMut.isPending ? "Başlatılıyor..." : "Oyunu Başlat"}
            </Button>
          ) : gameOver ? (
            <Button onClick={handleNewGame}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
              Yeni Oyun
            </Button>
          ) : (
            <Button onClick={handleCashOut} disabled={correctGuesses === 0 || cashOutMut.isPending}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold">
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
          <li>• Bir kart gösterilir — sonraki kart yüksek mi düşük mü tahmin et</li>
          <li>• Doğru tahmin = çarpan artar (kümülatif)</li>
          <li>• İstediğin zaman Cash Out yap</li>
          <li>• Yanlış tahmin = tüm bahsini kaybedersin</li>
          <li>• Eşit kart = kayıp sayılır</li>
          <li>• Kartın değeri ne kadar uçtaysa (A veya K), o kadar riskli</li>
          <li>• <Shield className="w-3 h-3 inline text-green-500" /> Provably Fair — tüm sonuçlar doğrulanabilir</li>
        </ul>
      </div>
    </div>
  );
}
