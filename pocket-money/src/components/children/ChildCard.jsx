import { Lock } from "lucide-react";
import { useMoney } from "../../hooks/useCurrency";
import { Jar } from "../Jars";

export function ChildCard({ kid, balance, onOpen }) {
  const money = useMoney();
  const save = balance?.save_pence ?? 0;
  const spend = balance?.spend_pence ?? 0;
  const give = balance?.give_pence ?? 0;
  const total = balance?.total_pence ?? 0;
  const shareOf = (v) => (total > 0 ? (v / total) * 100 : 0);

  return (
    <button
      onClick={onOpen}
      className="rounded-2xl p-3 bg-white shadow-sm border border-slate-100 flex flex-col items-center text-center gap-1.5 hover:shadow-md hover:border-indigo-200 transition relative"
    >
      {onOpen && <Lock size={11} className="absolute top-2 right-2 text-slate-300" />}
      <span className="text-3xl">{kid.avatar}</span>
      <div className="font-display font-bold text-slate-800 text-sm">{kid.name}</div>
      <div className="font-display text-xl font-extrabold text-indigo-600">{money(total)}</div>
      <div className="flex gap-2 pt-1">
        <Jar label="save" emoji="💰" pence={save} sharePct={shareOf(save)} />
        <Jar label="spend" emoji="🛍️" pence={spend} sharePct={shareOf(spend)} />
        <Jar label="give" emoji="🎁" pence={give} sharePct={shareOf(give)} />
      </div>
      {onOpen && <div className="text-[10px] font-semibold text-indigo-400 mt-0.5">Tap to open</div>}
    </button>
  );
}
