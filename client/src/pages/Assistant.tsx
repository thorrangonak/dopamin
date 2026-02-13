import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Bot, Send, Loader2, User } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { getLoginUrl } from "@/const";
import { Streamdown } from "streamdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function Assistant() {
  const { isAuthenticated, loading } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const historyQuery = trpc.assistant.history.useQuery(undefined, {
    enabled: isAuthenticated && !historyLoaded,
  });

  useEffect(() => {
    if (historyQuery.data && !historyLoaded) {
      if (historyQuery.data.length > 0) {
        setMessages(historyQuery.data.map(m => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })));
      } else {
        setMessages([
          { role: "assistant", content: "Merhaba! Ben Dopamin AI Asistani. Spor bahisleri hakkinda sorularinizi yanitlayabilir, takim analizleri yapabilir ve bahis onerilerinde bulunabilirim. Nasil yardimci olabilirim?" },
        ]);
      }
      setHistoryLoaded(true);
    }
  }, [historyQuery.data, historyLoaded]);

  const askMut = trpc.assistant.chat.useMutation({
    onSuccess: (data) => {
      setMessages(prev => [...prev, { role: "assistant" as const, content: String(data.reply) }]);
    },
    onError: () => {
      setMessages(prev => [...prev, { role: "assistant", content: "Uzgunum, bir hata olustu. Lutfen tekrar deneyin." }]);
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    if (!input.trim() || askMut.isPending) return;
    const msg = input.trim();
    setMessages(prev => [...prev, { role: "user", content: msg }]);
    setInput("");
    askMut.mutate({ message: msg });
  }

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-20 p-4">
        <Bot className="h-10 w-10 text-muted-foreground mb-4" />
        <h2 className="text-lg font-bold mb-2 text-foreground">Giriş Gerekli</h2>
        <p className="text-muted-foreground text-sm mb-4">AI Asistanı kullanmak için giriş yapın.</p>
        <Button onClick={() => { window.location.href = getLoginUrl(); }} className="dp-gradient-bg hover:opacity-90 text-white font-semibold dp-glow-sm">Giris Yap</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] p-4 md:p-6 max-w-3xl">
      <div className="flex items-center gap-2 mb-4">
        <Bot className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-bold text-foreground">AI Asistan</h1>
        <span className="text-xs text-primary px-2 py-0.5 bg-primary/10 rounded-full font-medium">Online</span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-primary" />
              </div>
            )}
            <div className={`max-w-[80%] px-4 py-3 rounded-lg ${
              msg.role === "user"
                ? "bg-dp-blue/10 border border-dp-blue/20 text-foreground"
                : "bg-card border border-border text-foreground"
            }`}>
              {msg.role === "assistant" ? (
                <div className="text-sm leading-relaxed prose prose-invert prose-sm max-w-none">
                  <Streamdown>{msg.content}</Streamdown>
                </div>
              ) : (
                <p className="text-sm leading-relaxed">{msg.content}</p>
              )}
            </div>
            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-md bg-dp-blue/10 flex items-center justify-center shrink-0">
                <User className="h-4 w-4 text-dp-blue" />
              </div>
            )}
          </div>
        ))}
        {askMut.isPending && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div className="bg-card border border-border px-4 py-3 rounded-lg">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleSend(); }}
          placeholder="Bir soru sorun..."
          className="flex-1 px-4 py-3 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <Button
          onClick={handleSend}
          disabled={!input.trim() || askMut.isPending}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-4"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {/* Suggestions */}
      <div className="flex gap-2 mt-3 flex-wrap">
        {[
          "Bugün hangi maçlara bahis önerirsin?",
          "Futbolda alt/üst stratejisi nedir?",
          "NBA'de handikap bahisleri nasıl çalışır?",
          "Sorumlu bahis hakkında bilgi ver",
        ].map((s, i) => (
          <button
            key={i}
            onClick={() => setInput(s)}
            className="px-3 py-1 text-xs border border-border rounded-full text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
