import { useEffect, useMemo } from "react";
import { useMoney } from "../hooks/useCurrency";

// Celebration overlay: coins rain down and the amount pops in the middle.
// Pure CSS keyframes (see index.css), auto-dismisses after ~2.4s.
export function MoneyDrop({ amount, label = "into your jars!", color = "#5b2fa8", onDone }) {
  const money = useMoney();
  const coins = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        id: i,
        left: 4 + Math.random() * 92,
        delay: Math.random() * 0.7,
        duration: 1.4 + Math.random() * 0.8,
        size: 22 + Math.random() * 16,
        spin: Math.random() > 0.5 ? 1 : -1,
      })),
    []
  );

  useEffect(() => {
    const t = setTimeout(() => onDone?.(), 2400);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none overflow-hidden" aria-live="polite">
      {coins.map((c) => (
        <span
          key={c.id}
          className="coin"
          style={{
            left: `${c.left}%`,
            width: c.size,
            height: c.size,
            animationDelay: `${c.delay}s`,
            animationDuration: `${c.duration}s`,
            "--spin": c.spin,
          }}
        >
          <span className="coin-face">¢</span>
        </span>
      ))}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="money-pop rounded-3xl bg-white px-7 py-5 text-center shadow-2xl border border-line">
          <div className="text-[36px] font-bold tabular-nums tracking-tight" style={{ color }}>
            +{money(amount)}
          </div>
          <div className="text-[14px] font-semibold text-ink-muted mt-1">{label}</div>
        </div>
      </div>
    </div>
  );
}
