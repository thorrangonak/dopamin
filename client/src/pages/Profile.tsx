import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import {
  User, Trophy, TrendingUp, TrendingDown, BarChart3, Wallet,
  Gamepad2, Target, Percent, DollarSign, Activity, Calendar,
  Loader2, ArrowUpRight, ArrowDownRight, Minus,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, CartesianGrid,
} from "recharts";
import { useMemo } from "react";
import { useCurrency } from "@/contexts/CurrencyContext";

const CHART_COLORS = ["#00e701", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#10b981"];

function StatCard({ icon: Icon, label, value, subValue, trend }: {
  icon: any; label: string; value: string | number; subValue?: string; trend?: "up" | "down" | "neutral";
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div className="p-2 rounded-md bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        {trend && (
          <div className={`flex items-center gap-0.5 text-xs font-medium ${
            trend === "up" ? "text-green-500" : trend === "down" ? "text-red-500" : "text-muted-foreground"
          }`}>
            {trend === "up" ? <ArrowUpRight className="h-3 w-3" /> : trend === "down" ? <ArrowDownRight className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
      {subValue && <div className="text-[11px] text-muted-foreground mt-1">{subValue}</div>}
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-sm font-semibold" style={{ color: entry.color }}>
          {entry.name}: {typeof entry.value === "number" ? entry.value.toFixed(2) : entry.value}
        </p>
      ))}
    </div>
  );
}

