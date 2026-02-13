import { useState, useRef, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Triangle, Shield } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Link } from "wouter";

// Client-side multiplier tables (must match server's PLINKO_MULTIPLIER_TABLES)
const MULTIPLIER_TABLES: Record<string, Record<number, number[]>> = {
  low: {
    8: [5.6, 2.1, 1.1, 1.0, 0.5, 1.0, 1.1, 2.1, 5.6],
    9: [5.6, 2.0, 1.6, 1.0, 0.7, 0.7, 1.0, 1.6, 2.0, 5.6],
    10: [8.9, 3.0, 1.4, 1.1, 1.0, 0.5, 1.0, 1.1, 1.4, 3.0, 8.9],
    11: [8.4, 3.0, 1.9, 1.3, 1.0, 0.7, 0.7, 1.0, 1.3, 1.9, 3.0, 8.4],
    12: [10, 3.0, 1.6, 1.4, 1.1, 1.0, 0.5, 1.0, 1.1, 1.4, 1.6, 3.0, 10],
    13: [8.1, 4.0, 3.0, 1.9, 1.2, 0.9, 0.7, 0.7, 0.9, 1.2, 1.9, 3.0, 4.0, 8.1],
    14: [7.1, 4.0, 1.9, 1.4, 1.3, 1.1, 1.0, 0.5, 1.0, 1.1, 1.3, 1.4, 1.9, 4.0, 7.1],
    15: [15, 8.0, 3.0, 2.0, 1.5, 1.1, 1.0, 0.7, 0.7, 1.0, 1.1, 1.5, 2.0, 3.0, 8.0, 15],
    16: [16, 9.0, 2.0, 1.4, 1.4, 1.2, 1.1, 1.0, 0.5, 1.0, 1.1, 1.2, 1.4, 1.4, 2.0, 9.0, 16],
  },
  medium: {
    8: [13, 3.0, 1.3, 0.7, 0.4, 0.7, 1.3, 3.0, 13],
    9: [18, 4.0, 1.7, 0.9, 0.5, 0.5, 0.9, 1.7, 4.0, 18],
    10: [22, 5.0, 2.0, 1.4, 0.6, 0.4, 0.6, 1.4, 2.0, 5.0, 22],
    11: [24, 6.0, 3.0, 1.8, 0.7, 0.5, 0.5, 0.7, 1.8, 3.0, 6.0, 24],
    12: [33, 11, 4.0, 2.0, 1.1, 0.6, 0.3, 0.6, 1.1, 2.0, 4.0, 11, 33],
    13: [43, 13, 6.0, 3.0, 1.3, 0.7, 0.4, 0.4, 0.7, 1.3, 3.0, 6.0, 13, 43],
    14: [58, 15, 7.0, 4.0, 1.9, 1.0, 0.5, 0.2, 0.5, 1.0, 1.9, 4.0, 7.0, 15, 58],
    15: [88, 18, 11, 5.0, 3.0, 1.3, 0.5, 0.3, 0.3, 0.5, 1.3, 3.0, 5.0, 11, 18, 88],
    16: [110, 41, 10, 5.0, 3.0, 1.5, 1.0, 0.5, 0.3, 0.5, 1.0, 1.5, 3.0, 5.0, 10, 41, 110],
  },
  high: {
    8: [29, 4.0, 1.5, 0.3, 0.2, 0.3, 1.5, 4.0, 29],
    9: [43, 7.0, 2.0, 0.6, 0.2, 0.2, 0.6, 2.0, 7.0, 43],
    10: [76, 10, 3.0, 0.9, 0.3, 0.2, 0.3, 0.9, 3.0, 10, 76],
    11: [120, 14, 5.2, 1.4, 0.4, 0.2, 0.2, 0.4, 1.4, 5.2, 14, 120],
    12: [170, 24, 8.1, 2.0, 0.7, 0.2, 0.2, 0.2, 0.7, 2.0, 8.1, 24, 170],
    13: [260, 37, 11, 4.0, 1.0, 0.2, 0.2, 0.2, 0.2, 1.0, 4.0, 11, 37, 260],
    14: [420, 56, 18, 5.0, 1.9, 0.3, 0.2, 0.2, 0.2, 0.3, 1.9, 5.0, 18, 56, 420],
    15: [620, 83, 27, 8.0, 3.0, 0.5, 0.2, 0.2, 0.2, 0.2, 0.5, 3.0, 8.0, 27, 83, 620],
    16: [1000, 130, 26, 9.0, 4.0, 2.0, 0.2, 0.2, 0.2, 0.2, 0.2, 2.0, 4.0, 9.0, 26, 130, 1000],
  },
};

