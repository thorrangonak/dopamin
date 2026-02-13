import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Send, X, Loader2, User, Trash2, MessageCircle } from "lucide-react";
import { Streamdown } from "streamdown";

interface Message {
  id?: number;
  role: "user" | "assistant";
  content: string;
}

export default function ChatWidget() {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch chat history
  const historyQuery = trpc.assistant.history.useQuery(undefined, {
    enabled: isAuthenticated && open && !historyLoaded,
  });

  // Load history into state when fetched
  useEffect(() => {
    if (historyQuery.data && !historyLoaded) {
      setMessages(historyQuery.data.map(m => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
      })));
      setHistoryLoaded(true);
    }
  }, [historyQuery.data, historyLoaded]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const chatMut = trpc.assistant.chat.useMutation({
    onSuccess: (data) => {
      setMessages(prev => [...prev, { role: "assistant", content: String(data.reply) }]);
    },
    onError: () => {
      setMessages(prev => [...prev, { role: "assistant", content: "Bir hata olustu. Lutfen tekrar deneyin." }]);
    },
  });

  const clearMut = trpc.assistant.clearHistory.useMutation({
    onSuccess: () => {
      setMessages([]);
      setHistoryLoaded(false);
    },
  });

  function handleSend() {
    if (!input.trim() || chatMut.isPending) return;
    const msg = input.trim();
    setMessages(prev => [...prev, { role: "user", content: msg }]);
    setInput("");
    chatMut.mutate({ message: msg });
  }

  // Don't render for unauthenticated users
  if (!isAuthenticated) return null;

  return (
    <>
      {/* Floating chat button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-20 lg:bottom-6 right-4 z-50 w-14 h-14 rounded-full dp-gradient-bg text-white flex items-center justify-center shadow-lg dp-glow hover:scale-105 transition-transform"
            title="AI Asistan"
          >
            <MessageCircle className="h-6 w-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed bottom-20 lg:bottom-6 right-4 z-50 w-[360px] max-w-[calc(100vw-2rem)] h-[500px] max-h-[calc(100vh-8rem)] rounded-xl bg-card border border-border shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg dp-gradient-bg flex items-center justify-center">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Dopamin AI</h3>
                  <span className="text-[10px] text-emerald-500 font-medium">Online</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => clearMut.mutate()}
                  disabled={clearMut.isPending || messages.length === 0}
                  className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
                  title="Sohbeti temizle"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Messages area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
              {/* Welcome message if no history */}
              {messages.length === 0 && !historyQuery.isLoading && (
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="bg-secondary/50 border border-border rounded-lg px-3 py-2.5 max-w-[85%]">
                    <p className="text-sm text-foreground leading-relaxed">
                      Merhaba! Ben Dopamin AI. Spor bahisleri, casino oyunlari, hesabiniz ve platform hakkinda her konuda yardimci olabilirim.
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {["Crash nasil oynanir?", "VIP sistemi nedir?", "Bahis onerileri"].map((s, i) => (
                        <button
                          key={i}
                          onClick={() => { setInput(s); inputRef.current?.focus(); }}
                          className="px-2.5 py-1 text-[11px] border border-border rounded-full text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {historyQuery.isLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : ""}`}>
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    </div>
                  )}
                  <div className={`max-w-[85%] px-3 py-2.5 rounded-lg ${
                    msg.role === "user"
                      ? "bg-dp-blue/10 border border-dp-blue/20 text-foreground"
                      : "bg-secondary/50 border border-border text-foreground"
                  }`}>
                    {msg.role === "assistant" ? (
                      <div className="text-sm leading-relaxed prose prose-invert prose-sm max-w-none [&>p]:m-0">
                        <Streamdown>{msg.content}</Streamdown>
                      </div>
                    ) : (
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-7 h-7 rounded-md bg-dp-blue/10 flex items-center justify-center shrink-0 mt-0.5">
                      <User className="h-3.5 w-3.5 text-dp-blue" />
                    </div>
                  )}
                </div>
              ))}

              {chatMut.isPending && (
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="bg-secondary/50 border border-border px-3 py-2.5 rounded-lg">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input area */}
            <div className="border-t border-border p-3 shrink-0">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Bir soru sorun..."
                  className="flex-1 px-3 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || chatMut.isPending}
                  className="px-3 py-2 rounded-lg dp-gradient-bg text-white hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
