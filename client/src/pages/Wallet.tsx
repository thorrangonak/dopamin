import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Wallet as WalletIcon, ArrowDownCircle, ArrowUpCircle, Loader2,
  History, Copy, Check, ChevronRight, ChevronLeft, AlertTriangle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import { format } from "date-fns";
import { useCurrency } from "@/contexts/CurrencyContext";

/* ─── Supported Cryptos ─── */
const CRYPTOS = [
  { id: "btc", name: "Bitcoin", symbol: "BTC", network: "Bitcoin", minDeposit: "0.001 BTC", icon: "₿", color: "text-orange-500", bg: "bg-orange-500/10", address: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh" },
  { id: "eth", name: "Ethereum", symbol: "ETH", network: "ERC-20", minDeposit: "0.01 ETH", icon: "Ξ", color: "text-blue-400", bg: "bg-blue-400/10", address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F" },
  { id: "usdt-trc", name: "Tether", symbol: "USDT", network: "TRC-20", minDeposit: "10 USDT", icon: "₮", color: "text-emerald-500", bg: "bg-emerald-500/10", address: "TJYuH4X8r9MwDFtMhKR5KBh81ggZMPFLnR" },
  { id: "usdt-erc", name: "Tether", symbol: "USDT", network: "ERC-20", minDeposit: "50 USDT", icon: "₮", color: "text-emerald-500", bg: "bg-emerald-500/10", address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F" },
  { id: "sol", name: "Solana", symbol: "SOL", network: "Solana", minDeposit: "0.5 SOL", icon: "◎", color: "text-purple-400", bg: "bg-purple-400/10", address: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU" },
  { id: "bnb", name: "BNB", symbol: "BNB", network: "BEP-20", minDeposit: "0.05 BNB", icon: "◆", color: "text-yellow-500", bg: "bg-yellow-500/10", address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E" },
] as const;

type Crypto = (typeof CRYPTOS)[number];

export default function Wallet() {
  const { isAuthenticated, loading } = useAuth();
  const { formatAmount } = useCurrency();
  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");

  // Deposit wizard state
  const [depositStep, setDepositStep] = useState<1 | 2 | 3>(1);
  const [selectedCrypto, setSelectedCrypto] = useState<Crypto | null>(null);
  const [copied, setCopied] = useState(false);

  // Withdraw state
  const [withdrawCrypto, setWithdrawCrypto] = useState<Crypto>(CRYPTOS[0]);
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const utils = trpc.useUtils();
  const balanceQuery = trpc.balance.get.useQuery(undefined, { enabled: isAuthenticated });
  const txQuery = trpc.balance.transactions.useQuery(undefined, { enabled: isAuthenticated });

  const depositMut = trpc.balance.deposit.useMutation({
    onSuccess: () => {
      toast.success("500 USDT yatırma işlemi onaylandı!");
      setDepositStep(1);
      setSelectedCrypto(null);
      utils.balance.get.invalidate();
      utils.balance.transactions.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const withdrawMut = trpc.balance.withdraw.useMutation({
    onSuccess: () => {
      toast.success("Çekim talebi oluşturuldu!");
      setWithdrawAddress("");
      setWithdrawAmount("");
      utils.balance.get.invalidate();
      utils.balance.transactions.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-20 p-4">
        <WalletIcon className="h-10 w-10 text-muted-foreground mb-4" />
        <h2 className="text-lg font-bold mb-2 text-foreground">Giriş Gerekli</h2>
        <p className="text-muted-foreground text-sm mb-4">Cüzdan özelliğini kullanmak için giriş yapın.</p>
        <Button onClick={() => { window.location.href = getLoginUrl(); }} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">Giriş Yap</Button>
      </div>
    );
  }

  const isPending = depositMut.isPending || withdrawMut.isPending;

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopied(true);
    toast.success("Adres kopyalandı!");
    setTimeout(() => setCopied(false), 2000);
  };

  const txTypeLabels: Record<string, { label: string; color: string }> = {
    deposit: { label: "Yatırma", color: "text-primary" },
    withdraw: { label: "Çekme", color: "text-destructive" },
    bet_place: { label: "Bahis", color: "text-stake-blue" },
    bet_win: { label: "Kazanç", color: "text-primary" },
    bet_refund: { label: "İade", color: "text-stake-blue" },
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      {/* Balance Card */}
      <div className="bg-card border border-border rounded-lg p-6 mb-6">
        <div className="text-xs text-muted-foreground uppercase mb-2 font-medium">Toplam Bakiye</div>
        <div className="text-3xl font-bold text-primary mb-4">
          {balanceQuery.isLoading ? "..." : formatAmount(balanceQuery.data?.amount || "0")}
        </div>

        {/* Mode tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => { setMode("deposit"); setDepositStep(1); setSelectedCrypto(null); }}
            className={`flex-1 py-2 rounded-md font-semibold text-sm transition-colors ${
              mode === "deposit" ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"
            }`}
          >
            <ArrowDownCircle className="h-4 w-4 inline mr-1" /> Yatır
          </button>
          <button
            onClick={() => setMode("withdraw")}
            className={`flex-1 py-2 rounded-md font-semibold text-sm transition-colors ${
              mode === "withdraw" ? "bg-destructive/15 text-destructive" : "bg-secondary text-muted-foreground"
            }`}
          >
            <ArrowUpCircle className="h-4 w-4 inline mr-1" /> Çek
          </button>
        </div>

        {/* ─── DEPOSIT WIZARD ─── */}
        {mode === "deposit" && (
          <div>
            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground">
              <span className={depositStep >= 1 ? "text-primary font-semibold" : ""}>1. Kripto Seç</span>
              <ChevronRight className="h-3 w-3" />
              <span className={depositStep >= 2 ? "text-primary font-semibold" : ""}>2. Adres</span>
              <ChevronRight className="h-3 w-3" />
              <span className={depositStep >= 3 ? "text-primary font-semibold" : ""}>3. Onayla</span>
            </div>

            {/* Step 1: Select Crypto */}
            {depositStep === 1 && (
              <div className="grid grid-cols-2 gap-2">
                {CRYPTOS.map((crypto) => (
                  <button
                    key={crypto.id}
                    onClick={() => { setSelectedCrypto(crypto); setDepositStep(2); }}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border bg-secondary hover:border-primary/50 hover:bg-primary/5 transition-all text-left"
                  >
                    <div className={`w-10 h-10 rounded-full ${crypto.bg} flex items-center justify-center text-lg font-bold ${crypto.color}`}>
                      {crypto.icon}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-foreground">{crypto.symbol}</div>
                      <div className="text-[11px] text-muted-foreground">{crypto.network}</div>
                      <div className="text-[10px] text-muted-foreground">Min: {crypto.minDeposit}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Step 2: Show Address */}
            {depositStep === 2 && selectedCrypto && (
              <div className="space-y-4">
                <button
                  onClick={() => { setDepositStep(1); setSelectedCrypto(null); }}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronLeft className="h-3 w-3" /> Geri
                </button>

                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-full ${selectedCrypto.bg} flex items-center justify-center text-lg font-bold ${selectedCrypto.color}`}>
                    {selectedCrypto.icon}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{selectedCrypto.name} ({selectedCrypto.symbol})</div>
                    <div className="text-xs text-muted-foreground">Ağ: {selectedCrypto.network}</div>
                  </div>
                </div>

                {/* QR Placeholder */}
                <div className="flex justify-center">
                  <div className="w-40 h-40 border-2 border-dashed border-border rounded-lg flex items-center justify-center bg-secondary">
                    <svg width="120" height="120" viewBox="0 0 120 120" className="text-muted-foreground/30">
                      <rect x="10" y="10" width="30" height="30" fill="currentColor" />
                      <rect x="80" y="10" width="30" height="30" fill="currentColor" />
                      <rect x="10" y="80" width="30" height="30" fill="currentColor" />
                      <rect x="50" y="10" width="10" height="10" fill="currentColor" />
                      <rect x="50" y="30" width="10" height="10" fill="currentColor" />
                      <rect x="50" y="50" width="20" height="20" fill="currentColor" />
                      <rect x="80" y="50" width="10" height="10" fill="currentColor" />
                      <rect x="100" y="50" width="10" height="10" fill="currentColor" />
                      <rect x="80" y="80" width="30" height="10" fill="currentColor" />
                      <rect x="80" y="100" width="10" height="10" fill="currentColor" />
                      <rect x="100" y="100" width="10" height="10" fill="currentColor" />
                    </svg>
                  </div>
                </div>

                {/* Address */}
                <div className="bg-secondary border border-border rounded-lg p-3">
                  <div className="text-[11px] text-muted-foreground mb-1 font-medium">Yatırım Adresi</div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs text-foreground break-all font-mono">{selectedCrypto.address}</code>
                    <button
                      onClick={() => copyAddress(selectedCrypto.address)}
                      className="p-1.5 rounded-md hover:bg-accent transition-colors shrink-0"
                    >
                      {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                    </button>
                  </div>
                </div>

                {/* Warning */}
                <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-yellow-200">
                    <span className="font-semibold">Minimum yatırım:</span> {selectedCrypto.minDeposit}<br />
                    Sadece <span className="font-semibold">{selectedCrypto.network}</span> ağı üzerinden gönderim yapın. Yanlış ağ seçimi durumunda varlıklarınız kaybolabilir.
                  </div>
                </div>

                <Button
                  onClick={() => setDepositStep(3)}
                  className="w-full dp-gradient-bg hover:opacity-90 text-white font-semibold dp-glow-sm"
                >
                  Transferi Gönderdim
                </Button>
              </div>
            )}

            {/* Step 3: Confirm */}
            {depositStep === 3 && selectedCrypto && (
              <div className="space-y-4">
                <div className="text-center py-4">
                  <div className={`w-16 h-16 rounded-full ${selectedCrypto.bg} flex items-center justify-center text-2xl font-bold ${selectedCrypto.color} mx-auto mb-3`}>
                    {selectedCrypto.icon}
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-1">Transfer Onayı</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedCrypto.symbol} transferiniz onaylanıyor...
                  </p>
                </div>

                <div className="bg-secondary border border-border rounded-lg p-3 text-sm">
                  <div className="flex justify-between mb-1">
                    <span className="text-muted-foreground">Kripto</span>
                    <span className="text-foreground font-semibold">{selectedCrypto.symbol} ({selectedCrypto.network})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Eklenecek Tutar</span>
                    <span className="text-primary font-bold">500.00 USDT</span>
                  </div>
                </div>

                <Button
                  onClick={() => depositMut.mutate({ amount: 500 })}
                  disabled={isPending}
                  className="w-full dp-gradient-bg hover:opacity-90 text-white font-semibold dp-glow-sm"
                >
                  {isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  Yatırımı Onayla
                </Button>

                <button
                  onClick={() => setDepositStep(2)}
                  className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Geri Dön
                </button>
              </div>
            )}
          </div>
        )}

        {/* ─── WITHDRAW ─── */}
        {mode === "withdraw" && (
          <div className="space-y-3">
            {/* Crypto select */}
            <div>
              <label className="block text-xs text-muted-foreground mb-1 font-medium">Kripto Seçin</label>
              <select
                value={withdrawCrypto.id}
                onChange={(e) => setWithdrawCrypto(CRYPTOS.find((c) => c.id === e.target.value) || CRYPTOS[0])}
                className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {CRYPTOS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.symbol} ({c.network})
                  </option>
                ))}
              </select>
            </div>

            {/* Wallet address */}
            <div>
              <label className="block text-xs text-muted-foreground mb-1 font-medium">Cüzdan Adresi</label>
              <input
                type="text"
                value={withdrawAddress}
                onChange={(e) => setWithdrawAddress(e.target.value)}
                placeholder="Cüzdan adresinizi girin"
                className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs text-muted-foreground mb-1 font-medium">Tutar (USDT)</label>
              <input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="0.00"
                min="1"
                className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex gap-1.5">
              {[25, 50, 100, 250, 500].map((v) => (
                <button
                  key={v}
                  onClick={() => setWithdrawAmount(v.toString())}
                  className="flex-1 py-1 text-xs border border-border rounded hover:border-primary/40 hover:text-primary transition-colors text-foreground bg-secondary"
                >
                  {v}
                </button>
              ))}
            </div>

            <Button
              disabled={!withdrawAddress || (parseFloat(withdrawAmount) || 0) < 1 || isPending}
              onClick={() => {
                withdrawMut.mutate({ amount: parseFloat(withdrawAmount) || 0 });
              }}
              className="w-full bg-destructive hover:bg-destructive/90 text-white font-bold"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Çekimi Onayla
            </Button>
          </div>
        )}
      </div>

      {/* Transactions */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <History className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">İşlem Geçmişi</span>
        </div>
        {txQuery.isLoading ? (
          <div className="p-6 text-center"><Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" /></div>
        ) : !txQuery.data?.length ? (
          <div className="p-6 text-center text-muted-foreground text-sm">Henüz işlem yok</div>
        ) : (
          <div className="divide-y divide-border/50">
            {txQuery.data.map((tx: any) => {
              const info = txTypeLabels[tx.type] || { label: tx.type, color: "text-foreground" };
              return (
                <div key={tx.id} className="flex items-center justify-between px-4 py-3 hover:bg-accent/20 transition-colors">
                  <div>
                    <div className={`text-sm font-semibold ${info.color}`}>{info.label}</div>
                    <div className="text-xs text-muted-foreground">{tx.description || "-"}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-bold ${
                      tx.type === "deposit" || tx.type === "bet_win" || tx.type === "bet_refund" ? "text-primary" : "text-destructive"
                    }`}>
                      {tx.type === "deposit" || tx.type === "bet_win" || tx.type === "bet_refund" ? "+" : "-"}{formatAmount(parseFloat(tx.amount))}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {format(new Date(tx.createdAt), "dd.MM.yy HH:mm")}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
