import { useMoney } from "../hooks/useCurrency";

export const JAR_COLORS = {
  save: "from-emerald-400 to-emerald-300",
  spend: "from-amber-400 to-amber-300",
  give: "from-fuchsia-400 to-pink-300",
};

export function Jar({ label, emoji, pence, sharePct }) {
  const money = useMoney();
  const fillPct = pence > 0 ? Math.max(10, Math.min(100, sharePct)) : 0;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-9 h-14 rounded-b-2xl rounded-t-md border-2 border-white bg-slate-100 shadow-inner overflow-hidden">
        <div
          className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t ${JAR_COLORS[label]} transition-all duration-500`}
          style={{ height: `${fillPct}%` }}
        />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-1 rounded-full bg-white/80" />
      </div>
      <div className="text-[10px] font-bold text-slate-500 leading-none mt-0.5">
        {emoji} {money(pence)}
      </div>
    </div>
  );
}

export function BigJar({ label, emoji, title, pence, sharePct }) {
  const money = useMoney();
  const fillPct = pence > 0 ? Math.max(10, Math.min(100, sharePct)) : 0;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-16 h-24 rounded-b-3xl rounded-t-lg border-4 border-white bg-slate-100 shadow-inner overflow-hidden">
        <div
          className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t ${JAR_COLORS[label]} transition-all duration-700`}
          style={{ height: `${fillPct}%` }}
        />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-2 rounded-full bg-white/80" />
      </div>
      <div className="text-xs font-bold text-slate-500">
        {emoji} {title}
      </div>
      <div className="font-display font-extrabold text-slate-800">{money(pence)}</div>
    </div>
  );
}
