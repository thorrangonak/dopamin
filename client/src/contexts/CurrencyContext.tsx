import React, { createContext, useContext, useState, useCallback } from "react";
import {
  CURRENCIES,
  CURRENCY_LIST,
  formatAmount as rawFormatAmount,
  getStoredCurrency,
  setStoredCurrency,
  type CurrencyInfo,
  type FormatOpts,
} from "@/lib/currency";

interface CurrencyContextType {
  currency: CurrencyInfo;
  setCurrency: (code: string) => void;
  formatAmount: (amount: number | string, opts?: FormatOpts) => string;
  currencySymbol: string;
  currencyList: CurrencyInfo[];
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currencyCode, setCurrencyCode] = useState<string>(getStoredCurrency);

  const currency = CURRENCIES[currencyCode] || CURRENCIES.USD;

  const setCurrency = useCallback((code: string) => {
    setCurrencyCode(code);
    setStoredCurrency(code);
  }, []);

  const formatAmount = useCallback(
    (amount: number | string, opts?: FormatOpts) => rawFormatAmount(amount, currencyCode, opts),
    [currencyCode],
  );

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        setCurrency,
        formatAmount,
        currencySymbol: currency.symbol,
        currencyList: CURRENCY_LIST,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error("useCurrency must be used within CurrencyProvider");
  }
  return context;
}
