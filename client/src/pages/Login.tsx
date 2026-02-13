import { useState } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import DopaminLogo from "@/components/DopaminLogo";

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Demo: call dev-login to create session, then redirect
    window.location.href = "/dev-login";
  };

  return (
    <div className="min-h-screen flex items-center justify-center dp-gradient-bg p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-8">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <DopaminLogo size="lg" />
        </div>

        <h1 className="text-2xl font-bold text-foreground text-center mb-2">Giriş Yap</h1>
        <p className="text-sm text-muted-foreground text-center mb-6">
          Hesabınıza giriş yaparak devam edin
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">E-posta</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ornek@email.com"
              required
              className="w-full px-4 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Şifre</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-4 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg dp-gradient-bg text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 dp-glow-sm"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Giriş Yap
          </button>
        </form>

        <p className="text-sm text-muted-foreground text-center mt-6">
          Hesabın yok mu?{" "}
          <button
            onClick={() => setLocation("/register")}
            className="text-primary font-semibold hover:underline"
          >
            Kayıt Ol
          </button>
        </p>
      </div>
    </div>
  );
}
