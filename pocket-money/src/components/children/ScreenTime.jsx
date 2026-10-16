import { useState } from "react";
import { Clock, ChevronDown } from "lucide-react";
import { formatDuration } from "../../hooks/useUsage";

// Parent Home: how long this child has had the app open today and this
// week, with a 7-day bar strip when expanded.
export function ScreenTime({ usage, color }) {
  const [open, setOpen] = useState(false);
  const today = usage?.today || 0;
  const week = usage?.week || 0;

  const days = lastSevenDays().map((day) => ({ day, seconds: usage?.days.find((d) => d.day === day)?.seconds || 0 }));
  const max = Math.max(60, ...days.map((d) => d.seconds));

  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="w-full flex items-center justify-between text-[14px] font-semibold text-ink py-0.5">
        <span className="inline-flex items-center gap-2">
          <Clock size={17} className="text-ink-muted" /> Screen time
          <span className="text-[12.5px] font-medium text-ink-muted">{today ? formatDuration(today) : "none"} today · {formatDuration(week)} this week</span>
        </span>
        <ChevronDown size={18} className={`text-ink-muted transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-3 rounded-xl bg-surface p-3">
          <div className="flex items-end gap-1.5 h-20">
            {days.map((d) => (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                <span className="text-[10px] text-ink-muted tabular-nums">{d.seconds ? Math.round(d.seconds / 60) : ""}</span>
                <div className="w-full rounded-md" style={{ height: `${Math.max(3, (d.seconds / max) * 100)}%`, background: d.seconds ? color : "#e9ebf2" }} title={formatDuration(d.seconds)} />
                <span className="text-[10px] font-semibold text-ink-muted">{dayLetter(d.day)}</span>
              </div>
            ))}
          </div>
          <p className="text-[11.5px] text-ink-muted mt-2">Minutes a day with Pocket Money open on their device. Counts only while the app is on screen.</p>
        </div>
      )}
    </div>
  );
}

function lastSevenDays() {
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function dayLetter(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "narrow" });
}
