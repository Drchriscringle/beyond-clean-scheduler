// Chore schedules:
//   weekly — any days this week, up to `times_per_week` completions
//   daily  — every day, once a day
//   dates  — specific days planned on the 8-day calendar, once each
// `times_per_week` is derived from the schedule by the database so the
// budget split keeps working; these helpers mirror that for instant previews.

export const SCHEDULES = [
  { key: "weekly", label: "Any days", hint: "Up to a set number of times a week" },
  { key: "daily", label: "Every day", hint: "Once a day, seven days a week" },
  { key: "dates", label: "Pick days", hint: "Plan exact days on the calendar" },
];

const pad = (n) => String(n).padStart(2, "0");

// 'YYYY-MM-DD' in the device's local time zone.
export function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(d, n) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

// Today plus the next seven days: always eight days to plan.
export function planningDays(now = new Date()) {
  return Array.from({ length: 8 }, (_, i) => {
    const d = addDays(now, i);
    return { key: dateKey(d), date: d, label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString(undefined, { weekday: "short" }), dayNum: d.getDate(), month: d.toLocaleDateString(undefined, { month: "short" }) };
  });
}

// Monday-start week containing `d`, as date keys.
export function weekKeys(d = new Date()) {
  const start = addDays(d, -((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => dateKey(addDays(start, i)));
}

export function effectiveTimesPerWeek(chore, now = new Date()) {
  if (chore.schedule === "daily") return 7;
  if (chore.schedule === "dates") {
    const week = new Set(weekKeys(now));
    return Math.max(1, (chore.dates || []).filter((k) => week.has(k)).length);
  }
  return Math.max(1, Math.min(chore.times_per_week || 1, 14));
}

// Is this chore on for a given day key?
export function dueOn(chore, key) {
  if (chore.schedule === "daily") return true;
  if (chore.schedule === "dates") return (chore.dates || []).includes(key);
  return false; // weekly chores are "any day"
}

export function scheduleLabel(chore, now = new Date()) {
  if (chore.schedule === "daily") return "every day";
  if (chore.schedule === "dates") {
    const dates = chore.dates || [];
    const upcoming = dates.filter((k) => k >= dateKey(now));
    if (upcoming.length === 0) return "no days planned";
    const names = upcoming.slice(0, 3).map((k) => shortDay(k, now));
    return upcoming.length > 3 ? `${names.join(", ")} +${upcoming.length - 3}` : names.join(", ");
  }
  return `${chore.times_per_week}× a week`;
}

export function shortDay(key, now = new Date()) {
  if (key === dateKey(now)) return "Today";
  if (key === dateKey(addDays(now, 1))) return "Tomorrow";
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", day: "numeric" });
}
