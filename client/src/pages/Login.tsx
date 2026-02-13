import { useState } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import DopaminLogo from "@/components/DopaminLogo";
import { trpc } from "@/lib/trpc";

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      window.location.href = "/";
    },
    onError: (err) => {
      setError(err.message || "Giriş başarısız");
    },
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    loginMutation.mutate({ email, password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center dp-gradient-bg p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-8">
        <div className="flex justify-center mb-8">
          <DopaminLogo size="lg" />
        </div>

        <h1 className="text-2xl font-bold text-foreground text-center mb-2">Giris Yap</h1>
        <p className="text-sm text-muted-foreground text-center mb-6">
          Hesabiniza giris yaparak devam edin
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
            <label className="block text-sm font-medium text-foreground mb-1.5">Sifre</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-4 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive text-center font-medium">{error}</p>
          )}

          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="w-full py-3 rounded-lg dp-gradient-bg text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 dp-glow-sm"
          >
            {loginMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Giris Yap
          </button>
        </form>

        <p className="text-sm text-muted-foreground text-center mt-6">
          Hesabin yok mu?{" "}
          <button
            onClick={() => setLocation("/register")}
            className="text-primary font-semibold hover:underline"
          >
            Kayit Ol
          </button>
        </p>
      </div>
    </div>
  );
}
