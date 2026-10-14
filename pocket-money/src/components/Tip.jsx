import { useState } from "react";
import { Lightbulb, X } from "lucide-react";
import { isTipSeen, markTipSeen, tipsEnabled } from "../lib/tips";

// A first-use explainer card. Shows once per device per `id`, unless tips
// are switched off. `kid` styles it for the child's screen.
export function Tip({ id, title, children, kid = false, color }) {
  const [visible, setVisible] = useState(() => tipsEnabled() && !isTipSeen(id));
  if (!visible) return null;

  const dismiss = () => {
    markTipSeen(id);
    setVisible(false);
  };

  const accent = color || "#5b2fa8";

  return (
    <div
      className={`tip-in relative rounded-2xl border bg-white shadow-[0_10px_30px_-14px_rgba(27,27,47,0.35)] ${kid ? "p-5 mb-4" : "p-4 mb-3"}`}
      style={{ borderColor: `${accent}55` }}
      role="note"
    >
      <button onClick={dismiss} aria-label="Dismiss tip" className="absolute top-2.5 right-2.5 h-7 w-7 rounded-full flex items-center justify-center text-ink-muted hover:bg-surface">
        <X size={14} />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <span className="shrink-0 h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: `${accent}1a`, color: accent }}>
          <Lightbulb size={18} />
        </span>
        <div className="min-w-0">
          <div className={`${kid ? "text-[16px]" : "text-[14px]"} font-semibold text-ink`}>{title}</div>
          <div className={`${kid ? "text-[14px]" : "text-[13px]"} text-ink-muted mt-1 leading-relaxed`}>{children}</div>
        </div>
      </div>
      <button
        onClick={dismiss}
        className={`mt-3 w-full rounded-xl font-semibold text-white transition active:scale-[0.98] ${kid ? "h-12 text-[15px]" : "h-10 text-[13.5px]"}`}
        style={{ background: accent }}
      >
        {kid ? "OK, got it!" : "Got it"}
      </button>
    </div>
  );
}
