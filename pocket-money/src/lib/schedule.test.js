import { describe, expect, it } from "vitest";
import { planningDays, effectiveTimesPerWeek, dueOn, scheduleLabel, dateKey, weekKeys } from "./schedule";

const wed = new Date(2026, 9, 14, 12); // Wed 14 Oct 2026, local time

describe("chore schedule", () => {
  it("always offers today plus seven days", () => {
    const days = planningDays(wed);
    expect(days).toHaveLength(8);
    expect(days[0].label).toBe("Today");
    expect(days[1].label).toBe("Tomorrow");
    expect(days[0].key).toBe("2026-10-14");
    expect(days[7].key).toBe("2026-10-21");
  });

  it("builds a Monday-start week", () => {
    expect(weekKeys(wed)[0]).toBe("2026-10-12");
    expect(weekKeys(wed)[6]).toBe("2026-10-18");
  });

  it("derives completions-this-week from the schedule (mirrors SQL)", () => {
    expect(effectiveTimesPerWeek({ schedule: "weekly", times_per_week: 3 }, wed)).toBe(3);
    expect(effectiveTimesPerWeek({ schedule: "daily" }, wed)).toBe(7);
    // two dates this week, one next week → 2
    expect(effectiveTimesPerWeek({ schedule: "dates", dates: ["2026-10-14", "2026-10-17", "2026-10-20"] }, wed)).toBe(2);
    // nothing this week still counts as 1 so a value exists
    expect(effectiveTimesPerWeek({ schedule: "dates", dates: ["2026-10-20"] }, wed)).toBe(1);
  });

  it("knows which days a chore is on", () => {
    expect(dueOn({ schedule: "daily" }, "2026-10-14")).toBe(true);
    expect(dueOn({ schedule: "dates", dates: ["2026-10-15"] }, "2026-10-14")).toBe(false);
    expect(dueOn({ schedule: "dates", dates: ["2026-10-15"] }, "2026-10-15")).toBe(true);
    expect(dueOn({ schedule: "weekly", times_per_week: 2 }, "2026-10-14")).toBe(false);
  });

  it("describes the schedule in a few words", () => {
    expect(scheduleLabel({ schedule: "daily" }, wed)).toBe("every day");
    expect(scheduleLabel({ schedule: "weekly", times_per_week: 2 }, wed)).toBe("2× a week");
    expect(scheduleLabel({ schedule: "dates", dates: ["2026-10-14", "2026-10-15"] }, wed)).toBe("Today, Tomorrow");
    expect(scheduleLabel({ schedule: "dates", dates: ["2026-10-01"] }, wed)).toBe("no days planned");
    expect(dateKey(wed)).toBe("2026-10-14");
  });
});
