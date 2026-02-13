import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Wallet as WalletIcon, ArrowDownCircle, ArrowUpCircle, Loader2,
  History, Copy, Check, ChevronLeft, AlertTriangle, ExternalLink,
  Shield, Clock, CheckCircle2, XCircle,
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import { format } from "date-fns";
import { useCurrency } from "@/contexts/CurrencyContext";
import { QRCodeSVG } from "qrcode.react";

type NetworkId = "tron" | "ethereum" | "bsc" | "polygon" | "solana" | "bitcoin";

export default function Wallet() {
  const { isAuthenticated, loading } = useAuth();
  const { formatAmount } = useCurrency();
  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkId | null>(null);
  const [copied, setCopied] = useState(false);

  // Withdraw state
  const [withdrawNetwork, setWithdrawNetwork] = useState<NetworkId>("tron");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  // Tab for history
  const [historyTab, setHistoryTab] = useState<"deposits" | "withdrawals" | "all">("all");

  const utils = trpc.useUtils();
  const balanceQuery = trpc.balance.get.useQuery(undefined, { enabled: isAuthenticated });
  const txQuery = trpc.balance.transactions.useQuery(undefined, { enabled: isAuthenticated });
  const networksQuery = trpc.cryptoWallet.networks.useQuery(undefined, { enabled: isAuthenticated });
  const addressesQuery = trpc.cryptoWallet.getAddresses.useQuery(undefined, { enabled: isAuthenticated });
  const depositsQuery = trpc.cryptoWallet.deposits.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 30000, // Poll every 30s
  });
  const withdrawalsQuery = trpc.cryptoWallet.withdrawals.useQuery(undefined, { enabled: isAuthenticated });

  const getAddressMut = trpc.cryptoWallet.getDepositAddress.useMutation({
    onSuccess: () => {
      utils.cryptoWallet.getAddresses.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const withdrawMut = trpc.cryptoWallet.requestWithdrawal.useMutation({
    onSuccess: (data) => {
      toast.success(data.status === "approved"
        ? "Çekim onaylandı, işleniyor..."
        : "Çekim talebi oluşturuldu, admin onayı bekleniyor.");
      setWithdrawAddress("");
      setWithdrawAmount("");
      utils.balance.get.invalidate();
      utils.balance.transactions.invalidate();
      utils.cryptoWallet.withdrawals.invalidate();
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

  const networks = networksQuery.data || [];
  const isPending = getAddressMut.isPending || withdrawMut.isPending;

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopied(true);
    toast.success("Adres kopyalandı!");
    setTimeout(() => setCopied(false), 2000);
  };

  const selectedNetworkConfig = networks.find(n => n.id === selectedNetwork);
  const existingAddress = addressesQuery.data?.find(a => a.network === selectedNetwork);

  const handleSelectNetwork = async (networkId: NetworkId) => {
    setSelectedNetwork(networkId);
    // Auto-generate address if not exists
    const existing = addressesQuery.data?.find(a => a.network === networkId);
    if (!existing) {
      getAddressMut.mutate({ network: networkId });
    }
  };

  const depositAddress = getAddressMut.data?.address || existingAddress?.depositAddress;

  // Selected network config for withdrawal
  const withdrawNetworkConfig = networks.find(n => n.id === withdrawNetwork);

  const txTypeLabels: Record<string, { label: string; color: string }> = {
    deposit: { label: "Yatırma", color: "text-primary" },
    withdraw: { label: "Çekme", color: "text-destructive" },
    bet_place: { label: "Bahis", color: "text-stake-blue" },
    bet_win: { label: "Kazanç", color: "text-primary" },
    bet_refund: { label: "İade", color: "text-stake-blue" },
  };

  const depositStatusLabels: Record<string, { label: string; icon: any; color: string }> = {
    pending: { label: "Bekleniyor", icon: Clock, color: "text-yellow-500" },
    confirming: { label: "Onaylanıyor", icon: Loader2, color: "text-blue-400" },
    confirmed: { label: "Onaylandı", icon: CheckCircle2, color: "text-green-400" },
    credited: { label: "Bakiyeye Eklendi", icon: Check, color: "text-primary" },
    failed: { label: "Başarısız", icon: XCircle, color: "text-destructive" },
  };

  const withdrawalStatusLabels: Record<string, { label: string; color: string }> = {
    pending: { label: "Admin Onayı Bekleniyor", color: "text-yellow-500" },
    approved: { label: "Onaylandı", color: "text-blue-400" },
    processing: { label: "İşleniyor", color: "text-blue-400" },
    completed: { label: "Tamamlandı", color: "text-primary" },
    rejected: { label: "Reddedildi", color: "text-destructive" },
    failed: { label: "Başarısız", color: "text-destructive" },
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
            onClick={() => { setMode("deposit"); setSelectedNetwork(null); }}
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

        {/* ─── DEPOSIT ─── */}
        {mode === "deposit" && !selectedNetwork && (
          <div>
            <div className="text-sm font-semibold text-foreground mb-3">Ağ Seçin</div>
            <div className="grid grid-cols-2 gap-2">
              {networks.map((net) => (
                <button
                  key={net.id}
                  onClick={() => handleSelectNetwork(net.id as NetworkId)}
                  className="relative flex items-center gap-3 p-3 rounded-lg border border-border bg-secondary hover:border-primary/50 hover:bg-primary/5 transition-all text-left"
                >
                  {net.recommended && (
                    <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                      Önerilen
                    </span>
                  )}
                  <div className={`w-10 h-10 rounded-full ${net.bg} flex items-center justify-center text-lg font-bold ${net.color}`}>
                    {net.icon}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{net.token}</div>
                    <div className="text-[11px] text-muted-foreground">{net.name}</div>
                    <div className="text-[10px] text-muted-foreground">Fee: {net.withdrawalFee} USDT</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === "deposit" && selectedNetwork && (
          <div className="space-y-4">
            <button
              onClick={() => { setSelectedNetwork(null); getAddressMut.reset(); }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-3 w-3" /> Geri
            </button>

            {selectedNetworkConfig && (
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-full ${selectedNetworkConfig.bg} flex items-center justify-center text-lg font-bold ${selectedNetworkConfig.color}`}>
                  {selectedNetworkConfig.icon}
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">{selectedNetworkConfig.token}</div>
                  <div className="text-xs text-muted-foreground">Ağ: {selectedNetworkConfig.name}</div>
                </div>
              </div>
            )}

            {getAddressMut.isPending && !depositAddress ? (
              <div className="flex flex-col items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                <span className="text-sm text-muted-foreground">Adres üretiliyor...</span>
              </div>
            ) : depositAddress ? (
              <>
                {/* QR Code */}
                <div className="flex justify-center">
                  <div className="p-3 bg-white rounded-lg">
                    <QRCodeSVG value={depositAddress} size={160} />
                  </div>
                </div>

                {/* Address */}
                <div className="bg-secondary border border-border rounded-lg p-3">
                  <div className="text-[11px] text-muted-foreground mb-1 font-medium">Yatırım Adresi</div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs text-foreground break-all font-mono">{depositAddress}</code>
                    <button
                      onClick={() => copyAddress(depositAddress)}
                      className="p-1.5 rounded-md hover:bg-accent transition-colors shrink-0"
                    >
                      {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                    </button>
                  </div>
                </div>

                {/* Deposit Status - live polling */}
                {depositsQuery.data && depositsQuery.data.filter(d => d.network === selectedNetwork && d.status !== "credited").length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground uppercase">Bekleyen Yatırımlar</div>
                    {depositsQuery.data
                      .filter(d => d.network === selectedNetwork && d.status !== "credited")
                      .map(dep => {
                        const statusInfo = depositStatusLabels[dep.status] || depositStatusLabels.pending;
                        const StatusIcon = statusInfo.icon;
                        const progress = dep.requiredConfirmations > 0
                          ? Math.min(100, (dep.confirmations / dep.requiredConfirmations) * 100)
                          : 0;
                        return (
                          <div key={dep.id} className="bg-secondary border border-border rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-mono text-muted-foreground">{dep.txHash.slice(0, 12)}...{dep.txHash.slice(-8)}</span>
                              <span className={`text-xs font-semibold flex items-center gap-1 ${statusInfo.color}`}>
                                <StatusIcon className={`h-3 w-3 ${dep.status === "confirming" ? "animate-spin" : ""}`} />
                                {statusInfo.label}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span className="text-foreground font-semibold">{dep.amount} {dep.tokenSymbol}</span>
                              <span className="text-muted-foreground text-xs">{dep.confirmations}/{dep.requiredConfirmations} onay</span>
                            </div>
                            <div className="w-full bg-border rounded-full h-1.5">
                              <div
                                className="bg-primary h-1.5 rounded-full transition-all duration-500"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}

                {/* Warning */}
                <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-yellow-200">
                    <span className="font-semibold">Minimum yatırım:</span> {selectedNetworkConfig?.minDeposit} USDT<br />
                    Sadece <span className="font-semibold">{selectedNetworkConfig?.name}</span> ağı üzerinden gönderim yapın.
                    Yanlış ağ seçimi durumunda varlıklarınız kaybolabilir.<br />
                    <span className="font-semibold">{selectedNetworkConfig?.confirmations} onay</span> sonrasında bakiyenize eklenecektir.
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* ─── WITHDRAW ─── */}
        {mode === "withdraw" && (
          <div className="space-y-3">
            {/* Network select */}
            <div>
              <label className="block text-xs text-muted-foreground mb-1 font-medium">Ağ Seçin</label>
              <div className="grid grid-cols-3 gap-1.5">
                {networks.map(net => (
                  <button
                    key={net.id}
                    onClick={() => setWithdrawNetwork(net.id as NetworkId)}
                    className={`py-2 px-2 rounded-md text-xs font-semibold transition-colors border ${
                      withdrawNetwork === net.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-secondary text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    <span className={net.color}>{net.icon}</span> {net.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Fee info */}
            {withdrawNetworkConfig && (
              <div className="flex items-center gap-2 p-2 rounded-md bg-secondary border border-border text-xs text-muted-foreground">
                <Shield className="h-3.5 w-3.5" />
                <span>İşlem ücreti: <span className="text-foreground font-semibold">{withdrawNetworkConfig.withdrawalFee} USDT</span></span>
              </div>
            )}

            {/* Wallet address */}
            <div>
              <label className="block text-xs text-muted-foreground mb-1 font-medium">Cüzdan Adresi</label>
              <input
                type="text"
                value={withdrawAddress}
                onChange={(e) => setWithdrawAddress(e.target.value)}
                placeholder={`${withdrawNetworkConfig?.name || ""} cüzdan adresi`}
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

            {/* Summary */}
            {parseFloat(withdrawAmount) > 0 && withdrawNetworkConfig && (
              <div className="bg-secondary border border-border rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Çekim Tutarı</span>
                  <span className="text-foreground font-semibold">{withdrawAmount} USDT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">İşlem Ücreti</span>
                  <span className="text-foreground">{withdrawNetworkConfig.withdrawalFee} USDT</span>
                </div>
                <div className="border-t border-border pt-1 flex justify-between">
                  <span className="text-muted-foreground font-semibold">Toplam</span>
                  <span className="text-primary font-bold">
                    {(parseFloat(withdrawAmount) + withdrawNetworkConfig.withdrawalFee).toFixed(2)} USDT
                  </span>
                </div>
              </div>
            )}

            <Button
              disabled={!withdrawAddress || (parseFloat(withdrawAmount) || 0) < 1 || isPending}
              onClick={() => {
                withdrawMut.mutate({
                  network: withdrawNetwork,
                  toAddress: withdrawAddress,
                  amount: parseFloat(withdrawAmount) || 0,
                });
              }}
              className="w-full bg-destructive hover:bg-destructive/90 text-white font-bold"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Çekimi Onayla
            </Button>
          </div>
        )}
      </div>

      {/* ─── History Tabs ─── */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="flex items-center gap-1 px-4 py-3 border-b border-border">
          <History className="h-4 w-4 text-muted-foreground mr-1" />
          {(["all", "deposits", "withdrawals"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setHistoryTab(tab)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                historyTab === tab
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "all" ? "Tümü" : tab === "deposits" ? "Yatırmalar" : "Çekimler"}
            </button>
          ))}
        </div>

        {/* All transactions */}
        {historyTab === "all" && (
          txQuery.isLoading ? (
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
          )
        )}

        {/* Crypto deposits */}
        {historyTab === "deposits" && (
          depositsQuery.isLoading ? (
            <div className="p-6 text-center"><Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" /></div>
          ) : !depositsQuery.data?.length ? (
            <div className="p-6 text-center text-muted-foreground text-sm">Henüz kripto yatırma yok</div>
          ) : (
            <div className="divide-y divide-border/50">
              {depositsQuery.data.map((dep: any) => {
                const statusInfo = depositStatusLabels[dep.status] || depositStatusLabels.pending;
                const StatusIcon = statusInfo.icon;
                return (
                  <div key={dep.id} className="flex items-center justify-between px-4 py-3 hover:bg-accent/20 transition-colors">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-sm font-semibold ${statusInfo.color}`}>
                          <StatusIcon className={`h-3.5 w-3.5 inline mr-1 ${dep.status === "confirming" ? "animate-spin" : ""}`} />
                          {statusInfo.label}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">{dep.network.toUpperCase()} — {dep.txHash.slice(0, 10)}...</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-primary">+{dep.amount} {dep.tokenSymbol}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {dep.confirmations}/{dep.requiredConfirmations} onay
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* Withdrawals */}
        {historyTab === "withdrawals" && (
          withdrawalsQuery.isLoading ? (
            <div className="p-6 text-center"><Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" /></div>
          ) : !withdrawalsQuery.data?.length ? (
            <div className="p-6 text-center text-muted-foreground text-sm">Henüz çekim yok</div>
          ) : (
            <div className="divide-y divide-border/50">
              {withdrawalsQuery.data.map((w: any) => {
                const statusInfo = withdrawalStatusLabels[w.status] || withdrawalStatusLabels.pending;
                return (
                  <div key={w.id} className="flex items-center justify-between px-4 py-3 hover:bg-accent/20 transition-colors">
                    <div>
                      <div className={`text-sm font-semibold ${statusInfo.color}`}>{statusInfo.label}</div>
                      <div className="text-xs text-muted-foreground">{w.network.toUpperCase()} — {w.toAddress.slice(0, 10)}...</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-destructive">-{w.amount} {w.tokenSymbol}</div>
                      <div className="text-[10px] text-muted-foreground">
                        Fee: {w.fee} USDT
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}
