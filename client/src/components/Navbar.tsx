import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { Wallet, Ticket, Bot, LogOut, Menu, X, LayoutDashboard, Radio, Activity } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import DopaminLogo from "@/components/DopaminLogo";
import { useCurrency } from "@/contexts/CurrencyContext";

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { formatAmount } = useCurrency();
  const balanceQuery = trpc.balance.get.useQuery(undefined, { enabled: isAuthenticated });

  const navItems = [
    { label: "Sporlar", path: "/sports", icon: Activity },
    { label: "Canli Skor", path: "/live", icon: Radio },
    { label: "Kuponlarim", path: "/my-bets", icon: Ticket },
    { label: "Cuzdan", path: "/wallet", icon: Wallet },
    { label: "AI Asistan", path: "/assistant", icon: Bot },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-border/50 backdrop-blur-md bg-card/80">
      <div className="container flex items-center justify-between h-14">
        <div className="flex items-center cursor-pointer" onClick={() => setLocation("/")}>
          <DopaminLogo />
        </div>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {navItems.map(item => (
            <Button
              key={item.path}
              variant="ghost"
              size="sm"
              onClick={() => setLocation(item.path)}
              className={`text-sm font-medium ${location === item.path ? "text-primary bg-primary/10" : "text-foreground hover:text-primary"}`}
            >
              <item.icon className="h-4 w-4 mr-1.5" />
              {item.label}
            </Button>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          {isAuthenticated ? (
            <>
              {balanceQuery.data && (
                <div className="flex items-center gap-1.5 px-3 py-1 border border-dp-blue/30 rounded-md bg-dp-blue/5 cursor-pointer" onClick={() => setLocation("/wallet")}>
                  <Wallet className="h-3.5 w-3.5 text-dp-blue" />
                  <span className="text-sm font-semibold text-dp-blue">
                    {formatAmount(balanceQuery.data.amount)}
                  </span>
                </div>
              )}
              {user?.role === "admin" && (
                <Button variant="ghost" size="sm" onClick={() => setLocation("/admin")} className="text-dp-green hover:text-dp-green">
                  <LayoutDashboard className="h-4 w-4 mr-1" /> Admin
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground hover:text-destructive">
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => { window.location.href = getLoginUrl(); }} className="dp-gradient-bg hover:opacity-90 text-white font-semibold dp-glow-sm">
              Giris Yap
            </Button>
          )}
        </div>

        {/* Mobile menu toggle */}
        <Button variant="ghost" size="sm" className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border/50 bg-card/95 backdrop-blur-md p-4 space-y-2">
          {navItems.map(item => (
            <Button
              key={item.path}
              variant="ghost"
              className={`w-full justify-start text-sm ${location === item.path ? "text-primary bg-primary/10" : ""}`}
              onClick={() => { setLocation(item.path); setMobileOpen(false); }}
            >
              <item.icon className="h-4 w-4 mr-2" />
              {item.label}
            </Button>
          ))}
          {isAuthenticated && balanceQuery.data && (
            <div className="flex items-center gap-2 px-3 py-2 border border-dp-blue/30 rounded-md">
              <Wallet className="h-4 w-4 text-dp-blue" />
              <span className="text-sm text-dp-blue font-semibold">{formatAmount(balanceQuery.data.amount)}</span>
            </div>
          )}
          {isAuthenticated && (
            <Button variant="ghost" className="w-full justify-start text-destructive" onClick={logout}>
              <LogOut className="h-4 w-4 mr-2" /> Cikis Yap
            </Button>
          )}
        </div>
      )}
    </nav>
  );
}
