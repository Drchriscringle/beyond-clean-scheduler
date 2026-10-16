// Fixed bottom tabs for the parent dashboard. `badges` maps tab key → count.
export function TabBar({ tabs, active, onChange, badges = {} }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 bg-white/95 backdrop-blur border-t border-line pb-[env(safe-area-inset-bottom)]"
      aria-label="Sections"
    >
      <div className="max-w-lg mx-auto grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((t) => {
          const Icon = t.icon;
          const on = t.key === active;
          const n = badges[t.key] || 0;
          return (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              aria-current={on ? "page" : undefined}
              className={`relative flex flex-col items-center justify-center gap-1 h-16 text-[11px] font-semibold transition ${on ? "text-brand-600" : "text-ink-muted hover:text-ink"}`}
            >
              <span className={`relative h-8 w-12 rounded-full flex items-center justify-center transition ${on ? "bg-brand-50" : ""}`}>
                <Icon size={20} strokeWidth={on ? 2.4 : 2} />
                {n > 0 && (
                  <span className="absolute -top-0.5 right-1 min-w-4.5 h-4.5 px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {n > 99 ? "99+" : n}
                  </span>
                )}
              </span>
              {t.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