function formatMultiplier(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  if (n >= 100) return String(Math.round(n));
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}

function getSlotColor(slotIndex: number, totalSlots: number): string {
  const center = (totalSlots - 1) / 2;
  const dist = Math.abs(slotIndex - center) / center; // 0 = center, 1 = edge
  if (dist > 0.75) return "from-red-600 to-red-500";
  if (dist > 0.55) return "from-orange-600 to-orange-500";
  if (dist > 0.35) return "from-yellow-600 to-yellow-500";
  if (dist > 0.15) return "from-lime-600 to-lime-500";
  return "from-green-600 to-green-500";
}

function getSlotGlow(slotIndex: number, totalSlots: number): string {
  const center = (totalSlots - 1) / 2;
  const dist = Math.abs(slotIndex - center) / center;
  if (dist > 0.75) return "shadow-red-500/40";
  if (dist > 0.55) return "shadow-orange-500/40";
  if (dist > 0.35) return "shadow-yellow-500/40";
  if (dist > 0.15) return "shadow-lime-500/40";
  return "shadow-green-500/40";
}

// Generate ball path in SVG viewBox coordinates (matches pin layout exactly)
function generateBallPath(
  rows: number,
  targetSlot: number,
): { cx: number; cy: number }[] {
  const totalSlots = rows + 1;
  const spacing = 84 / totalSlots;

  // Work backwards from target slot to determine path
  const positions: number[] = new Array(rows + 1);
  positions[rows] = targetSlot;

  for (let row = rows - 1; row >= 0; row--) {
    const pos = positions[row + 1];
    const maxPos = row + 1;
    const canStay = pos <= maxPos;
    const canDown = pos - 1 >= 0;

    if (canStay && canDown) {
      positions[row] = Math.random() > 0.5 ? pos : pos - 1;
    } else if (canStay) {
      positions[row] = pos;
    } else {
      positions[row] = pos - 1;
    }
  }

  // Convert positions to SVG viewBox coordinates
  const path: { cx: number; cy: number }[] = [];

  // Start at top center
  path.push({ cx: 50, cy: 1 });

  for (let row = 0; row < rows; row++) {
    const pos = positions[row + 1]; // position after passing this row
    const pinsInRow = row + 3;
    const startX = 8 + (84 - (pinsInRow - 1) * spacing) / 2;
    // Ball sits in gap between pin[pos] and pin[pos+1]
    const x = startX + (pos + 0.5) * spacing;
    const y = (row + 1) * 6 + 2;
    const wobble = (Math.random() - 0.5) * spacing * 0.25;
    path.push({ cx: Math.max(4, Math.min(96, x + wobble)), cy: y });
  }

  // Final landing aligned with multiplier slot
  const finalX = 8 + (targetSlot + 0.5) * spacing;
  path.push({ cx: finalX, cy: rows * 6 + 5 });

  return path;
}