export default function Profile() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { formatAmount } = useCurrency();

  const statsQuery = trpc.profile.stats.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const data = statsQuery.data;

  // Format balance timeline for chart
  const balanceChartData = useMemo(() => {
    if (!data?.balanceTimeline) return [];
    return data.balanceTimeline.map((item, i) => ({
      index: i,
      date: new Date(item.date).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" }),
      balance: item.balance,
      type: item.type,
    }));
  }, [data?.balanceTimeline]);

  // Format sport distribution for pie chart
  const sportPieData = useMemo(() => {
    if (!data?.sportDistribution) return [];
    return data.sportDistribution.slice(0, 8).map(s => ({
      name: s.sportKey.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
      value: s.count,
    }));
  }, [data?.sportDistribution]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <User className="h-16 w-16 text-muted-foreground" />
        <p className="text-lg text-muted-foreground">Profil sayfasını görüntülemek için giriş yapın</p>
        <Button onClick={() => { window.location.href = getLoginUrl(); }} className="bg-primary hover:bg-primary/90 text-primary-foreground">
          Giriş Yap
        </Button>
      </div>
    );
  }

  if (statsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">İstatistikler yükleniyor...</span>
      </div>
    );
  }

  const totalProfit = data?.totalProfit ?? 0;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* Profile Header */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
            <User className="h-8 w-8 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">{data?.user?.name || user?.name || "Kullanıcı"}</h1>
            <p className="text-sm text-muted-foreground">{data?.user?.email || user?.email}</p>
            <div className="flex items-center gap-3 mt-2">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                data?.user?.role === "admin" ? "bg-yellow-500/20 text-yellow-500" : "bg-primary/20 text-primary"
              }`}>
                {data?.user?.role === "admin" ? "👑 Admin" : "👤 Üye"}
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {data?.user?.createdAt ? new Date(data.user.createdAt).toLocaleDateString("tr-TR") : ""}
              </span>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-sm text-muted-foreground">Bakiye</div>
            <div className="text-2xl font-bold text-primary">{formatAmount(data?.currentBalance ?? 0)}</div>
            <div className={`text-sm font-medium flex items-center justify-end gap-1 ${totalProfit >= 0 ? "text-green-500" : "text-red-500"}`}>
              {totalProfit >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {formatAmount(totalProfit, { showSign: true })} Toplam Kar/Zarar
            </div>
          </div>
        </div>
        {/* Mobile balance */}
        <div className="sm:hidden mt-4 pt-4 border-t border-border flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground">Bakiye</div>
            <div className="text-xl font-bold text-primary">{formatAmount(data?.currentBalance ?? 0)}</div>
          </div>
          <div className={`text-sm font-medium flex items-center gap-1 ${totalProfit >= 0 ? "text-green-500" : "text-red-500"}`}>
            {totalProfit >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {formatAmount(totalProfit, { showSign: true })}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={BarChart3} label="Toplam Bahis" value={data?.betStats?.totalBets ?? 0} />
        <StatCard icon={Trophy} label="Kazanılan" value={data?.betStats?.wonBets ?? 0} trend="up" />
        <StatCard icon={Target} label="Kaybedilen" value={data?.betStats?.lostBets ?? 0} trend="down" />
        <StatCard icon={Percent} label="Kazanma Oranı" value={`%${(data?.betStats?.winRate ?? 0).toFixed(1)}`} />
        <StatCard icon={DollarSign} label="Toplam Yatırım" value={formatAmount(data?.betStats?.totalStaked ?? 0)} />
        <StatCard icon={Wallet} label="Toplam Kazanç" value={formatAmount(data?.betStats?.totalWon ?? 0)} trend={totalProfit >= 0 ? "up" : "down"} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Balance Timeline */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Bakiye Değişimi
          </h3>
          {balanceChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={balanceChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="balance"
                  name="Bakiye"
                  stroke="#00e701"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "#00e701" }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
              Henüz işlem geçmişi yok
            </div>
          )}
        </div>

        {/* Sport Distribution */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Spor Dalı Dağılımı
          </h3>
          {sportPieData.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={250}>
                <PieChart>
                  <Pie
                    data={sportPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {sportPieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {sportPieData.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="text-muted-foreground truncate flex-1">{item.name}</span>
                    <span className="font-semibold text-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
              Henüz bahis geçmişi yok
            </div>
          )}
        </div>
      </div>

      {/* Casino Stats */}
      {data?.casinoStats && data.casinoStats.totalGames > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Gamepad2 className="h-4 w-4 text-primary" />
            Casino İstatistikleri
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="text-center p-3 bg-secondary/50 rounded-lg">
              <div className="text-xl font-bold text-foreground">{data.casinoStats.totalGames}</div>
              <div className="text-[11px] text-muted-foreground">Toplam Oyun</div>
            </div>
            <div className="text-center p-3 bg-secondary/50 rounded-lg">
              <div className="text-xl font-bold text-green-500">{data.casinoStats.wonGames}</div>
              <div className="text-[11px] text-muted-foreground">Kazanılan</div>
            </div>
            <div className="text-center p-3 bg-secondary/50 rounded-lg">
              <div className="text-xl font-bold text-red-500">{data.casinoStats.lostGames}</div>
              <div className="text-[11px] text-muted-foreground">Kaybedilen</div>
            </div>
            <div className="text-center p-3 bg-secondary/50 rounded-lg">
              <div className="text-xl font-bold text-foreground">%{data.casinoStats.winRate.toFixed(1)}</div>
              <div className="text-[11px] text-muted-foreground">Kazanma Oranı</div>
            </div>
            <div className="text-center p-3 bg-secondary/50 rounded-lg">
              <div className="text-xl font-bold text-foreground">{formatAmount(data.casinoStats.totalStaked)}</div>
              <div className="text-[11px] text-muted-foreground">Toplam Yatırım</div>
            </div>
            <div className="text-center p-3 bg-secondary/50 rounded-lg">
              <div className={`text-xl font-bold ${data.casinoStats.totalPayout - data.casinoStats.totalStaked >= 0 ? "text-green-500" : "text-red-500"}`}>
                {formatAmount(data.casinoStats.totalPayout - data.casinoStats.totalStaked)}
              </div>
              <div className="text-[11px] text-muted-foreground">Kar/Zarar</div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {data?.balanceTimeline && data.balanceTimeline.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Son İşlemler
          </h3>
          <div className="divide-y divide-border">
            {data.balanceTimeline.slice(-15).reverse().map((tx, i) => (
              <div key={i} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    tx.type === "deposit" ? "bg-green-500/10" :
                    tx.type === "bet_win" ? "bg-primary/10" :
                    tx.type === "withdraw" ? "bg-red-500/10" :
                    "bg-muted"
                  }`}>
                    {tx.type === "deposit" ? <ArrowUpRight className="h-4 w-4 text-green-500" /> :
                     tx.type === "bet_win" ? <Trophy className="h-4 w-4 text-primary" /> :
                     tx.type === "withdraw" ? <ArrowDownRight className="h-4 w-4 text-red-500" /> :
                     <Minus className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground">{tx.description || tx.type}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(tx.date).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
                <div className={`text-sm font-semibold ${
                  tx.type === "deposit" || tx.type === "bet_win" || tx.type === "bet_refund" ? "text-green-500" : "text-red-500"
                }`}>
                  {tx.type === "deposit" || tx.type === "bet_win" || tx.type === "bet_refund" ? "+" : "-"}{formatAmount(tx.amount)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
