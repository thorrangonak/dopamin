import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Spade, Shield } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Link } from "wouter";

type Card = { rank: string; suit: string; value: number };

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

const SUIT_COLORS: Record<string, string> = {
  hearts: "text-red-500",
  diamonds: "text-red-500",
  clubs: "text-foreground",
  spades: "text-foreground",
};

function CardDisplay({ card, hidden = false, delay = 0 }: { card: Card; hidden?: boolean; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20, rotateY: 180 }}
      animate={{ opacity: 1, y: 0, rotateY: 0 }}
      transition={{ duration: 0.4, delay }}
      className={`w-14 h-20 md:w-16 md:h-24 rounded-lg border-2 flex flex-col items-center justify-center text-sm font-bold shadow-md ${
        hidden
          ? "bg-primary/20 border-primary/50"
          : "bg-card border-border"
      }`}
    >
      {hidden ? (
        <span className="text-primary text-lg">?</span>
      ) : (
        <>
          <span className={`text-base md:text-lg font-bold ${SUIT_COLORS[card.suit]}`}>
            {card.rank}
          </span>
          <span className={`text-lg md:text-xl ${SUIT_COLORS[card.suit]}`}>
            {SUIT_SYMBOLS[card.suit]}
          </span>
        </>
      )}
    </motion.div>
  );
}

