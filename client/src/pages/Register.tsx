import { useState } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import DopaminLogo from "@/components/DopaminLogo";

export default function Register() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== passwordConfirm) {
      setError("Şifreler eşleşmiyor");
      return;
    }

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

        <h1 className="text-2xl font-bold text-foreground text-center mb-2">Kayıt Ol</h1>
        <p className="text-sm text-muted-foreground text-center mb-6">
          Kripto ile bahis dünyasına katılın
        </p>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Kullanıcı Adı</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="kullaniciadi"
              required
              className="w-full px-4 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />
          </div>

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
              minLength={6}
              className="w-full px-4 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Şifre Tekrar</label>
            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="w-full px-4 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive text-center font-medium">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg dp-gradient-bg text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 dp-glow-sm"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Kayıt Ol
          </button>
        </form>

        <p className="text-sm text-muted-foreground text-center mt-6">
          Zaten hesabın var?{" "}
          <button
            onClick={() => setLocation("/login")}
            className="text-primary font-semibold hover:underline"
          >
            Giriş Yap
          </button>
        </p>
      </div>
    </div>
  );
}
