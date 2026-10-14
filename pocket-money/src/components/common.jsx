export function BackgroundBlobs() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-fuchsia-300/30 blur-3xl" />
      <div className="absolute top-1/3 -right-20 h-80 w-80 rounded-full bg-indigo-300/30 blur-3xl" />
      <div className="absolute bottom-0 left-1/4 h-72 w-72 rounded-full bg-amber-200/30 blur-3xl" />
    </div>
  );
}

export function Centered({ children }) {
  return <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-4">{children}</div>;
}

export function LoadingScreen() {
  return (
    <Centered>
      <div className="flex flex-col items-center gap-3 text-slate-500">
        <span className="text-5xl animate-bounce">🐷</span>
        <p className="font-display font-semibold">Loading…</p>
      </div>
    </Centered>
  );
}

export function BrandHeader() {
  return (
    <div className="flex flex-col items-center gap-1 mb-2">
      <span className="text-5xl">🐷</span>
      <h1 className="font-display text-3xl font-extrabold bg-gradient-to-r from-indigo-600 via-fuchsia-500 to-amber-500 bg-clip-text text-transparent">
        Pocket Money
      </h1>
      <p className="text-sm text-slate-500">Chores turn into real, saved-up pocket money</p>
    </div>
  );
}

export function Card({ children }) {
  return (
    <div className="w-full max-w-sm space-y-4 bg-white/90 backdrop-blur p-7 rounded-[2rem] shadow-xl shadow-indigo-100 border border-white">
      {children}
    </div>
  );
}

export function BigButton({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`w-full font-display font-bold rounded-2xl py-3 shadow-md active:scale-[0.98] transition disabled:opacity-50 disabled:active:scale-100 ${className}`}
    >
      {children}
    </button>
  );
}

export const primaryBtn =
  "bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white hover:brightness-105";

export function Section({ title, emoji, subtitle, badge, children }) {
  return (
    <section className="bg-white/70 backdrop-blur rounded-3xl p-4 sm:p-5 shadow-sm border border-white">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="font-display font-bold text-slate-700 flex items-center gap-1.5">
          <span>{emoji}</span> {title}
        </h2>
        {typeof badge === "number" && (
          <span className="text-xs font-bold bg-fuchsia-500 text-white rounded-full h-5 min-w-5 px-1.5 flex items-center justify-center">
            {badge}
          </span>
        )}
      </div>
      {subtitle && <p className="text-xs text-slate-500 -mt-2 mb-3">{subtitle}</p>}
      {children}
    </section>
  );
}
