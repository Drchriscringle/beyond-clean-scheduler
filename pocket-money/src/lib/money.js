export function formatMoney(pence, currency = "GBP") {
  const amount = (pence || 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `£${amount.toFixed(2)}`;
  }
}

export const SUPPORTED_CURRENCIES = ["GBP", "USD", "EUR", "CAD", "AUD", "NZD"];
