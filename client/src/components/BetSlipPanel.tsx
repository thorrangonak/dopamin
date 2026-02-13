import { useBetSlip } from "@/contexts/BetSlipContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { X, Trash2, Ticket, Loader2, ChevronDown } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useCurrency } from "@/contexts/CurrencyContext";

function BetSlipContent({ onClose }: { onClose?: () => void }) {
  const { selections, removeSelection, clearSelections, totalOdds } = useBetSlip();
  const { isAuthenticated } = useAuth();
  const { formatAmount, currencySymbol } = useCurrency();
  const [stake, setStake] = useState("");
  const utils = trpc.useUtils();

  const placeBet = trpc.bets.place.useMutation({
    onSuccess: (data) => {
      toast.success(`Kupon oluşturuldu! Potansiyel kazanç: ${formatAmount(data.potentialWin)}`, { duration: 5000 });
      clearSelections();
      setStake("");
      utils.balance.get.invalidate();
      utils.bets.myBets.invalidate();
      onClose?.();
    },
    onError: (err) => {
      toast.error(err.message || "Kupon oluşturulamadı", { duration: 5000 });
    },
  });

  const stakeNum = parseFloat(stake) || 0;
  const potentialWin = stakeNum * totalOdds;

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Ticket className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-foreground">Kupon</span>
          {selections.length > 0 && (
            <span className="bg-primary text-primary-foreground text-xs font-bold px-1.5 py-0.5 rounded-full">
              {selections.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selections.length > 0 && (
            <button onClick={clearSelections} className="text-muted-foreground hover:text-destructive transition-colors">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          {onClose && (
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors xl:hidden">
              <ChevronDown className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Selections */}
      {selections.length === 0 ? (
        <div className="p-6 text-center">
          <p className="text-sm text-muted-foreground">Bahis eklemek için oranlara tıklayın</p>
        </div>
      ) : (
        <div className="max-h-60 xl:max-h-80 overflow-y-auto">
          {selections.map((sel) => (
            <div key={`${sel.eventId}-${sel.marketKey}-${sel.outcomeName}`} className="px-4 py-3 border-b border-border/30 hover:bg-accent/20 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground mb-0.5">
                    {sel.marketKey === "h2h" ? "Maç Sonucu" : sel.marketKey === "spreads" ? "Handikap" : "Alt/Üst"}
                  </div>
                  <div className="text-sm font-semibold text-foreground truncate">
                    {sel.outcomeName}
                    {sel.point !== undefined && ` (${sel.point > 0 ? "+" : ""}${sel.point})`}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {sel.homeTeam} vs {sel.awayTeam}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-primary">{sel.outcomePrice.toFixed(2)}</span>
                  <button onClick={() => removeSelection(sel.eventId, sel.marketKey, sel.outcomeName)} className="text-muted-foreground hover:text-destructive">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stake & Place */}
      {selections.length > 0 && (
        <div className="p-4 border-t border-border space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Toplam Oran</span>
            <span className="font-bold text-stake-blue">{totalOdds.toFixed(2)}</span>
          </div>

          <input
            type="number"
            placeholder={`Bahis tutarı (${currencySymbol})`}
            value={stake}
            onChange={e => setStake(e.target.value)}
            min="1"
            className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />

          <div className="flex gap-1.5">
            {[10, 25, 50, 100].map(v => (
              <button
                key={v}
                onClick={() => setStake(v.toString())}
                className="flex-1 py-1 text-xs border border-border rounded hover:border-primary/40 hover:text-primary transition-colors text-foreground bg-secondary"
              >
                {v}
              </button>
            ))}
          </div>

          {stakeNum > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Potansiyel Kazanç</span>
              <span className="font-bold text-primary">{formatAmount(potentialWin)}</span>
            </div>
          )}

          <Button
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
            disabled={!isAuthenticated || stakeNum < 1 || placeBet.isPending}
            onClick={() => {
              placeBet.mutate({
                type: selections.length > 1 ? "combo" : "single",
                stake: stakeNum,
                items: selections.map(s => ({
                  eventId: s.eventId,
                  sportKey: s.sportKey,
                  homeTeam: s.homeTeam,
                  awayTeam: s.awayTeam,
                  commenceTime: s.commenceTime,
                  marketKey: s.marketKey,
                  outcomeName: s.outcomeName,
                  outcomePrice: s.outcomePrice,
                  point: s.point,
                })),
              });
            }}
          >
            {placeBet.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Ticket className="h-4 w-4 mr-2" />}
            {!isAuthenticated ? "Giriş Yapın" : "Kupon Oluştur"}
          </Button>
        </div>
      )}
    </>
  );
}

export default function BetSlipPanel() {
  const { selections, isOpen } = useBetSlip();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (selections.length > 0) setMobileOpen(true);
  }, [selections.length]);

  return (
    <>
      {/* Desktop sidebar - rendered inside AppLayout */}
      <div className="w-72 shrink-0 hidden xl:block">
        {(selections.length > 0 || isOpen) && (
          <div className="sticky top-4">
            <div className="border border-border rounded-lg bg-card overflow-hidden">
              <BetSlipContent />
            </div>
          </div>
        )}
      </div>

      {/* Mobile FAB */}
      <AnimatePresence>
        {selections.length > 0 && !mobileOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            onClick={() => setMobileOpen(true)}
            className="xl:hidden fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg"
          >
            <Ticket className="h-6 w-6" />
            <span className="absolute -top-1 -right-1 bg-stake-blue text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {selections.length}
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Mobile bottom sheet */}
      <AnimatePresence>
        {mobileOpen && selections.length > 0 && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileOpen(false)}
              className="xl:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="xl:hidden fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] rounded-t-2xl bg-card border-t border-x border-border overflow-hidden"
            >
              <div className="flex justify-center py-2">
                <div className="w-10 h-1 rounded-full bg-border" />
              </div>
              <div className="overflow-y-auto max-h-[calc(85vh-2rem)]">
                <BetSlipContent onClose={() => setMobileOpen(false)} />
              </div>
              <div className="h-[env(safe-area-inset-bottom)]" />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
