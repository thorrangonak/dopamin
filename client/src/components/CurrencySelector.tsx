import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";

export default function CurrencySelector() {
  const { currency, setCurrency, currencyList } = useCurrency();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors text-xs font-medium"
      >
        <span>{currency.symbol}</span>
        <span className="hidden sm:inline">{currency.code}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="max-h-72 overflow-y-auto py-1">
            {currencyList.map((c) => (
              <button
                key={c.code}
                onClick={() => {
                  setCurrency(c.code);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                  currency.code === c.code
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-accent/50"
                }`}
              >
                <span className="w-5 text-center font-medium">{c.symbol}</span>
                <span className="font-medium">{c.code}</span>
                <span className="text-xs text-muted-foreground flex-1 truncate">{c.name}</span>
                {currency.code === c.code && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
