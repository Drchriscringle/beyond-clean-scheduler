import { describe, expect, it } from "vitest";
import { LESSONS, lessonForDay, dailyCard } from "./lessons";
import { quizFor } from "./quizzes";

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

  it("has a quiz with three options and a valid answer for every lesson", () => {
    for (const [band, list] of Object.entries(LESSONS)) {
      for (const l of list) {
        const q = quizFor(band, l.term);
        expect(q, `${band}:${l.term}`).toBeTruthy();
        expect(q.options.length, `${band}:${l.term}`).toBe(3);
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(q.answer).toBeLessThan(3);
      }
    }
  });

  it("teaches the whole deck, then comes back round as quizzes", () => {
    const n = LESSONS.middle.length;
    const day0 = new Date("2026-01-05T12:00:00Z");
    const kinds = [];
    for (let d = 0; d < n * 2; d++) {
      kinds.push(dailyCard("middle", "", new Date(day0.getTime() + d * 86400000)).kind);
    }
    // 'seed' hash is 0 for "", so the sequence starts at some offset in the
    // deck; across 2n days we must see exactly n lessons and n quizzes.
    expect(kinds.filter((k) => k === "lesson").length).toBe(n);
    expect(kinds.filter((k) => k === "quiz").length).toBe(n);
  });

  it("falls back to the middle band for an unknown mode", () => {
    expect(LESSONS.middle).toContain(lessonForDay("nope", "x"));
  });
});
