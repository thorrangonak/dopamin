import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { useBetSlip } from "@/contexts/BetSlipContext";
import { useState, createContext, useContext, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet, Ticket, Bot, LogOut, X, Menu, User,
  LayoutDashboard, Radio, ChevronLeft, ChevronRight,
  Trophy, Swords, CircleDot, Dumbbell, Bike, Target,
  Gamepad2, Volleyball, Home, HelpCircle,
  Dice1, Spade, Diamond, Cherry, Clover, Star,
  Layers, Flame, Zap, Crown, Gift, Activity,
  Coins, Dices, Bomb, Rocket, Triangle,
  Sun, Moon,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import CurrencySelector from "@/components/CurrencySelector";
import DopaminLogo from "@/components/DopaminLogo";
import DopaminMoleculeIcon from "@/components/DopaminMoleculeIcon";
import ChatWidget from "@/components/ChatWidget";

/* ─── Section Context ─── */
type Section = "sports" | "casino";
const SectionContext = createContext<{
  section: Section; setSection: (s: Section) => void;
  selectedLeague: string | null; setSelectedLeague: (l: string | null) => void;
}>({
  section: "sports", setSection: () => {},
  selectedLeague: null, setSelectedLeague: () => {},
});
export const useSection = () => useContext(SectionContext);

/* ─── Sidebar Items ─── */
const SPORT_NAV_TOP = [
  { label: "Ana Sayfa", path: "/", icon: Home },
  { label: "Tüm Maçlar", path: "/sports", icon: Activity, league: null as string | null },
  { label: "Canlı Skorlar", path: "/live", icon: Radio },
  { label: "Kuponlarım", path: "/my-bets", icon: Ticket },
] as const;

const SPORT_NAV_BOTTOM = [
  { label: "AI Asistan", path: "/assistant", icon: Bot },
  { label: "VIP Kulüp", path: "/vip", icon: Crown },
  { label: "SSS", path: "/faq", icon: HelpCircle },
] as const;

const SPORT_GROUP_ICONS: Record<string, any> = {
  Soccer: CircleDot,
  Basketball: Volleyball,
  Tennis: Target,
  "American Football": Swords,
  "Ice Hockey": Trophy,
  "Mixed Martial Arts": Dumbbell,
  Esports: Gamepad2,
};

const CASINO_ITEMS = [
  { label: "Ana Sayfa", path: "/casino", icon: Home },
  { label: "Popüler", path: "/casino/popular", icon: Flame },
  { label: "Favoriler", path: "/casino/favorites", icon: Star },
  { type: "divider" as const },
  { label: "Coin Flip", path: "/game/coinflip", icon: Coins },
  { label: "Dice", path: "/game/dice", icon: Dices },
  { label: "Mines", path: "/game/mines", icon: Bomb },
  { label: "Crash", path: "/game/crash", icon: Rocket },
  { label: "Roulette", path: "/game/roulette", icon: CircleDot },
  { label: "Plinko", path: "/game/plinko", icon: Triangle },
  { type: "divider" as const },
  { label: "Slots", path: "/casino/slots", icon: Cherry },
  { label: "Blackjack", path: "/casino/blackjack", icon: Spade },
  { label: "Poker", path: "/casino/poker", icon: Diamond },
  { label: "Baccarat", path: "/casino/baccarat", icon: Clover },
  { label: "Canlı Casino", path: "/casino/live", icon: Zap },
  { type: "divider" as const },
  { label: "VIP Kulüp", path: "/vip", icon: Crown },
  { label: "Promosyonlar", path: "/casino/promotions", icon: Gift },
  { label: "Tüm Oyunlar", path: "/casino/all", icon: Layers },
  { type: "divider" as const },
  { label: "SSS", path: "/faq", icon: HelpCircle },
] as const;

/* ─── VIP Tier Colors ─── */
const VIP_TIER_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  bronze: { bg: "bg-orange-900/30", text: "text-orange-400", bar: "bg-orange-500" },
  silver: { bg: "bg-gray-700/30", text: "text-gray-300", bar: "bg-gray-400" },
  gold: { bg: "bg-yellow-900/30", text: "text-yellow-400", bar: "bg-yellow-500" },
  platinum: { bg: "bg-cyan-900/30", text: "text-cyan-400", bar: "bg-cyan-400" },
  diamond: { bg: "bg-blue-900/30", text: "text-blue-400", bar: "bg-blue-500" },
  elite: { bg: "bg-purple-900/30", text: "text-purple-400", bar: "bg-purple-500" },
};

