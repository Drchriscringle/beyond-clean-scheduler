import { useEffect, useMemo } from "react";
import { playFanfare } from "../lib/sound";

const CONFETTI_COLORS = ["#f5b400", "#5b2fa8", "#1d6fe8", "#15803d", "#be185d", "#c2410c"];

// Full-screen "all jobs done" celebration: a big rotating sticker, confetti
// and a fanfare. Tap anywhere to close.
export function WellDone({ name, color = "#5b2fa8", onClose }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 1.2,
        duration: 2.2 + Math.random() * 1.6,
        size: 8 + Math.random() * 8,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        round: Math.random() > 0.6,
        spin: Math.random() > 0.5 ? 1 : -1,
      })),
    []
  );

  useEffect(() => {
    playFanfare();
  }, []);

  return (
    <div className="fixed inset-0 z-[70] overflow-hidden flex items-center justify-center p-6" style={{ background: `${color}f2` }} onClick={onClose} role="dialog" aria-label="Well done">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.round ? p.size : p.size * 0.45,
            background: p.color,
            borderRadius: p.round ? "9999px" : "2px",
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            "--spin": p.spin,
          }}
        />
      ))}

      <div className="sticker-pop relative text-center select-none">
        <div className="sticker-burst absolute inset-0 -m-16 rounded-full opacity-60" />
        <div
          className="sticker relative mx-auto rounded-full flex flex-col items-center justify-center text-center"
          style={{ width: 240, height: 240, background: "#fff", color, boxShadow: "0 24px 60px -20px rgba(0,0,0,0.5), inset 0 0 0 10px #ffe58a, inset 0 0 0 14px #fff" }}
        >
          <div className="text-[13px] font-bold tracking-[0.3em] uppercase opacity-70">All jobs done</div>
          <div className="text-[44px] font-black leading-[0.95] mt-1" style={{ letterSpacing: "-0.02em" }}>
            WELL
            <br />
            DONE!
          </div>
          <div className="mt-2 text-[15px] font-semibold opacity-80">{name}</div>
        </div>
        <p className="mt-8 text-white text-[16px] font-semibold">Every chore finished this week.</p>
        <p className="mt-1 text-white/75 text-[13px]">Tap anywhere to close</p>
      </div>
    </div>
  );
}
