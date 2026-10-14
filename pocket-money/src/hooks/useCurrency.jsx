import { createContext, useContext } from "react";
import { formatMoney } from "../lib/money";

const CurrencyContext = createContext("GBP");

export function CurrencyProvider({ currency, children }) {
  return <CurrencyContext.Provider value={currency || "GBP"}>{children}</CurrencyContext.Provider>;
}

// Returns a money(pence) formatter bound to the current family's currency,
// so components never need to know the currency themselves.
export function useMoney() {
  const currency = useContext(CurrencyContext);
  return (pence) => formatMoney(pence, currency);
}