const VIP_TIER_LABELS: Record<string, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
  diamond: "Diamond",
  elite: "Elite",
};

/* ─── TopBar ─── */
function TopBar({ onMenuToggle }: { onMenuToggle: () => void }) {
  const { user, isAuthenticated, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { section, setSection } = useSection();
  const { theme, toggleTheme } = useTheme();
  const { formatAmount } = useCurrency();
  const balanceQuery = trpc.balance.get.useQuery(undefined, { enabled: isAuthenticated });
  const vipQuery = trpc.vip.profile.useQuery(undefined, { enabled: isAuthenticated });

  const vipData = vipQuery.data;
  const tierColors = vipData ? (VIP_TIER_COLORS[vipData.currentTier] ?? VIP_TIER_COLORS.bronze) : null;
  const tierLabel = vipData ? (VIP_TIER_LABELS[vipData.currentTier] ?? "Bronze") : null;

  return (
    <header className="border-b border-border bg-card/80 backdrop-blur-md shrink-0 z-30">
      <div className="h-14 flex items-center px-3 sm:px-4 gap-2 sm:gap-3">
      {/* Mobile hamburger */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Logo - icon only on mobile, full on sm+ */}
      <div className="flex items-center cursor-pointer shrink-0" onClick={() => setLocation("/")}>
        <span className="sm:hidden"><DopaminMoleculeIcon size={22} /></span>
        <span className="hidden sm:inline-flex"><DopaminLogo /></span>
      </div>

      {/* Casino / Spor Toggle */}
      <div className="flex items-center bg-secondary rounded-lg p-0.5 shrink-0">
        <button
          onClick={() => { setSection("casino"); setLocation("/casino"); }}
          className={`px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-md text-[11px] sm:text-sm font-semibold transition-all duration-200 ${
            section === "casino"
              ? "dp-gradient-bg text-white shadow-sm dp-glow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Dice1 className="h-4 w-4 hidden sm:inline-block mr-1" /> Casino
        </button>
        <button
          onClick={() => { setSection("sports"); setLocation("/"); }}
          className={`px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-md text-[11px] sm:text-sm font-semibold transition-all duration-200 ${
            section === "sports"
              ? "dp-gradient-bg text-white shadow-sm dp-glow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Trophy className="h-4 w-4 hidden sm:inline-block mr-1" /> Spor
        </button>
      </div>

      {/* Center nav links - hidden on mobile, visible on md+ */}
      <nav className="hidden md:flex items-center gap-1 flex-1 ml-2">
        {section === "sports" ? (
          <>
            <NavLink path="/sports" label="Sporlar" />
            <NavLink path="/live" label="Canlı" />
            <NavLink path="/my-bets" label="Kuponlarım" />
            <NavLink path="/assistant" label="AI Asistan" />
          </>
        ) : (
          <>
            <NavLink path="/casino" label="Lobi" />
            <NavLink path="/casino/slots" label="Slots" />
            <NavLink path="/casino/live" label="Canlı Casino" />
            <NavLink path="/casino/promotions" label="Promosyonlar" />
          </>
        )}
      </nav>

      <div className="flex-1 md:hidden" />

      {/* Right side */}
      <div className="flex items-center gap-1 sm:gap-2">
        {/* Currency selector */}
        <CurrencySelector />
        {/* Theme toggle - hidden on mobile */}
        <button
          onClick={toggleTheme}
          className="hidden sm:flex p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title={theme === "dark" ? "Açık Tema" : "Koyu Tema"}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        {isAuthenticated ? (
          <>
            {balanceQuery.data && (
              <button
                onClick={() => setLocation("/wallet")}
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-md bg-secondary hover:bg-accent transition-colors"
              >
                <Wallet className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs sm:text-sm font-semibold text-foreground">
                  {formatAmount(balanceQuery.data.amount)}
                </span>
              </button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setLocation("/profile")} className="text-muted-foreground hover:text-foreground hidden sm:flex">
              <User className="h-4 w-4" />
            </Button>
            {user?.role === "admin" && (
              <Button variant="ghost" size="sm" onClick={() => setLocation("/admin")} className="text-muted-foreground hover:text-foreground hidden sm:flex">
                <LayoutDashboard className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground hover:text-destructive hidden sm:flex">
              <LogOut className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            onClick={() => { window.location.href = getLoginUrl(); }}
            className="dp-gradient-bg hover:opacity-90 text-white font-semibold text-[11px] sm:text-sm px-2.5 sm:px-3 dp-glow-sm"
          >
            Giriş
          </Button>
        )}
      </div>
      </div>

      {/* VIP Progress Bar - visible when authenticated */}
      {isAuthenticated && vipData && tierColors && tierLabel && (
        <div
          className="h-7 border-t border-border/50 flex items-center px-3 sm:px-4 gap-3 cursor-pointer hover:bg-accent/30 transition-colors"
          onClick={() => setLocation("/vip")}
        >
          <div className="flex items-center gap-1.5">
            <Crown className={`h-3 w-3 ${tierColors.text}`} />
            <span className={`text-[11px] font-bold ${tierColors.text} uppercase tracking-wide`}>
              {tierLabel}
            </span>
          </div>

          <div className="flex-1 flex items-center gap-2 max-w-xs">
            <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className={`h-full ${tierColors.bar} rounded-full transition-all duration-500`}
                style={{ width: `${vipData.progress}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground font-medium whitespace-nowrap">
              {vipData.totalXp.toLocaleString()} XP
            </span>
          </div>

          {vipData.nextTierInfo && (
            <span className="text-[10px] text-muted-foreground hidden sm:block whitespace-nowrap">
              Sonraki: <span className={`font-semibold ${(VIP_TIER_COLORS[vipData.nextTierInfo.name] ?? VIP_TIER_COLORS.bronze).text}`}>
                {VIP_TIER_LABELS[vipData.nextTierInfo.name] ?? vipData.nextTierInfo.name}
              </span>
              {" "}({vipData.xpForNextTier.toLocaleString()} XP)
            </span>
          )}
        </div>
      )}
    </header>
  );
}

function NavLink({ path, label }: { path: string; label: string }) {
  const [location] = useLocation();
  const [, setLocation] = useLocation();
  const isActive = location === path;

  return (
    <button
      onClick={() => setLocation(path)}
      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
        isActive ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
      }`}
    >
      {label}
    </button>
  );
}

/* ─── Desktop Sidebar ─── */
function DesktopSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const [location] = useLocation();
  const [, setLocation] = useLocation();
  const { section, selectedLeague, setSelectedLeague } = useSection();
  const sportsQuery = trpc.sports.list.useQuery(undefined, { enabled: section === "sports" });

  // Group sports by category
  const sportGroups = useMemo(() => {
    if (!sportsQuery.data) return {};
    const groups: Record<string, typeof sportsQuery.data> = {};
    for (const s of sportsQuery.data) {
      if (!groups[s.groupName]) groups[s.groupName] = [];
      groups[s.groupName].push(s);
    }
    return groups;
  }, [sportsQuery.data]);

  if (section === "casino") {
    // Casino sidebar - static items
    const items = CASINO_ITEMS;
    return (
      <aside className={`hidden lg:flex flex-col border-r border-border bg-sidebar shrink-0 transition-all duration-200 ${collapsed ? "w-14" : "w-52"}`}>
        <div className="flex items-center justify-end p-2">
          <button onClick={onToggle} className="p-1 rounded hover:bg-sidebar-accent text-muted-foreground hover:text-foreground transition-colors">
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
          {items.map((item, i) => {
            if ("type" in item && item.type === "divider") {
              return <div key={`div-${i}`} className="my-2 border-t border-sidebar-border" />;
            }
            const navItem = item as { label: string; path: string; icon: any };
            const Icon = navItem.icon;
            const isActive = location === navItem.path || (navItem.path !== "/" && location.startsWith(navItem.path));
            return (
              <button key={navItem.path} onClick={() => setLocation(navItem.path)}
                className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-sm transition-all duration-200 ${isActive ? "bg-primary/15 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50"}`}
                title={collapsed ? navItem.label : undefined}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : ""}`} />
                {!collapsed && <span className="truncate">{navItem.label}</span>}
              </button>
            );
          })}
        </nav>
      </aside>
    );
  }

  // Sports sidebar - dynamic leagues
  return (
    <aside className={`hidden lg:flex flex-col border-r border-border bg-sidebar shrink-0 transition-all duration-200 ${collapsed ? "w-14" : "w-52"}`}>
      <div className="flex items-center justify-end p-2">
        <button onClick={onToggle} className="p-1 rounded hover:bg-sidebar-accent text-muted-foreground hover:text-foreground transition-colors">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        {/* Top nav */}
        {SPORT_NAV_TOP.map((item) => {
          const Icon = item.icon;
          const isActive = item.path === "/" ? location === "/" : location.startsWith(item.path);
          const isLeagueItem = "league" in item;
          const isLeagueActive = isLeagueItem && location === "/sports" && selectedLeague === null;
          return (
            <button key={item.path} onClick={() => {
              if (isLeagueItem) { setSelectedLeague(null); }
              setLocation(item.path);
            }}
              className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-sm transition-all duration-200 ${
                (isLeagueActive || (!isLeagueItem && isActive)) ? "bg-primary/15 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50"
              }`}
              title={collapsed ? item.label : undefined}
            >
              <Icon className={`h-4 w-4 shrink-0 ${(isLeagueActive || (!isLeagueItem && isActive)) ? "text-primary" : ""}`} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}

        {/* Dynamic leagues by group */}
        {!collapsed && Object.entries(sportGroups).map(([group, sports]) => (
          <div key={group} className="mt-3">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider px-2.5 mb-1 font-semibold">
              {group}
            </div>
            {(sports ?? []).map((s) => {
              const isActive = location === "/sports" && selectedLeague === s.sportKey;
              const GroupIcon = SPORT_GROUP_ICONS[group] || Activity;
              return (
                <button key={s.sportKey} onClick={() => { setSelectedLeague(s.sportKey); setLocation("/sports"); }}
                  className={`w-full flex items-center gap-3 px-2.5 py-1.5 rounded-md text-[13px] transition-all duration-200 ${
                    isActive ? "bg-primary/15 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50"
                  }`}
                >
                  {collapsed ? <GroupIcon className="h-4 w-4 shrink-0" /> : (
                    <>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? "bg-primary" : "bg-muted-foreground/30"}`} />
                      <span className="truncate">{s.title}</span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        ))}

        {/* Bottom nav */}
        <div className="mt-3 pt-3 border-t border-sidebar-border space-y-0.5">
          {SPORT_NAV_BOTTOM.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;
            return (
              <button key={item.path} onClick={() => setLocation(item.path)}
                className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-sm transition-all duration-200 ${isActive ? "bg-primary/15 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50"}`}
                title={collapsed ? item.label : undefined}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : ""}`} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}

/* ─── Mobile Sidebar (Slide-over) ─── */
function MobileSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [location] = useLocation();
  const [, setLocation] = useLocation();
  const { section } = useSection();
  const { user, isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { selectedLeague, setSelectedLeague } = useSection();
  const sportsQuery = trpc.sports.list.useQuery(undefined, { enabled: section === "sports" });
  const items = CASINO_ITEMS;

  // Lock body scroll when sidebar is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Close sidebar on route change
  useEffect(() => {
    onClose();
  }, [location]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="lg:hidden fixed inset-0 z-[58] bg-black/60 backdrop-blur-sm"
          />

          {/* Sidebar panel */}
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="lg:hidden fixed inset-y-0 left-0 z-[59] w-[280px] max-w-[85vw] bg-sidebar border-r border-border flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <DopaminLogo />
              <button onClick={onClose} className="p-1.5 rounded-md hover:bg-sidebar-accent text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Quick nav links (mobile only) */}
            <div className="px-3 py-3 border-b border-border space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 mb-2 font-semibold">Hızlı Erişim</p>
              {section === "sports" ? (
                <>
                  <MobileSidebarLink path="/sports" label="📊 Tüm Maçlar" location={location} setLocation={setLocation} onClick={() => setSelectedLeague(null)} />
                  <MobileSidebarLink path="/live" label="📡 Canlı Skorlar" location={location} setLocation={setLocation} />
                  <MobileSidebarLink path="/my-bets" label="🎫 Kuponlarım" location={location} setLocation={setLocation} />
                  <MobileSidebarLink path="/wallet" label="💰 Cüzdan" location={location} setLocation={setLocation} />
                  <MobileSidebarLink path="/assistant" label="🤖 AI Asistan" location={location} setLocation={setLocation} />
                </>
              ) : (
                <>
                  <MobileSidebarLink path="/casino" label="🎰 Casino Lobi" location={location} setLocation={setLocation} />
                  <MobileSidebarLink path="/casino/slots" label="🍒 Slots" location={location} setLocation={setLocation} />
                  <MobileSidebarLink path="/casino/live" label="⚡ Canlı Casino" location={location} setLocation={setLocation} />
                  <MobileSidebarLink path="/my-bets" label="🎫 Kuponlarım" location={location} setLocation={setLocation} />
                  <MobileSidebarLink path="/wallet" label="💰 Cüzdan" location={location} setLocation={setLocation} />
                </>
              )}
            </div>

            {/* Main sidebar items */}
            <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
              {section === "sports" && sportsQuery.data ? (
                <>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 mb-2 font-semibold">Ligler</p>
                  {(() => {
                    const groups: Record<string, typeof sportsQuery.data> = {};
                    for (const s of sportsQuery.data!) {
                      if (!groups[s.groupName]) groups[s.groupName] = [];
                      groups[s.groupName]!.push(s);
                    }
                    return Object.entries(groups).map(([group, sports]) => (
                      <div key={group} className="mb-2">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider px-2.5 mb-1 font-semibold">{group}</div>
                        {(sports ?? []).map((s) => {
                          const isActive = location === "/sports" && selectedLeague === s.sportKey;
                          return (
                            <button key={s.sportKey} onClick={() => { setSelectedLeague(s.sportKey); setLocation("/sports"); }}
                              className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-sm transition-all duration-200 ${
                                isActive ? "bg-primary/15 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50"
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? "bg-primary" : "bg-muted-foreground/30"}`} />
                              <span className="truncate">{s.title}</span>
                            </button>
                          );
                        })}
                      </div>
                    ));
                  })()}
                </>
              ) : (
                <>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 mb-2 font-semibold">Casino Oyunları</p>
                  {items.map((item, i) => {
                    if ("type" in item && item.type === "divider") {
                      return <div key={`div-${i}`} className="my-2 border-t border-sidebar-border" />;
                    }
                    const navItem = item as { label: string; path: string; icon: any };
                    const Icon = navItem.icon;
                    const isActive = location === navItem.path || (navItem.path !== "/" && location.startsWith(navItem.path));
                    return (
                      <button key={navItem.path} onClick={() => setLocation(navItem.path)}
                        className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-md text-sm transition-all duration-200 ${
                          isActive ? "bg-primary/15 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50"
                        }`}
                      >
                        <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : ""}`} />
                        <span className="truncate">{navItem.label}</span>
                      </button>
                    );
                  })}
                </>
              )}
            </nav>

            {/* Footer - user info & actions */}
            <div className="border-t border-border p-3 space-y-2">
              {/* Theme toggle for mobile */}
              <button
                onClick={toggleTheme}
                className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 transition-colors sm:hidden"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                <span>{theme === "dark" ? "Açık Tema" : "Koyu Tema"}</span>
              </button>
              {isAuthenticated ? (
                <>
                  <button
                    onClick={() => setLocation("/profile")}
                    className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 transition-colors"
                  >
                    <User className="h-4 w-4" />
                    <span>Profilim</span>
                  </button>
                  {user?.role === "admin" && (
                    <button
                      onClick={() => setLocation("/admin")}
                      className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 transition-colors"
                    >
                      <LayoutDashboard className="h-4 w-4" />
                      <span>Admin Paneli</span>
                    </button>
                  )}
                  <button
                    onClick={() => { logout(); onClose(); }}
                    className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-md text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Çıkış Yap</span>
                  </button>
                </>
              ) : (
                <Button
                  className="w-full dp-gradient-bg hover:opacity-90 text-white font-semibold dp-glow-sm"
                  onClick={() => { window.location.href = getLoginUrl(); }}
                >
                  Giriş Yap
                </Button>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function MobileSidebarLink({ path, label, location, setLocation, onClick }: { path: string; label: string; location: string; setLocation: (p: string) => void; onClick?: () => void }) {
  const isActive = location === path;
  return (
    <button
      onClick={() => { onClick?.(); setLocation(path); }}
      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-sm transition-colors ${
        isActive ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50"
      }`}
    >
      {label}
    </button>
  );
}

/* ─── Mobile Bottom Nav ─── */
function MobileNav() {
  const [location] = useLocation();
  const [, setLocation] = useLocation();
  const { section } = useSection();

  const sportsItems = [
    { label: "Ana Sayfa", path: "/", icon: Home },
    { label: "Sporlar", path: "/sports", icon: Activity },
    { label: "Canlı", path: "/live", icon: Radio },
    { label: "Kuponlarım", path: "/my-bets", icon: Ticket },
    { label: "Cüzdan", path: "/wallet", icon: Wallet },
  ];

  const casinoItems = [
    { label: "Lobi", path: "/casino", icon: Home },
    { label: "Slots", path: "/casino/slots", icon: Cherry },
    { label: "Canlı", path: "/casino/live", icon: Zap },
    { label: "Kuponlarım", path: "/my-bets", icon: Ticket },
    { label: "Cüzdan", path: "/wallet", icon: Wallet },
  ];

  const items = section === "sports" ? sportsItems : casinoItems;

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/90 backdrop-blur-md">
      <div className="flex items-center justify-around h-14">
        {items.map(item => {
          const isActive = location === item.path;
          return (
            <button
              key={item.path}
              onClick={() => setLocation(item.path)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 text-[11px] font-medium transition-all duration-200 ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <item.icon className={`h-5 w-5 ${isActive ? "text-primary drop-shadow-[0_0_6px_var(--dp-purple)]" : ""}`} />
              {item.label}
            </button>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}

/* ─── Right Bet Slip (Desktop) ─── */
function RightBetSlip() {
  const { selections, removeSelection, clearSelections, totalOdds, isOpen } = useBetSlip();
  const { isAuthenticated } = useAuth();
  const { formatAmount, currencySymbol } = useCurrency();
  const [stake, setStake] = useState("");
  const utils = trpc.useUtils();

  const placeBet = trpc.bets.place.useMutation({
    onSuccess: (data) => {
      const { toast } = require("sonner");
      toast.success(`Kupon oluşturuldu! Kazanç: ${formatAmount(data.potentialWin)}`);
      clearSelections();
      setStake("");
      utils.balance.get.invalidate();
      utils.bets.myBets.invalidate();
    },
    onError: (err: any) => {
      const { toast } = require("sonner");
      toast.error(err.message || "Kupon oluşturulamadı");
    },
  });

  const stakeNum = parseFloat(stake) || 0;
  const potentialWin = stakeNum * totalOdds;

  if (selections.length === 0 && !isOpen) return null;

  return (
    <div className="w-72 shrink-0 hidden xl:block">
      <div className="sticky top-14 border-l border-border bg-card h-[calc(100vh-3.5rem)] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Ticket className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Kupon</span>
            {selections.length > 0 && (
              <span className="bg-primary text-primary-foreground text-xs font-bold px-1.5 py-0.5 rounded-full">{selections.length}</span>
            )}
          </div>
          {selections.length > 0 && (
            <button onClick={clearSelections} className="text-muted-foreground hover:text-destructive transition-colors">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {selections.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm text-muted-foreground">Bahis eklemek için oranlara tıklayın</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-border">
              {selections.map((sel) => (
                <div key={`${sel.eventId}-${sel.marketKey}-${sel.outcomeName}`} className="px-4 py-3 hover:bg-accent/30 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-muted-foreground mb-0.5">
                        {sel.marketKey === "h2h" ? "Maç Sonucu" : sel.marketKey === "spreads" ? "Handikap" : "Alt/Üst"}
                      </div>
                      <div className="text-sm font-semibold text-foreground truncate">
                        {sel.outcomeName}
                        {sel.point !== undefined && ` (${sel.point > 0 ? "+" : ""}${sel.point})`}
                      </div>
                      <div className="text-xs text-muted-foreground truncate mt-0.5">{sel.homeTeam} vs {sel.awayTeam}</div>
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

            <div className="p-4 border-t border-border space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Toplam Oran</span>
                <span className="font-bold text-foreground">{totalOdds.toFixed(2)}</span>
              </div>
              <input
                type="number"
                placeholder={`Bahis tutarı (${currencySymbol})`}
                value={stake}
                onChange={e => setStake(e.target.value)}
                min="1"
                className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="flex gap-1.5">
                {[10, 25, 50, 100].map(v => (
                  <button key={v} onClick={() => setStake(v.toString())} className="flex-1 py-1.5 text-xs font-medium border border-border rounded hover:bg-accent hover:text-foreground transition-colors text-muted-foreground">
                    {formatAmount(v)}
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
                className="w-full dp-gradient-bg hover:opacity-90 text-white font-semibold dp-glow-sm disabled:opacity-50"
                disabled={!isAuthenticated || stakeNum < 1 || placeBet.isPending}
                onClick={() => {
                  placeBet.mutate({
                    type: selections.length > 1 ? "combo" : "single",
                    stake: stakeNum,
                    items: selections.map(s => ({
                      eventId: s.eventId, sportKey: s.sportKey, homeTeam: s.homeTeam,
                      awayTeam: s.awayTeam, commenceTime: s.commenceTime, marketKey: s.marketKey,
                      outcomeName: s.outcomeName, outcomePrice: s.outcomePrice, point: s.point,
                    })),
                  });
                }}
              >
                {!isAuthenticated ? "Giriş Yapın" : "Kupon Oluştur"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Mobile Bet Slip ─── */
function MobileBetSlip() {
  const { selections, removeSelection, clearSelections, totalOdds } = useBetSlip();
  const { isAuthenticated } = useAuth();
  const { formatAmount, currencySymbol } = useCurrency();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [stake, setStake] = useState("");
  const utils = trpc.useUtils();

  const placeBet = trpc.bets.place.useMutation({
    onSuccess: (data) => {
      const { toast } = require("sonner");
      toast.success(`Kupon oluşturuldu! Kazanç: ${formatAmount(data.potentialWin)}`);
      clearSelections();
      setStake("");
      setMobileOpen(false);
      utils.balance.get.invalidate();
      utils.bets.myBets.invalidate();
    },
    onError: (err: any) => {
      const { toast } = require("sonner");
      toast.error(err.message || "Kupon oluşturulamadı");
    },
  });

  const stakeNum = parseFloat(stake) || 0;
  const potentialWin = stakeNum * totalOdds;

  return (
    <>
      <AnimatePresence>
        {selections.length > 0 && !mobileOpen && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            onClick={() => setMobileOpen(true)}
            className="xl:hidden fixed bottom-[5.5rem] right-20 z-[46] w-14 h-14 rounded-full dp-gradient-bg text-white flex items-center justify-center shadow-lg dp-glow"
          >
            <Ticket className="h-6 w-6" />
            <span className="absolute -top-1 -right-1 bg-destructive text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {selections.length}
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {mobileOpen && selections.length > 0 && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)} className="xl:hidden fixed inset-0 z-[56] bg-black/60" />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="xl:hidden fixed bottom-0 left-0 right-0 z-[57] max-h-[80vh] rounded-t-xl bg-card border-t border-border overflow-hidden"
            >
              <div className="flex justify-center py-2"><div className="w-10 h-1 rounded-full bg-border" /></div>
              <div className="flex items-center justify-between px-4 py-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <Ticket className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Kupon ({selections.length})</span>
                </div>
                <button onClick={clearSelections} className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
              </div>
              <div className="overflow-y-auto max-h-[calc(80vh-8rem)]">
                <div className="divide-y divide-border">
                  {selections.map((sel) => (
                    <div key={`${sel.eventId}-${sel.marketKey}-${sel.outcomeName}`} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] text-muted-foreground">{sel.marketKey === "h2h" ? "Maç Sonucu" : sel.marketKey === "spreads" ? "Handikap" : "Alt/Üst"}</div>
                          <div className="text-sm font-semibold truncate">{sel.outcomeName}</div>
                          <div className="text-xs text-muted-foreground truncate">{sel.homeTeam} vs {sel.awayTeam}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-primary">{sel.outcomePrice.toFixed(2)}</span>
                          <button onClick={() => removeSelection(sel.eventId, sel.marketKey, sel.outcomeName)}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4 border-t border-border space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Toplam Oran</span>
                  <span className="font-bold">{totalOdds.toFixed(2)}</span>
                </div>
                <input type="number" placeholder={`Bahis tutarı (${currencySymbol})`} value={stake} onChange={e => setStake(e.target.value)} className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm focus:ring-1 focus:ring-primary focus:outline-none" />
                <div className="flex gap-1.5">
                  {[10, 25, 50, 100].map(v => (
                    <button key={v} onClick={() => setStake(v.toString())} className="flex-1 py-1.5 text-xs font-medium border border-border rounded hover:bg-accent text-muted-foreground">{formatAmount(v)}</button>
                  ))}
                </div>
                {stakeNum > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Potansiyel Kazanç</span>
                    <span className="font-bold text-primary">{formatAmount(potentialWin)}</span>
                  </div>
                )}
                <Button
                  className="w-full dp-gradient-bg hover:opacity-90 text-white font-semibold dp-glow-sm disabled:opacity-50"
                  disabled={!isAuthenticated || stakeNum < 1 || placeBet.isPending}
                  onClick={() => {
                    placeBet.mutate({
                      type: selections.length > 1 ? "combo" : "single",
                      stake: stakeNum,
                      items: selections.map(s => ({
                        eventId: s.eventId, sportKey: s.sportKey, homeTeam: s.homeTeam,
                        awayTeam: s.awayTeam, commenceTime: s.commenceTime, marketKey: s.marketKey,
                        outcomeName: s.outcomeName, outcomePrice: s.outcomePrice, point: s.point,
                      })),
                    });
                  }}
                >
                  {!isAuthenticated ? "Giriş Yapın" : "Kupon Oluştur"}
                </Button>
              </div>
              <div className="h-[env(safe-area-inset-bottom)]" />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

/* ─── Main Layout ─── */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [location] = useLocation();
  const [section, setSection] = useState<Section>(
    location.startsWith("/casino") ? "casino" : "sports"
  );
  const [selectedLeague, setSelectedLeague] = useState<string | null>(null);

  // Sync section with route
  const effectiveSection = location.startsWith("/casino") ? "casino" : section;

  return (
    <SectionContext.Provider value={{ section: effectiveSection, setSection, selectedLeague, setSelectedLeague }}>
      <div className="h-screen flex flex-col bg-background text-foreground">
        <TopBar onMenuToggle={() => setMobileSidebarOpen(prev => !prev)} />
        <div className="flex flex-1 overflow-hidden">
          <DesktopSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
          <main className="flex-1 overflow-y-auto pb-16 lg:pb-0 bg-background">
            <div className="mx-auto max-w-[1200px] lg:px-5 xl:px-8 lg:py-3">
              {children}
            </div>
          </main>
          <RightBetSlip />
        </div>
        <MobileNav />
        <MobileBetSlip />
        <MobileSidebar open={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} />
        <ChatWidget />
      </div>
    </SectionContext.Provider>
  );
}
