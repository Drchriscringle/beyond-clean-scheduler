import { PiggyBank } from "lucide-react";

/* ---------- layout ---------- */

export function Page({ children, className = "" }) {
  return <div className={`min-h-screen max-w-lg mx-auto px-4 pb-16 ${className}`}>{children}</div>;
}

export function Centered({ children }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 py-10">{children}</div>
  );
}

export function Card({ children, className = "", accent, onClick, style }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      style={style}
      className={`relative w-full text-left bg-white rounded-2xl border border-line shadow-[0_1px_2px_rgba(27,27,47,0.04),0_8px_24px_-12px_rgba(27,27,47,0.12)] overflow-hidden ${onClick ? "active:scale-[0.995] transition" : ""} ${className}`}
    >
      {children}
      {accent && <div className="absolute inset-x-0 bottom-0 h-1" style={{ background: accent }} />}
    </Tag>
  );
}

export function Eyebrow({ children, right }) {
  return (
    <div className="flex items-center justify-between mt-7 mb-3 px-1">
      <h2 className="text-[11px] font-semibold tracking-[0.18em] uppercase text-ink-muted">{children}</h2>
      {right}
    </div>
  );
}

export function Row({ label, value, strong, muted }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span className={`text-[13px] ${muted ? "text-ink-muted" : "text-ink-muted"}`}>{label}</span>
      <span className={`tabular-nums ${strong ? "text-[15px] font-bold text-ink" : "text-[14px] font-semibold text-ink"}`}>
        {value}
      </span>
    </div>
  );
}

export function Divider() {
  return <div className="h-px bg-line my-3" />;
}

/* ---------- brand ---------- */

export function Logo({ size = 44 }) {
  return (
    <div
      className="rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center shadow-[0_8px_20px_-8px_rgba(91,47,168,0.6)]"
      style={{ width: size, height: size }}
    >
      <PiggyBank size={Math.round(size * 0.55)} strokeWidth={2.2} />
    </div>
  );
}

export function BrandHeader({ subtitle = "Chores that turn into real, saved-up pocket money." }) {
  return (
    <div className="flex flex-col items-center text-center gap-3 mb-2">
      <Logo size={56} />
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Pocket Money</h1>
        <p className="text-sm text-ink-muted mt-1">{subtitle}</p>
      </div>
    </div>
  );
}

/* ---------- avatars & icons ---------- */

const AVATAR_PALETTE = [
  ["#5b2fa8", "#e4d9f8"],
  ["#1d6fe8", "#dbe8fd"],
  ["#15803d", "#dcf3e4"],
  ["#c2410c", "#fde4d6"],
  ["#be185d", "#fbdcea"],
  ["#0e7490", "#d6f0f5"],
];

export function avatarColors(seed = "") {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

// `src` shows a photo instead of the initial; `colors` ([fg, bg]) overrides
// the name-derived palette (used for a child's chosen theme colour).
export function Avatar({ name = "", size = 48, className = "", src, colors }) {
  const [fg, bg] = colors || avatarColors(name);
  const initial = (name.trim()[0] || "?").toUpperCase();
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={`rounded-full object-cover shrink-0 bg-surface ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className={`rounded-full flex items-center justify-center font-bold select-none shrink-0 ${className}`}
      style={{ width: size, height: size, background: bg, color: fg, fontSize: Math.round(size * 0.42) }}
      aria-hidden
    >
      {initial}
    </div>
  );
}

export function IconCircle({ children, tone = "brand", size = 40 }) {
  const tones = {
    brand: "bg-brand-50 text-brand-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    blue: "bg-sky-50 text-sky-600",
    rose: "bg-rose-50 text-rose-600",
    grey: "bg-surface text-ink-muted",
  };
  return (
    <div
      className={`shrink-0 rounded-xl flex items-center justify-center ${tones[tone] || tones.brand}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.45) }}
    >
      {children}
    </div>
  );
}

/* ---------- controls ---------- */

const buttonVariants = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-[0_6px_16px_-8px_rgba(91,47,168,0.7)]",
  secondary: "bg-white text-brand-600 border border-brand-200 hover:bg-brand-50",
  ghost: "bg-transparent text-ink-muted hover:text-ink hover:bg-surface",
  danger: "bg-rose-600 text-white hover:bg-rose-700",
  success: "bg-emerald-600 text-white hover:bg-emerald-700",
};

export function Button({ children, variant = "primary", size = "md", className = "", ...props }) {
  const sizes = { sm: "h-9 px-3 text-[13px] rounded-lg", md: "h-11 px-4 text-[14px] rounded-xl", lg: "h-12 px-5 text-[15px] rounded-xl" };
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 ${sizes[size]} ${buttonVariants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Input({ label, className = "", ...props }) {
  return (
    <label className="block">
      {label && <span className="block text-[12px] font-semibold text-ink-muted mb-1.5">{label}</span>}
      <input
        {...props}
        className={`w-full h-11 rounded-xl border border-line bg-white px-3.5 text-[15px] text-ink placeholder:text-ink-muted/60 outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100 ${className}`}
      />
    </label>
  );
}

export function Select({ label, className = "", children, ...props }) {
  return (
    <label className="block">
      {label && <span className="block text-[12px] font-semibold text-ink-muted mb-1.5">{label}</span>}
      <select
        {...props}
        className={`w-full h-11 rounded-xl border border-line bg-white px-3 text-[15px] text-ink outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100 ${className}`}
      >
        {children}
      </select>
    </label>
  );
}

export function Pill({ children, tone = "brand" }) {
  const tones = {
    brand: "bg-brand-50 text-brand-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-sky-50 text-sky-700",
    rose: "bg-rose-50 text-rose-700",
    grey: "bg-surface text-ink-muted",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-semibold tabular-nums ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Progress({ value, color = "#5b2fa8" }) {
  const pct = Math.max(0, Math.min(100, value || 0));
  return (
    <div className="h-1.5 w-full rounded-full bg-surface overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function ErrorText({ children }) {
  if (!children) return null;
  return <p className="text-[13px] font-medium text-rose-600">{children}</p>;
}

export function Empty({ children }) {
  return <p className="text-[13px] text-ink-muted py-3 text-center">{children}</p>;
}

export function LoadingScreen() {
  return (
    <Centered>
      <Logo size={56} />
      <p className="text-sm text-ink-muted">Loading…</p>
    </Centered>
  );
}
