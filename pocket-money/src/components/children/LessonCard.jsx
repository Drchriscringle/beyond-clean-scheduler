import { useState } from "react";
import * as icons from "lucide-react";
import { useMoney } from "../../hooks/useCurrency";
import { lessonForDay, dayKey } from "../../lib/lessons";
import { Card } from "../ui";

const DONE_PREFIX = "pm_lesson_done_";

function readDone(key) {
  try {
    return localStorage.getItem(DONE_PREFIX + key) === "1";
  } catch {
    return false;
  }
}
function writeDone(key) {
  try {
    localStorage.setItem(DONE_PREFIX + key, "1");
  } catch {
    // ignore
  }
}

// "Money word of the day" — changes daily, pitched at the child's age band.
export function LessonCard({ kid, mode, color }) {
  const money = useMoney();
  const lesson = lessonForDay(mode, kid.id);
  const key = `${kid.id}_${dayKey()}`;
  const [done, setDone] = useState(() => readDone(key));
  const little = mode === "little";

  const Icon = icons[lesson.icon] || icons.BookOpen;
  const body = typeof lesson.body === "function" ? lesson.body(money) : lesson.body;
  const tryIt = typeof lesson.tryIt === "function" ? lesson.tryIt(money) : lesson.tryIt;

  if (done) {
    return (
      <button
        onClick={() => setDone(false)}
        className="w-full flex items-center gap-3 rounded-2xl bg-white/80 backdrop-blur border border-line px-4 py-3 text-left"
      >
        <span className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: color.soft, color: color.main }}>
          <Icon size={18} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[11px] font-semibold tracking-[0.18em] uppercase text-ink-muted">Today's money word</span>
          <span className="block text-[14px] font-semibold text-ink truncate">{lesson.term}</span>
        </span>
        <span className="text-[12px] font-semibold" style={{ color: color.main }}>Read again</span>
      </button>
    );
  }

  return (
    <Card className={little ? "p-5" : "p-4"} accent={color.main}>
      <div className="flex items-start gap-3">
        <span className={`${little ? "h-14 w-14" : "h-11 w-11"} rounded-2xl flex items-center justify-center shrink-0`} style={{ background: color.soft, color: color.main }}>
          <Icon size={little ? 28 : 22} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-ink-muted">Today's money word</div>
          <div className={`${little ? "text-[22px]" : "text-[18px]"} font-bold text-ink tracking-tight`}>{lesson.term}</div>
        </div>
      </div>
      <p className={`${little ? "text-[16px]" : "text-[14px]"} text-ink mt-3 leading-relaxed`}>{body}</p>
      <div className="mt-3 rounded-xl px-3.5 py-3" style={{ background: color.soft }}>
        <div className="text-[11px] font-semibold tracking-[0.18em] uppercase" style={{ color: color.main }}>Try this</div>
        <p className={`${little ? "text-[15px]" : "text-[13.5px]"} text-ink mt-1 leading-relaxed`}>{tryIt}</p>
      </div>
      <button
        onClick={() => {
          writeDone(key);
          setDone(true);
        }}
        className={`mt-3 w-full rounded-xl font-semibold text-white transition active:scale-[0.98] ${little ? "h-12 text-[15px]" : "h-10 text-[13.5px]"}`}
        style={{ background: color.main }}
      >
        {little ? "I learned it!" : "Got it"}
      </button>
    </Card>
  );
}
