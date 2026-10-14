import { describe, expect, it } from "vitest";
import { splitBudget } from "./budget";

const chore = (over) => ({ value_pence: 0, times_per_week: 1, custom_value: false, active: true, ...over });

describe("splitBudget", () => {
  it("splits the budget evenly across every completion", () => {
    const r = splitBudget(1000, [chore({ times_per_week: 7 }), chore({ times_per_week: 3 })]);
    expect(r.perAuto).toBe(100);
    expect(r.planned).toBe(1000);
  });

  it("takes custom-valued chores off the top first", () => {
    // £10: bed 25p ×7 = £1.75 custom; the remaining £8.25 over 3 dishes = £2.75 each
    const r = splitBudget(1000, [
      chore({ times_per_week: 7, custom_value: true, value_pence: 25 }),
      chore({ times_per_week: 3 }),
    ]);
    expect(r.customTotal).toBe(175);
    expect(r.perAuto).toBe(275);
  });

  it("never drops an auto chore below 1p and flags an unfunded week", () => {
    const r = splitBudget(0, [chore(), chore()]);
    expect(r.perAuto).toBe(1);
    expect(r.unfunded).toBe(true);
  });

  it("flags custom values that exceed the budget", () => {
    const r = splitBudget(100, [chore({ custom_value: true, value_pence: 150 }), chore()]);
    expect(r.overBudget).toBe(true);
    expect(r.perAuto).toBe(1);
  });
});
