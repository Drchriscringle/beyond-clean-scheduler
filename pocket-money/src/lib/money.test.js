import { describe, expect, it } from "vitest";
import { formatMoney } from "./money";

describe("formatMoney", () => {
  it("formats pence as GBP by default", () => {
    expect(formatMoney(1050)).toBe("£10.50");
  });

  it("treats null/undefined pence as zero", () => {
    expect(formatMoney(null)).toBe("£0.00");
    expect(formatMoney(undefined)).toBe("£0.00");
  });

  it("formats in other supported currencies", () => {
    expect(formatMoney(1050, "USD")).toBe("$10.50");
  });

  it("falls back to a £ string for an unknown currency code", () => {
    expect(formatMoney(500, "NOT_A_CURRENCY")).toBe("£5.00");
  });

  it("rounds to whole pence correctly for odd amounts", () => {
    expect(formatMoney(1)).toBe("£0.01");
    expect(formatMoney(99)).toBe("£0.99");
  });
});
