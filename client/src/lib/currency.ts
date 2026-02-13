export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
  rate: number;
  decimals: number;
  position: "before" | "after";
}

export const CURRENCIES: Record<string, CurrencyInfo> = {
  USD: { code: "USD", symbol: "$", name: "US Dollar", rate: 1, decimals: 2, position: "before" },
  EUR: { code: "EUR", symbol: "€", name: "Euro", rate: 0.92, decimals: 2, position: "before" },
  GBP: { code: "GBP", symbol: "£", name: "British Pound", rate: 0.79, decimals: 2, position: "before" },
  TRY: { code: "TRY", symbol: "₺", name: "Türk Lirası", rate: 32.5, decimals: 2, position: "after" },
  CNY: { code: "CNY", symbol: "¥", name: "Chinese Yuan", rate: 7.25, decimals: 2, position: "before" },
  BRL: { code: "BRL", symbol: "R$", name: "Brazilian Real", rate: 5.05, decimals: 2, position: "before" },
  JPY: { code: "JPY", symbol: "¥", name: "Japanese Yen", rate: 150.5, decimals: 0, position: "before" },
  RUB: { code: "RUB", symbol: "₽", name: "Russian Ruble", rate: 92, decimals: 2, position: "after" },
  INR: { code: "INR", symbol: "₹", name: "Indian Rupee", rate: 83.5, decimals: 2, position: "before" },
  KRW: { code: "KRW", symbol: "₩", name: "Korean Won", rate: 1340, decimals: 0, position: "before" },
  USDT: { code: "USDT", symbol: "₮", name: "Tether", rate: 1, decimals: 2, position: "after" },
};

export const CURRENCY_LIST = Object.values(CURRENCIES);

const STORAGE_KEY = "display_currency";

export function getStoredCurrency(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || "USD";
  } catch {
    return "USD";
  }
}

export function setStoredCurrency(code: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {}
}

export interface FormatOpts {
  showSign?: boolean;
}

export function formatAmount(
  usdtAmount: number | string,
  currencyCode: string,
  opts?: FormatOpts,
): string {
  const amount = typeof usdtAmount === "string" ? parseFloat(usdtAmount) : usdtAmount;
  if (isNaN(amount)) return "0";

  const currency = CURRENCIES[currencyCode] || CURRENCIES.USD;
  const converted = amount * currency.rate;
  const formatted = converted.toFixed(currency.decimals);

  const sign = opts?.showSign && converted > 0 ? "+" : "";

  if (currency.position === "before") {
    return `${sign}${currency.symbol}${formatted}`;
  }
  return `${sign}${formatted} ${currency.symbol}`;
}
