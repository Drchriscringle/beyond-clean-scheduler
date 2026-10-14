import { describe, expect, it } from "vitest";
import { splitChoreValue } from "./jarSplit";

describe("splitChoreValue", () => {
  it("splits evenly when the value divides cleanly", () => {
    const split = splitChoreValue(100, { jar_save: 40, jar_spend: 40, jar_give: 20 });
    expect(split).toEqual({ save: 40, spend: 40, give: 20 });
  });

  it("always sums back to the exact original value, even with rounding", () => {
    // 33/33/34 split of 100p can't divide evenly — give absorbs the remainder.
    const split = splitChoreValue(100, { jar_save: 33, jar_spend: 33, jar_give: 34 });
    expect(split.save + split.spend + split.give).toBe(100);
  });

  it("handles an odd value_pence across many jar ratios without drift", () => {
    for (let give = 0; give <= 100; give += 5) {
      for (let save = 0; save <= 100 - give; save += 5) {
        const spend = 100 - save - give;
        const split = splitChoreValue(137, { jar_save: save, jar_spend: spend, jar_give: give });
        expect(split.save + split.spend + split.give).toBe(137);
      }
    }
  });

  it("gives everything to save when the jars are 100/0/0", () => {
    const split = splitChoreValue(250, { jar_save: 100, jar_spend: 0, jar_give: 0 });
    expect(split).toEqual({ save: 250, spend: 0, give: 0 });
  });
});
