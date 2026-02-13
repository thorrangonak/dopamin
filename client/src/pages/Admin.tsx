import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Users, Ticket, Wallet, RefreshCw, Loader2, ArrowLeft,
  Image, Plus, Pencil, Trash2, ChevronUp, ChevronDown, Eye, EyeOff, X, Save, ExternalLink
} from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { toast } from "sonner";

type Tab = "overview" | "users" | "bets" | "transactions" | "banners";

interface BannerForm {
  title: string;
  imageUrl: string;
  ctaLink: string;
  section: "sports" | "casino" | "both";
  isActive: number;
  startsAt: string;
  endsAt: string;
}

const emptyBannerForm: BannerForm = {
  title: "",
  imageUrl: "",
  ctaLink: "/",
  section: "both",
  isActive: 1,
  startsAt: "",
  endsAt: "",
};

export default function Admin() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<Tab>("overview");

  const usersQuery = trpc.admin.users.useQuery(undefined, { enabled: user?.role === "admin" });
  const betsQuery = trpc.admin.bets.useQuery(undefined, { enabled: user?.role === "admin" });
  const txQuery = trpc.admin.transactions.useQuery(undefined, { enabled: user?.role === "admin" });
  const balancesQuery = trpc.admin.balances.useQuery(undefined, { enabled: user?.role === "admin" });
  const bannersQuery = trpc.admin.bannerList.useQuery(undefined, { enabled: user?.role === "admin" && tab === "banners" });

  const settleMut = trpc.admin.settle.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.settled} kupon sonuçlandırıldı (${data.checked} kontrol edildi)`);
      betsQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  if (!user || user.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center py-20 p-4">
        <LayoutDashboard className="h-10 w-10 text-destructive mb-4" />
        <h2 className="text-lg font-bold mb-2 text-foreground">Erişim Engellendi</h2>
        <p className="text-muted-foreground text-sm mb-4">Bu sayfa yalnızca yöneticiler içindir.</p>
        <Button onClick={() => setLocation("/")} variant="outline"><ArrowLeft className="h-4 w-4 mr-1" /> Ana Sayfa</Button>
      </div>
    );
  }

  const tabs = [
    { value: "overview" as Tab, label: "Genel Bakış", icon: LayoutDashboard },
    { value: "users" as Tab, label: "Kullanıcılar", icon: Users },
    { value: "bets" as Tab, label: "Kuponlar", icon: Ticket },
    { value: "transactions" as Tab, label: "İşlemler", icon: Wallet },
    { value: "banners" as Tab, label: "Bannerlar", icon: Image },
  ];

  const totalBalance = balancesQuery.data?.reduce((sum: number, b: any) => sum + parseFloat(b.amount), 0) || 0;
  const pendingBets = betsQuery.data?.filter((b: any) => b.status === "pending").length || 0;

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-foreground">Admin Paneli</h1>
        <Button onClick={() => settleMut.mutate()} disabled={settleMut.isPending} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
          {settleMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          Kuponları Sonuçlandır
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              tab === t.value ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === "overview" && (
        <div className="grid md:grid-cols-4 gap-4">
          {[
            { label: "Toplam Kullanıcı", value: usersQuery.data?.length || 0, color: "text-primary" },
            { label: "Toplam Kupon", value: betsQuery.data?.length || 0, color: "text-stake-blue" },
            { label: "Bekleyen Kupon", value: pendingBets, color: "text-yellow-500" },
            { label: "Toplam Bakiye", value: `${totalBalance.toFixed(2)} TL`, color: "text-primary" },
          ].map((s, i) => (
            <div key={i} className="bg-card border border-border rounded-lg p-4">
              <div className="text-xs text-muted-foreground uppercase mb-1 font-medium">{s.label}</div>
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Users */}
      {tab === "users" && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">ID</th>
                  <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">İsim</th>
                  <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Email</th>
                  <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Rol</th>
                  <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Kayıt</th>
                </tr>
              </thead>
              <tbody>
                {usersQuery.data?.map((u: any) => (
                  <tr key={u.id} className="border-b border-border/30 hover:bg-accent/20 transition-colors">
                    <td className="px-4 py-2.5 text-foreground">{u.id}</td>
                    <td className="px-4 py-2.5 text-foreground">{u.name || "-"}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{u.email || "-"}</td>
                    <td className="px-4 py-2.5"><span className={`text-xs px-1.5 py-0.5 rounded ${u.role === "admin" ? "text-primary bg-primary/10" : "text-muted-foreground bg-secondary"}`}>{u.role}</span></td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{format(new Date(u.createdAt), "dd.MM.yy")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bets */}
      {tab === "bets" && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">ID</th>
                  <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Kullanıcı</th>
                  <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Tip</th>
                  <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Bahis</th>
                  <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Oran</th>
                  <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Kazanç</th>
                  <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Durum</th>
                  <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Tarih</th>
                </tr>
              </thead>
              <tbody>
                {betsQuery.data?.map((b: any) => (
                  <tr key={b.id} className="border-b border-border/30 hover:bg-accent/20 transition-colors">
                    <td className="px-4 py-2.5 text-foreground">{b.id}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{b.userId}</td>
                    <td className="px-4 py-2.5 text-foreground">{b.type === "combo" ? "Kombine" : "Tekli"}</td>
                    <td className="px-4 py-2.5 text-foreground">{parseFloat(b.stake).toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-stake-blue">{parseFloat(b.totalOdds).toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-primary">{parseFloat(b.potentialWin).toFixed(2)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        b.status === "won" ? "text-primary bg-primary/10" :
                        b.status === "lost" ? "text-destructive bg-destructive/10" :
                        "text-stake-blue bg-stake-blue/10"
                      }`}>{b.status}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{format(new Date(b.createdAt), "dd.MM.yy HH:mm")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transactions */}
      {tab === "transactions" && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">ID</th>
                  <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Kullanıcı</th>
                  <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Tip</th>
                  <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Tutar</th>
                  <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Açıklama</th>
                  <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Tarih</th>
                </tr>
              </thead>
              <tbody>
                {txQuery.data?.map((tx: any) => (
                  <tr key={tx.id} className="border-b border-border/30 hover:bg-accent/20 transition-colors">
                    <td className="px-4 py-2.5 text-foreground">{tx.id}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{tx.userId}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        tx.type === "deposit" || tx.type === "bet_win" ? "text-primary bg-primary/10" : "text-destructive bg-destructive/10"
                      }`}>{tx.type}</span>
                    </td>
                    <td className="px-4 py-2.5 text-foreground">{parseFloat(tx.amount).toFixed(2)} TL</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{tx.description || "-"}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{format(new Date(tx.createdAt), "dd.MM.yy HH:mm")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Banners */}
      {tab === "banners" && (
        <BannerManager bannersQuery={bannersQuery} />
      )}
    </div>
  );
}

// ─── Banner Manager Component ───

function BannerManager({ bannersQuery }: { bannersQuery: any }) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<BannerForm>(emptyBannerForm);
  const utils = trpc.useUtils();

  const createMut = trpc.admin.bannerCreate.useMutation({
    onSuccess: () => {
      toast.success("Banner oluşturuldu");
      utils.admin.bannerList.invalidate();
      setShowForm(false);
      setForm(emptyBannerForm);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMut = trpc.admin.bannerUpdate.useMutation({
    onSuccess: () => {
      toast.success("Banner güncellendi");
      utils.admin.bannerList.invalidate();
      setEditingId(null);
      setForm(emptyBannerForm);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = trpc.admin.bannerDelete.useMutation({
    onSuccess: () => {
      toast.success("Banner silindi");
      utils.admin.bannerList.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const reorderMut = trpc.admin.bannerReorder.useMutation({
    onSuccess: () => {
      utils.admin.bannerList.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const bannerList: any[] = bannersQuery.data || [];

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const ids = bannerList.map((b: any) => b.id);
    [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
    reorderMut.mutate({ orderedIds: ids });
  };

  const handleMoveDown = (index: number) => {
    if (index >= bannerList.length - 1) return;
    const ids = bannerList.map((b: any) => b.id);
    [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
    reorderMut.mutate({ orderedIds: ids });
  };

  const handleEdit = (banner: any) => {
    setEditingId(banner.id);
    setShowForm(true);
    setForm({
      title: banner.title,
      imageUrl: banner.imageUrl,
      ctaLink: banner.ctaLink,
      section: banner.section,
      isActive: banner.isActive,
      startsAt: banner.startsAt ? new Date(banner.startsAt).toISOString().slice(0, 16) : "",
      endsAt: banner.endsAt ? new Date(banner.endsAt).toISOString().slice(0, 16) : "",
    });
  };

  const handleSubmit = () => {
    if (!form.title || !form.imageUrl) {
      toast.error("Başlık ve görsel URL'si zorunludur");
      return;
    }
    if (editingId) {
      updateMut.mutate({
        id: editingId,
        title: form.title,
        imageUrl: form.imageUrl,
        ctaLink: form.ctaLink,
        section: form.section,
        isActive: form.isActive,
        startsAt: form.startsAt || null,
        endsAt: form.endsAt || null,
      });
    } else {
      const maxOrder = bannerList.reduce((max: number, b: any) => Math.max(max, b.sortOrder || 0), 0);
      createMut.mutate({
        title: form.title,
        imageUrl: form.imageUrl,
        ctaLink: form.ctaLink,
        section: form.section,
        sortOrder: maxOrder + 1,
        isActive: form.isActive,
        startsAt: form.startsAt || null,
        endsAt: form.endsAt || null,
      });
    }
  };

  const handleToggleActive = (banner: any) => {
    updateMut.mutate({
      id: banner.id,
      isActive: banner.isActive ? 0 : 1,
    });
  };

  const sectionLabel = (s: string) => {
    switch (s) {
      case "sports": return "Spor";
      case "casino": return "Casino";
      case "both": return "Her İkisi";
      default: return s;
    }
  };

  const sectionColor = (s: string) => {
    switch (s) {
      case "sports": return "text-primary bg-primary/10";
      case "casino": return "text-purple-400 bg-purple-400/10";
      case "both": return "text-stake-blue bg-stake-blue/10";
      default: return "text-muted-foreground bg-secondary";
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Banner Yönetimi</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{bannerList.length} banner kayıtlı</p>
        </div>
        <Button
          onClick={() => {
            setEditingId(null);
            setForm(emptyBannerForm);
            setShowForm(true);
          }}
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
        >
          <Plus className="h-4 w-4 mr-1" /> Yeni Banner
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">
              {editingId ? "Banner Düzenle" : "Yeni Banner Ekle"}
            </h3>
            <button onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyBannerForm); }}>
              <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </button>
          </div>

          {/* Preview */}
          {form.imageUrl && (
            <div className="rounded-lg overflow-hidden border border-border">
              <img
                src={form.imageUrl}
                alt="Banner önizleme"
                className="w-full h-32 sm:h-48 object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Başlık *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Banner başlığı"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Görsel URL *</label>
              <input
                type="text"
                value={form.imageUrl}
                onChange={(e) => setForm(f => ({ ...f, imageUrl: e.target.value }))}
                className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">CTA Link</label>
              <input
                type="text"
                value={form.ctaLink}
                onChange={(e) => setForm(f => ({ ...f, ctaLink: e.target.value }))}
                className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="/sports"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Bölüm</label>
              <select
                value={form.section}
                onChange={(e) => setForm(f => ({ ...f, section: e.target.value as any }))}
                className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="both">Her İkisi</option>
                <option value="sports">Spor</option>
                <option value="casino">Casino</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Başlangıç Tarihi (opsiyonel)</label>
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm(f => ({ ...f, startsAt: e.target.value }))}
                className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Bitiş Tarihi (opsiyonel)</label>
              <input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setForm(f => ({ ...f, endsAt: e.target.value }))}
                className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive === 1}
                onChange={(e) => setForm(f => ({ ...f, isActive: e.target.checked ? 1 : 0 }))}
                className="rounded border-border"
              />
              <span className="text-sm text-foreground">Aktif</span>
            </label>
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyBannerForm); }}
            >
              İptal
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMut.isPending || updateMut.isPending}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
            >
              {(createMut.isPending || updateMut.isPending) ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              {editingId ? "Güncelle" : "Oluştur"}
            </Button>
          </div>
        </div>
      )}

      {/* Banner List */}
      {bannersQuery.isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : bannerList.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <Image className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Henüz banner eklenmemiş.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {bannerList.map((banner: any, index: number) => (
            <div
              key={banner.id}
              className={`bg-card border rounded-lg overflow-hidden transition-all ${
                banner.isActive ? "border-border" : "border-border/50 opacity-60"
              }`}
            >
              <div className="flex items-stretch">
                {/* Thumbnail */}
                <div className="w-24 sm:w-36 md:w-48 flex-shrink-0 relative">
                  <img
                    src={banner.imageUrl}
                    alt={banner.title}
                    className="w-full h-full object-cover min-h-[72px]"
                  />
                  {!banner.isActive && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <EyeOff className="h-5 w-5 text-white/70" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-semibold text-foreground truncate">{banner.title}</h4>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${sectionColor(banner.section)}`}>
                        {sectionLabel(banner.section)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" /> {banner.ctaLink}
                      </span>
                      {banner.startsAt && (
                        <span>Başlangıç: {format(new Date(banner.startsAt), "dd.MM.yy HH:mm")}</span>
                      )}
                      {banner.endsAt && (
                        <span>Bitiş: {format(new Date(banner.endsAt), "dd.MM.yy HH:mm")}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 px-2 flex-shrink-0">
                  {/* Reorder */}
                  <button
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0 || reorderMut.isPending}
                    className="p-1.5 rounded hover:bg-accent/30 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                    title="Yukarı taşı"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleMoveDown(index)}
                    disabled={index >= bannerList.length - 1 || reorderMut.isPending}
                    className="p-1.5 rounded hover:bg-accent/30 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                    title="Aşağı taşı"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>

                  {/* Toggle active */}
                  <button
                    onClick={() => handleToggleActive(banner)}
                    className={`p-1.5 rounded hover:bg-accent/30 transition-colors ${
                      banner.isActive ? "text-primary" : "text-muted-foreground"
                    }`}
                    title={banner.isActive ? "Pasif yap" : "Aktif yap"}
                  >
                    {banner.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>

                  {/* Edit */}
                  <button
                    onClick={() => handleEdit(banner)}
                    className="p-1.5 rounded hover:bg-accent/30 text-muted-foreground hover:text-foreground transition-colors"
                    title="Düzenle"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => {
                      if (confirm("Bu banner'ı silmek istediğinizden emin misiniz?")) {
                        deleteMut.mutate({ id: banner.id });
                      }
                    }}
                    disabled={deleteMut.isPending}
                    className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    title="Sil"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
