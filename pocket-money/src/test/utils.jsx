import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { CurrencyProvider } from "../hooks/useCurrency";

export function renderWithProviders(ui, { currency = "GBP" } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <CurrencyProvider currency={currency}>{ui}</CurrencyProvider>
    </QueryClientProvider>
  );
}
