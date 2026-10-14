import { describe, expect, it } from "vitest";
import { LESSONS, lessonForDay } from "./lessons";

describe("money lessons", () => {
  it("has a decent library for every age band with unique terms", () => {
    for (const [band, list] of Object.entries(LESSONS)) {
      expect(list.length, band).toBeGreaterThanOrEqual(20);
      const terms = new Set(list.map((l) => l.term));
      expect(terms.size, band).toBe(list.length);
      for (const l of list) {
        expect(l.icon, l.term).toBeTruthy();
        expect(l.tryIt, l.term).toBeTruthy();
      }
    }
  });

  it("picks the same lesson all day and a different one tomorrow", () => {
    const today = new Date("2026-10-14T09:00:00Z");
    const laterToday = new Date("2026-10-14T21:00:00Z");
    const tomorrow = new Date("2026-10-15T09:00:00Z");
    expect(lessonForDay("middle", "kid-1", today)).toBe(lessonForDay("middle", "kid-1", laterToday));
    expect(lessonForDay("middle", "kid-1", today)).not.toBe(lessonForDay("middle", "kid-1", tomorrow));
  });

  it("falls back to the middle band for an unknown mode", () => {
    expect(LESSONS.middle).toContain(lessonForDay("nope", "x"));
  });
});