export default function Plinko() {
  const { isAuthenticated } = useAuth();
  const { formatAmount, currencySymbol } = useCurrency();
  const [stake, setStake] = useState("10");
  const [risk, setRisk] = useState<"low" | "medium" | "high">("medium");
  const [rows, setRows] = useState(10);
  const [dropping, setDropping] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [ballPath, setBallPath] = useState<{ cx: number; cy: number }[]>([]);
  const [landedSlot, setLandedSlot] = useState<number | null>(null);
  const animRef = useRef(0);
  const boardRef = useRef<HTMLDivElement>(null);

  const SLOTS = rows + 1;
  const MULTIPLIERS = result?.details?.multipliers || [];

  const balanceQ = trpc.balance.get.useQuery(undefined, { enabled: isAuthenticated });
  const playMut = trpc.casino.playPlinko.useMutation({
    onSuccess: (data) => {
      const targetSlot = data.details.slot ?? data.details.bucketIndex ?? Math.floor(SLOTS / 2);
      const path = generateBallPath(rows, targetSlot);

      setBallPath(path);
      setLandedSlot(null); // Don't reveal landing slot until animation ends
      animRef.current++;

      const animDuration = 1800 + (rows - 8) * 250; // 1.8s for 8 rows, 3.8s for 16 rows

      setTimeout(() => {
        setLandedSlot(targetSlot);
        setResult(data);
        setDropping(false);
        balanceQ.refetch();
        if (data.result === "win") {
          toast.success(`Kazandın! ${formatAmount(data.payout, { showSign: true })} (${data.multiplier}x)`);
        } else {
          toast.error(`${data.multiplier}x - ${formatAmount(data.payout)}`);
        }
      }, animDuration + 200);
    },
    onError: (err) => {
      setDropping(false);
      toast.error(err.message);
    },
  });

  const handlePlay = useCallback(() => {
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
    playMut.mutate({ stake: s, risk, rows });
  }, [isAuthenticated, stake, risk, rows, formatAmount, playMut]);

  const quickStakes = [5, 10, 25, 50, 100, 250];
  const rowOptions = [8, 9, 10, 11, 12, 13, 14, 15, 16];

  const displayMultipliers = useMemo(
    () => MULTIPLIERS.length > 0 ? MULTIPLIERS : (MULTIPLIER_TABLES[risk]?.[rows] || []),
    [MULTIPLIERS, risk, rows],
  );

  // Board layout calculations
  const boardPadding = 12; // px padding inside board
  const slotHeight = SLOTS > 14 ? 28 : 34;
  const pinSize = SLOTS > 14 ? 5 : 6;

  // Animation duration scales with rows
  const animDuration = (1800 + (rows - 8) * 250) / 1000;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
          <Triangle className="w-5 h-5 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Plinko</h1>
          <p className="text-sm text-muted-foreground">Topu bırak, çarpana güven!</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 md:p-6">
        {/* Risk & Rows */}
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Risk Seviyesi</label>
            <div className="flex gap-1.5">
              {(["low", "medium", "high"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => !dropping && setRisk(r)}
                  disabled={dropping}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                    risk === r
                      ? r === "low" ? "bg-green-500 text-black" : r === "medium" ? "bg-yellow-500 text-black" : "bg-red-500 text-white"
                      : "bg-secondary text-foreground/80 hover:bg-accent"
                  }`}
                >
                  {r === "low" ? "Düşük" : r === "medium" ? "Orta" : "Yüksek"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Satır Sayısı</label>
            <div className="flex flex-wrap gap-1">
              {rowOptions.map((r) => (
                <button
                  key={r}
                  onClick={() => !dropping && setRows(r)}
                  disabled={dropping}
                  className={`px-2.5 py-1.5 text-[11px] rounded transition-colors ${
                    rows === r ? "bg-cyan-500 text-black font-bold" : "bg-secondary text-foreground/80 hover:bg-accent"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Plinko Board — Full width, responsive */}
        <div className="mb-5">
          <div
            ref={boardRef}
            className="relative w-full bg-secondary/60 rounded-2xl overflow-hidden"
            style={{ paddingTop: boardPadding, paddingBottom: slotHeight + 4 }}
          >
            {/* SVG for pins — uses viewBox so it scales to any width */}
            <svg
              viewBox={`0 0 100 ${rows * 6 + 6}`}
              className="w-full"
              style={{ display: "block" }}
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                <filter id="ball-glow">
                  <feGaussianBlur stdDeviation="1.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Pins */}
              {Array.from({ length: rows }, (_, rowIdx) => {
                const pinsInRow = rowIdx + 3;
                const rowY = (rowIdx + 1) * 6;
                return Array.from({ length: pinsInRow }, (_, pinIdx) => {
                  const totalWidth = 84;
                  const startX = 8 + (totalWidth - (pinsInRow - 1) * (totalWidth / (rows + 1))) / 2;
                  const spacing = totalWidth / (rows + 1);
                  const pinX = startX + pinIdx * spacing;
                  return (
                    <circle
                      key={`${rowIdx}-${pinIdx}`}
                      cx={pinX}
                      cy={rowY}
                      r={pinSize / 6}
                      className="fill-muted-foreground/60"
                    />
                  );
                });
              })}

              {/* Ball — inside SVG, same coordinate system as pins */}
              {ballPath.length > 1 && dropping && (
                <motion.circle
                  key={animRef.current}
                  r={1.8}
                  fill="#facc15"
                  filter="url(#ball-glow)"
                  initial={{ cx: ballPath[0].cx, cy: ballPath[0].cy }}
                  animate={{
                    cx: ballPath.map(p => p.cx),
                    cy: ballPath.map(p => p.cy),
                  }}
                  transition={{
                    duration: animDuration,
                    ease: [0.25, 0.1, 0.25, 1],
                    times: ballPath.map((_, i) => i / (ballPath.length - 1)),
                  }}
                />
              )}
            </svg>

            {/* Multiplier Slots — at the bottom */}
            <div
              className="absolute bottom-0 left-0 right-0 flex gap-[2px] px-[6px] md:px-2"
              style={{ height: slotHeight }}
            >
              {displayMultipliers.map((mult: number, i: number) => {
                const isLanded = landedSlot === i;
                const color = getSlotColor(i, SLOTS);
                const glow = getSlotGlow(i, SLOTS);
                return (
                  <div
                    key={i}
                    className={`flex-1 min-w-0 rounded-b-lg flex items-center justify-center font-bold text-white bg-gradient-to-b transition-all duration-300 ${color} ${
                      isLanded
                        ? `scale-110 z-10 shadow-lg ${glow} ring-2 ring-yellow-400 brightness-125`
                        : "opacity-60 hover:opacity-80"
                    }`}
                    style={{
                      fontSize: SLOTS > 14 ? "7px" : SLOTS > 11 ? "8px" : "10px",
                    }}
                  >
                    <span className="truncate px-[1px]">
                      {formatMultiplier(mult)}x
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Result */}
        <AnimatePresence>
          {result && !dropping && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`text-center mb-4 p-3 rounded-lg ${
                result.multiplier >= 1.4
                  ? "bg-green-500/10 border border-green-500/30"
                  : result.multiplier >= 1.0
                  ? "bg-yellow-500/10 border border-yellow-500/30"
                  : "bg-red-500/10 border border-red-500/30"
              }`}
            >
              <p className="text-sm text-foreground/80">
                Slot: {(landedSlot ?? 0) + 1} | Çarpan: <span className="font-bold">{result.multiplier}x</span>
              </p>
              <p className={`text-xl font-bold mt-1 ${result.result === "win" ? "text-green-400" : "text-red-400"}`}>
                {result.result === "win" ? formatAmount(result.payout, { showSign: true }) : formatAmount(result.payout)}
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

        {/* Stake & Play */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              className="bg-secondary border-border text-foreground"
              min={1}
              disabled={dropping}
            />
            <span className="text-muted-foreground text-sm">{currencySymbol}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {quickStakes.map((qs) => (
              <button
                key={qs}
                onClick={() => setStake(String(qs))}
                disabled={dropping}
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
              disabled={dropping}
              className="px-3 py-1 text-xs rounded bg-secondary text-foreground/80 hover:bg-accent transition-colors"
            >
              1/2
            </button>
            <button
              onClick={() => {
                const max = balanceQ.data ? parseFloat(balanceQ.data.amount).toFixed(0) : "0";
                setStake(max);
              }}
              disabled={dropping}
              className="px-3 py-1 text-xs rounded bg-secondary text-foreground/80 hover:bg-accent transition-colors"
            >
              Max
            </button>
          </div>

          <Button
            onClick={handlePlay}
            disabled={dropping}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3"
          >
            {dropping ? "Top Düşüyor..." : `Topu Bırak (${formatAmount(parseFloat(stake || "0"))})`}
          </Button>

          {isAuthenticated && balanceQ.data && (
            <p className="text-center text-xs text-muted-foreground">
              Bakiye: {formatAmount(balanceQ.data.amount)}
            </p>
          )}
        </div>
      </div>

      <div className="bg-card/50 border border-border/50 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-foreground/80 mb-2">Nasıl Oynanır?</h3>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>• Risk seviyesi ve satır sayısını seçin</li>
          <li>• Bahis tutarınızı girin ve topu bırakın</li>
          <li>• Top pimlere çarparak aşağı düşer</li>
          <li>• Düştüğü slot'un çarpanı kazancınızı belirler</li>
          <li>• Yüksek risk = daha büyük kazanç potansiyeli ama daha düşük olasılık</li>
          <li>• <Shield className="w-3 h-3 inline text-green-500" /> Provably Fair — tüm sonuçlar doğrulanabilir</li>
        </ul>
      </div>
    </div>
  );
}
