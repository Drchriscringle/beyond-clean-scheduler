import { describe, expect, it } from "vitest";
import { USERNAME_RULE, normaliseUsername } from "./api/children";
import { CHILD_QUICK_REPLIES, PARENT_QUICK_REPLIES, childQuickReplies } from "./quickReplies";

describe("child usernames", () => {
  it("normalises what a parent types into something a child can retype", () => {
    expect(normaliseUsername("  Ella Marie ")).toBe("ella-marie");
    expect(normaliseUsername("TOM_2016")).toBe("tom_2016");
  });

  it("accepts 3–20 lower-case letters, digits, - and _ (mirrors the SQL check)", () => {
    for (const ok of ["ella", "ella-m", "tom_2016", "a1b", "x".repeat(20)]) expect(USERNAME_RULE.test(ok), ok).toBe(true);
    for (const bad of ["el", "-ella", "Ella", "ella m", "x".repeat(21), ""]) expect(USERNAME_RULE.test(bad), bad).toBe(false);
  });
});

describe("quick replies", () => {
  it("has short, non-empty options for every age band and for parents", () => {
    for (const list of [...Object.values(CHILD_QUICK_REPLIES), PARENT_QUICK_REPLIES]) {
      expect(list.length).toBeGreaterThanOrEqual(3);
      for (const q of list) expect(q.length).toBeLessThanOrEqual(40);
    }
    expect(childQuickReplies("nope")).toBe(CHILD_QUICK_REPLIES.middle);
  });
});
