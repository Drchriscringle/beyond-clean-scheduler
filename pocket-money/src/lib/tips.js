// First-use tip cards. Which ones have been dismissed is remembered per
// device; a global switch turns them all off (Settings → Tips).
const ENABLED_KEY = "pm_tips";
const SEEN_KEY = "pm_tips_seen";

const read = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v;
  } catch {
    return fallback;
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
};

export function tipsEnabled() {
  return read(ENABLED_KEY, "on") !== "off";
}
export function setTipsEnabled(on) {
  write(ENABLED_KEY, on ? "on" : "off");
}

function seenSet() {
  try {
    return new Set(JSON.parse(read(SEEN_KEY, "[]")));
  } catch {
    return new Set();
  }
}
export function isTipSeen(id) {
  return seenSet().has(id);
}
export function markTipSeen(id) {
  const s = seenSet();
  s.add(id);
  write(SEEN_KEY, JSON.stringify([...s]));
}
export function resetTips() {
  write(SEEN_KEY, "[]");
  write(ENABLED_KEY, "on");
}

// Once-per-week flags (e.g. the "all chores done" sticker).
export function weeklyFlagSeen(key) {
  return read(`pm_week_${key}`, "") === "1";
}
export function markWeeklyFlag(key) {
  write(`pm_week_${key}`, "1");
}