export default function Blackjack() {
  const { isAuthenticated } = useAuth();
  const { formatAmount, currencySymbol } = useCurrency();
  const [stake, setStake] = useState("10");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [playerCards, setPlayerCards] = useState<Card[]>([]);
  const [dealerCards, setDealerCards] = useState<Card[]>([]);
  const [playerTotal, setPlayerTotal] = useState(0);
  const [dealerTotal, setDealerTotal] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameResult, setGameResult] = useState<string | null>(null);
  const [multiplier, setMultiplier] = useState<number | null>(null);
  const [payout, setPayout] = useState<number | null>(null);
  const [dealing, setDealing] = useState(false);
  const [commitHash, setCommitHash] = useState<string | null>(null);
  const [fairness, setFairness] = useState<any>(null);
  const [hideHoleCard, setHideHoleCard] = useState(true);

  const balanceQ = trpc.balance.get.useQuery(undefined, { enabled: isAuthenticated });

  // Check for existing active session on mount
  const activeSessionQ = trpc.casino.getActiveBlackjackSession.useQuery(undefined, {
    enabled: isAuthenticated && !sessionId && !gameOver,
    refetchOnWindowFocus: false,
  });

  // Resume active session if exists
  useMemo(() => {
    if (activeSessionQ.data && !sessionId && !gameOver) {
      const s = activeSessionQ.data;
      setSessionId(s.sessionId);
      setPlayerCards(s.playerCards);
      setDealerCards(s.dealerCards);
      setPlayerTotal(s.playerTotal);
      setDealerTotal(s.dealerTotal);
      setCommitHash(s.commitHash);
      setHideHoleCard(true);
      setStake(String(s.stake));
    }
  }, [activeSessionQ.data]);

  const startMut = trpc.casino.startBlackjack.useMutation({
    onSuccess: (data) => {
      setDealing(false);
      setPlayerCards(data.playerCards);
      setDealerCards(data.dealerCards);
      setPlayerTotal(data.playerTotal);
      setDealerTotal(data.dealerTotal);
      setCommitHash(data.commitHash);
      setFairness(data.fairness);
      balanceQ.refetch();

      if (data.gameOver) {
        // Natural blackjack
        setGameOver(true);
        setGameResult(data.result);
        setMultiplier(data.multiplier);
        setPayout(data.payout!);
        setHideHoleCard(false);
        if (data.result === "blackjack") {
          toast.success(`Blackjack! ${formatAmount(data.payout!, { showSign: true })}`);
        } else if (data.result === "push") {
          toast.info("İkisi de Blackjack — Push!");
        } else {
          toast.error("Dealer Blackjack!");
        }
      } else {
        setSessionId(data.sessionId!);
        setGameOver(false);
        setGameResult(null);
        setHideHoleCard(true);
      }
    },
    onError: (err) => {
      setDealing(false);
      toast.error(err.message);
    },
  });

  const actionMut = trpc.casino.blackjackAction.useMutation({
    onSuccess: (data) => {
      setPlayerCards(data.playerCards);
      setDealerCards(data.dealerCards);
      setPlayerTotal(data.playerTotal);
      setDealerTotal(data.dealerTotal!);

      if (data.gameOver) {
        setGameOver(true);
        setGameResult(data.result);
        setMultiplier(data.multiplier);
        setPayout(data.payout!);
        setHideHoleCard(false);
        setSessionId(null);
        balanceQ.refetch();

        if (data.result === "win" || data.result === "blackjack") {
          toast.success(`Kazandın! ${formatAmount(data.payout!, { showSign: true })} (${data.multiplier}x)`);
        } else if (data.result === "push") {
          toast.info("Push — bahsin iade edildi.");
        } else {
          toast.error(data.playerTotal > 21 ? "Bust! Kaybettin." : "Dealer kazandı!");
        }
      } else {
        setHideHoleCard(true);
      }
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleDeal = () => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    const s = parseFloat(stake);
    if (isNaN(s) || s < 1) {
      toast.error(`Minimum bahis ${formatAmount(1)}`);
      return;
    }
    setDealing(true);
    setGameOver(false);
    setGameResult(null);
    setMultiplier(null);
    setPayout(null);
    setPlayerCards([]);
    setDealerCards([]);
    setCommitHash(null);
    setHideHoleCard(true);
    startMut.mutate({ stake: s });
  };

  const handleAction = (action: "hit" | "stand" | "double") => {
    if (!sessionId) return;
    actionMut.mutate({ sessionId, action });
  };

  const handleNewGame = () => {
    setSessionId(null);
    setGameOver(false);
    setGameResult(null);
    setPlayerCards([]);
    setDealerCards([]);
    setMultiplier(null);
    setPayout(null);
    setCommitHash(null);
    setHideHoleCard(true);
  };

  const isPlaying = sessionId !== null && !gameOver;
  const quickStakes = [5, 10, 25, 50, 100];

  const getResultBanner = () => {
    if (!gameResult) return null;
    const configs: Record<string, { label: string; color: string }> = {
      blackjack: { label: "BLACKJACK!", color: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400" },
      win: { label: "Kazandın!", color: "bg-green-500/10 border-green-500/30 text-green-400" },
      push: { label: "Push (Berabere)", color: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400" },
      loss: { label: "Kaybettin!", color: "bg-red-500/10 border-red-500/30 text-red-400" },
    };
    return configs[gameResult] || configs.loss;
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
          <Spade className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Blackjack</h1>
          <p className="text-sm text-muted-foreground">21'e en yakın ol — BJ=2.5x, Win=2x</p>
        </div>
      </div>

      {/* Game Table */}
      <div className="bg-card border border-border rounded-xl p-4 md:p-6">
        {/* Payout Table */}
        <div className="mb-4 p-3 bg-secondary/30 rounded-lg">
          <p className="text-xs font-semibold text-foreground/80 mb-2">Ödeme Tablosu</p>
          <div className="grid grid-cols-4 gap-2 text-xs text-center">
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2">
              <p className="text-muted-foreground">Blackjack</p>
              <p className="text-yellow-400 font-bold text-base">2.5x</p>
            </div>
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2">
              <p className="text-muted-foreground">Kazanç</p>
              <p className="text-green-400 font-bold text-base">2x</p>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2">
              <p className="text-muted-foreground">Push</p>
              <p className="text-blue-400 font-bold text-base">1x</p>
              <p className="text-[10px] text-muted-foreground">İade</p>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2">
              <p className="text-muted-foreground">Kayıp</p>
              <p className="text-red-400 font-bold text-base">0x</p>
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

        {/* Dealer Area */}
        {dealerCards.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-xs text-muted-foreground">Dealer</p>
              <span className="text-xs font-bold text-foreground bg-secondary px-2 py-0.5 rounded">
                {hideHoleCard && dealerCards.length === 1
                  ? dealerCards[0].value
                  : dealerTotal}
              </span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {dealerCards.map((card, i) => (
                <CardDisplay key={i} card={card} delay={i * 0.15} />
              ))}
              {hideHoleCard && !gameOver && (
                <CardDisplay
                  card={{ rank: "?", suit: "spades", value: 0 }}
                  hidden
                  delay={0.15}
                />
              )}
            </div>
          </div>
        )}

        {/* Divider */}
        {playerCards.length > 0 && (
          <div className="border-t border-dashed border-border/50 my-4" />
        )}

        {/* Player Area */}
        {playerCards.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-xs text-muted-foreground">Sen</p>
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                playerTotal > 21
                  ? "bg-red-500/20 text-red-400"
                  : playerTotal === 21
                  ? "bg-green-500/20 text-green-400"
                  : "bg-secondary text-foreground"
              }`}>
                {playerTotal}
              </span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {playerCards.map((card, i) => (
                <CardDisplay key={i} card={card} delay={i * 0.15} />
              ))}
            </div>
          </div>
        )}

        {/* Result */}
        <AnimatePresence>
          {gameOver && gameResult && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`text-center mb-4 p-4 rounded-lg border ${getResultBanner()?.color}`}
            >
              <p className="text-lg font-bold">{getResultBanner()?.label}</p>
              {payout !== null && (
                <p className="text-2xl font-bold mt-1">
                  {multiplier! > 1
                    ? formatAmount(payout, { showSign: true })
                    : multiplier === 1
                    ? "İade"
                    : `-${formatAmount(parseFloat(stake))}`}
                  {multiplier! > 0 && ` (${multiplier}x)`}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Provably Fair Badge */}
        {gameOver && fairness && (
          <div className="flex items-center justify-center gap-2 mb-4 text-xs text-muted-foreground">
            <Shield className="w-3.5 h-3.5 text-green-500" />
            <span>Seed: {fairness.serverSeedHash.slice(0, 8)}... | Nonce: {fairness.nonce}</span>
            <Link href="/provably-fair" className="text-green-500 hover:underline">Doğrula</Link>
          </div>
        )}

        {/* Action Buttons */}
        {isPlaying && (
          <div className="flex gap-2 mb-4">
            <Button
              onClick={() => handleAction("hit")}
              disabled={actionMut.isPending}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold"
            >
              Hit
            </Button>
            <Button
              onClick={() => handleAction("stand")}
              disabled={actionMut.isPending}
              className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-black font-bold"
            >
              Stand
            </Button>
            <Button
              onClick={() => handleAction("double")}
              disabled={actionMut.isPending || playerCards.length !== 2}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold"
            >
              Double
            </Button>
          </div>
        )}

        {/* Controls */}
        <div className="max-w-xs mx-auto space-y-3">
          {!isPlaying && (
            <>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={stake}
                  onChange={(e) => setStake(e.target.value)}
                  className="bg-secondary border-border text-foreground"
                  min={1}
                  disabled={dealing}
                />
                <span className="text-muted-foreground text-sm">{currencySymbol}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {quickStakes.map((qs) => (
                  <button
                    key={qs}
                    onClick={() => setStake(String(qs))}
                    disabled={dealing}
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
                  disabled={dealing}
                  className="px-3 py-1 text-xs rounded bg-secondary text-foreground/80 hover:bg-accent transition-colors"
                >
                  1/2
                </button>
                <button
                  onClick={() => {
                    const max = balanceQ.data ? parseFloat(balanceQ.data.amount).toFixed(0) : "0";
                    setStake(max);
                  }}
                  disabled={dealing}
                  className="px-3 py-1 text-xs rounded bg-secondary text-foreground/80 hover:bg-accent transition-colors"
                >
                  Max
                </button>
              </div>
            </>
          )}

          {!isPlaying && !gameOver && (
            <Button
              onClick={handleDeal}
              disabled={dealing}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3"
            >
              {dealing ? "Dağıtılıyor..." : `Dağıt (${formatAmount(parseFloat(stake || "0"))})`}
            </Button>
          )}

          {gameOver && (
            <Button
              onClick={handleNewGame}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3"
            >
              Yeni El
            </Button>
          )}

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
          <li>• 21'e en yakın eli oluştur — ama 21'i geçme!</li>
          <li>• Blackjack (A + 10/J/Q/K) = 2.5x çarpan</li>
          <li>• Normal kazanç = 2x çarpan</li>
          <li>• Push (berabere) = bahis iade</li>
          <li>• Hit: kart al, Stand: dur, Double: bahsi ikiye katla + 1 kart</li>
          <li>• Dealer 17 ve üzerinde durur</li>
          <li>• <Shield className="w-3 h-3 inline text-green-500" /> Provably Fair — tüm sonuçlar doğrulanabilir</li>
        </ul>
      </div>
    </div>
  );
}
