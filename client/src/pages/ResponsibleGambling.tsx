import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ShieldAlert, Clock, Ban, AlertTriangle } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";

export default function ResponsibleGambling() {
  const { isAuthenticated } = useAuth();
  const { currencySymbol } = useCurrency();

  const settingsQ = trpc.responsibleGambling.getSettings.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const updateMut = trpc.responsibleGambling.updateSettings.useMutation({
    onSuccess: () => {
      toast.success("Ayarlar güncellendi");
      settingsQ.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const selfExcludeMut = trpc.responsibleGambling.setSelfExclusion.useMutation({
    onSuccess: (data) => {
      toast.success(`Self-exclusion aktif — ${new Date(data.until).toLocaleDateString("tr-TR")} tarihine kadar`);
      settingsQ.refetch();
      setShowExclusionConfirm(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const [showExclusionConfirm, setShowExclusionConfirm] = useState(false);
  const [exclusionType, setExclusionType] = useState<"24h" | "7d" | "30d" | "permanent">("24h");

  // Form state for limits
  const [depositLimitDaily, setDepositLimitDaily] = useState("");
  const [depositLimitWeekly, setDepositLimitWeekly] = useState("");
  const [depositLimitMonthly, setDepositLimitMonthly] = useState("");
  const [lossLimitDaily, setLossLimitDaily] = useState("");
  const [lossLimitWeekly, setLossLimitWeekly] = useState("");
  const [lossLimitMonthly, setLossLimitMonthly] = useState("");
  const [wagerLimitDaily, setWagerLimitDaily] = useState("");
  const [wagerLimitWeekly, setWagerLimitWeekly] = useState("");
  const [wagerLimitMonthly, setWagerLimitMonthly] = useState("");
  const [sessionReminderMinutes, setSessionReminderMinutes] = useState("");
  const [realityCheckMinutes, setRealityCheckMinutes] = useState("");
  const [limitsLoaded, setLimitsLoaded] = useState(false);

  // Load existing settings into form
  if (settingsQ.data && !limitsLoaded) {
    const s = settingsQ.data;
    setDepositLimitDaily(s.depositLimitDaily || "");
    setDepositLimitWeekly(s.depositLimitWeekly || "");
    setDepositLimitMonthly(s.depositLimitMonthly || "");
    setLossLimitDaily(s.lossLimitDaily || "");
    setLossLimitWeekly(s.lossLimitWeekly || "");
    setLossLimitMonthly(s.lossLimitMonthly || "");
    setWagerLimitDaily(s.wagerLimitDaily || "");
    setWagerLimitWeekly(s.wagerLimitWeekly || "");
    setWagerLimitMonthly(s.wagerLimitMonthly || "");
    setSessionReminderMinutes(s.sessionReminderMinutes?.toString() || "");
    setRealityCheckMinutes(s.realityCheckMinutes?.toString() || "");
    setLimitsLoaded(true);
  }

  const handleSaveLimits = () => {
    updateMut.mutate({
      depositLimitDaily: depositLimitDaily || null,
      depositLimitWeekly: depositLimitWeekly || null,
      depositLimitMonthly: depositLimitMonthly || null,
      lossLimitDaily: lossLimitDaily || null,
      lossLimitWeekly: lossLimitWeekly || null,
      lossLimitMonthly: lossLimitMonthly || null,
      wagerLimitDaily: wagerLimitDaily || null,
      wagerLimitWeekly: wagerLimitWeekly || null,
      wagerLimitMonthly: wagerLimitMonthly || null,
      sessionReminderMinutes: sessionReminderMinutes ? parseInt(sessionReminderMinutes) : null,
      realityCheckMinutes: realityCheckMinutes ? parseInt(realityCheckMinutes) : null,
    });
  };

  const isSelfExcluded = settingsQ.data?.selfExclusionUntil &&
    new Date(settingsQ.data.selfExclusionUntil) > new Date();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
          <ShieldAlert className="w-5 h-5 text-yellow-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Sorumlu Kumar</h1>
          <p className="text-sm text-zinc-400">Kumar alışkanlıklarınızı kontrol altında tutun</p>
        </div>
      </div>

      {/* Self-Exclusion Alert */}
      {isSelfExcluded && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
          <Ban className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-400">Self-Exclusion Aktif</p>
            <p className="text-xs text-zinc-400 mt-1">
              {settingsQ.data?.selfExclusionType === "permanent"
                ? "Kalıcı olarak hariç tutuldunuz."
                : `${new Date(settingsQ.data!.selfExclusionUntil!).toLocaleDateString("tr-TR")} tarihine kadar hariç tutuldunuz.`}
            </p>
          </div>
        </div>
      )}

      {!isAuthenticated ? (
        <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-6 text-center">
          <p className="text-zinc-400">Bu sayfayı kullanmak için giriş yapmalısınız.</p>
        </div>
      ) : (
        <>
          {/* Self-Exclusion */}
          <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 md:p-6">
            <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
              <Ban className="w-4 h-4 text-red-400" />
              Kendini Hariç Tut (Self-Exclusion)
            </h2>
            <p className="text-xs text-zinc-500 mb-4">
              Belirlenen süre boyunca hiçbir casino oyunu oynayamaz ve bahis yapamazsınız. Bu işlem geri alınamaz.
            </p>

            {!showExclusionConfirm ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {([
                  { type: "24h", label: "24 Saat" },
                  { type: "7d", label: "7 Gün" },
                  { type: "30d", label: "30 Gün" },
                  { type: "permanent", label: "Kalıcı" },
                ] as const).map(({ type, label }) => (
                  <button
                    key={type}
                    onClick={() => {
                      setExclusionType(type);
                      setShowExclusionConfirm(true);
                    }}
                    className={`py-3 rounded-lg text-sm font-semibold transition-all ${
                      type === "permanent"
                        ? "bg-red-600/30 text-red-300 hover:bg-red-600/50"
                        : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-red-400">
                      {exclusionType === "permanent" ? "Kalıcı" : exclusionType} hariç tutma onayı
                    </p>
                    <p className="text-xs text-zinc-400 mt-1">
                      Bu işlem geri alınamaz. {exclusionType === "permanent"
                        ? "Hesabınız kalıcı olarak hariç tutulacak."
                        : `${exclusionType} boyunca oyun oynayamayacaksınız.`}
                    </p>
                    <div className="flex gap-2 mt-3">
                      <Button
                        onClick={() => selfExcludeMut.mutate({ type: exclusionType })}
                        disabled={selfExcludeMut.isPending}
                        size="sm"
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        {selfExcludeMut.isPending ? "İşleniyor..." : "Onayla"}
                      </Button>
                      <Button
                        onClick={() => setShowExclusionConfirm(false)}
                        variant="outline"
                        size="sm"
                        className="border-zinc-600 text-zinc-300"
                      >
                        İptal
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Deposit Limits */}
          <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 md:p-6">
            <h2 className="text-sm font-semibold text-white mb-4">Yatırım Limitleri ({currencySymbol})</h2>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Günlük</label>
                <Input
                  type="number"
                  value={depositLimitDaily}
                  onChange={(e) => setDepositLimitDaily(e.target.value)}
                  placeholder="Limitsiz"
                  className="bg-zinc-900 border-zinc-700 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Haftalık</label>
                <Input
                  type="number"
                  value={depositLimitWeekly}
                  onChange={(e) => setDepositLimitWeekly(e.target.value)}
                  placeholder="Limitsiz"
                  className="bg-zinc-900 border-zinc-700 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Aylık</label>
                <Input
                  type="number"
                  value={depositLimitMonthly}
                  onChange={(e) => setDepositLimitMonthly(e.target.value)}
                  placeholder="Limitsiz"
                  className="bg-zinc-900 border-zinc-700 text-white text-sm"
                />
              </div>
            </div>
          </div>

          {/* Loss Limits */}
          <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 md:p-6">
            <h2 className="text-sm font-semibold text-white mb-4">Kayıp Limitleri ({currencySymbol})</h2>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Günlük</label>
                <Input
                  type="number"
                  value={lossLimitDaily}
                  onChange={(e) => setLossLimitDaily(e.target.value)}
                  placeholder="Limitsiz"
                  className="bg-zinc-900 border-zinc-700 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Haftalık</label>
                <Input
                  type="number"
                  value={lossLimitWeekly}
                  onChange={(e) => setLossLimitWeekly(e.target.value)}
                  placeholder="Limitsiz"
                  className="bg-zinc-900 border-zinc-700 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Aylık</label>
                <Input
                  type="number"
                  value={lossLimitMonthly}
                  onChange={(e) => setLossLimitMonthly(e.target.value)}
                  placeholder="Limitsiz"
                  className="bg-zinc-900 border-zinc-700 text-white text-sm"
                />
              </div>
            </div>
          </div>

          {/* Wager Limits */}
          <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 md:p-6">
            <h2 className="text-sm font-semibold text-white mb-4">Bahis Limitleri ({currencySymbol})</h2>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Günlük</label>
                <Input
                  type="number"
                  value={wagerLimitDaily}
                  onChange={(e) => setWagerLimitDaily(e.target.value)}
                  placeholder="Limitsiz"
                  className="bg-zinc-900 border-zinc-700 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Haftalık</label>
                <Input
                  type="number"
                  value={wagerLimitWeekly}
                  onChange={(e) => setWagerLimitWeekly(e.target.value)}
                  placeholder="Limitsiz"
                  className="bg-zinc-900 border-zinc-700 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Aylık</label>
                <Input
                  type="number"
                  value={wagerLimitMonthly}
                  onChange={(e) => setWagerLimitMonthly(e.target.value)}
                  placeholder="Limitsiz"
                  className="bg-zinc-900 border-zinc-700 text-white text-sm"
                />
              </div>
            </div>
          </div>

          {/* Session Reminders */}
          <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 md:p-6">
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              Oturum Hatırlatıcıları
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Oturum Hatırlatıcı (dakika)</label>
                <Input
                  type="number"
                  value={sessionReminderMinutes}
                  onChange={(e) => setSessionReminderMinutes(e.target.value)}
                  placeholder="Kapalı"
                  className="bg-zinc-900 border-zinc-700 text-white text-sm"
                  min={5}
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Reality Check (dakika)</label>
                <Input
                  type="number"
                  value={realityCheckMinutes}
                  onChange={(e) => setRealityCheckMinutes(e.target.value)}
                  placeholder="Kapalı"
                  className="bg-zinc-900 border-zinc-700 text-white text-sm"
                  min={5}
                />
              </div>
            </div>
            <p className="text-[10px] text-zinc-500 mt-2">
              Reality Check: Belirtilen aralıkta net kazanç/kayıp durumunuzu gösteren popup açılır.
            </p>
          </div>

          {/* Save Button */}
          <Button
            onClick={handleSaveLimits}
            disabled={updateMut.isPending}
            className="w-full bg-green-500 hover:bg-green-600 text-black font-bold py-3"
          >
            {updateMut.isPending ? "Kaydediliyor..." : "Ayarları Kaydet"}
          </Button>
        </>
      )}

      {/* Info */}
      <div className="bg-zinc-800/30 border border-zinc-700/30 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-zinc-300 mb-2">Sorumlu Kumar Hakkında</h3>
        <ul className="text-xs text-zinc-500 space-y-1">
          <li>• Limitlerinizi belirleyerek harcamalarınızı kontrol altında tutun</li>
          <li>• Self-exclusion işlemi geri alınamaz — süre dolana kadar oyun oynayamazsınız</li>
          <li>• Bahis limitleri, günlük/haftalık/aylık toplam bahis tutarınızı sınırlar</li>
          <li>• Kayıp limitleri, net kayıp tutarınızı sınırlar</li>
          <li>• Yardım hattı: Türkiye Kumar Bağımlılığı — 182</li>
        </ul>
      </div>
    </div>
  );
}
