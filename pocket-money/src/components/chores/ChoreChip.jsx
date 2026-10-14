import { X } from "lucide-react";
import { useMoney } from "../../hooks/useCurrency";
import { useRemoveChore } from "../../hooks/useChores";

export function ChoreChip({ chore }) {
  const money = useMoney();
  const removeChore = useRemoveChore();

  return (
    <div className="flex items-center gap-2 bg-white border border-slate-100 rounded-full pl-3 pr-1.5 py-1.5 shadow-sm">
      <span>{chore.icon}</span>
      <span className="text-sm font-semibold text-slate-700">{chore.name}</span>
      <span className="text-xs font-bold text-amber-600 bg-amber-50 rounded-full px-2 py-0.5">
        {money(chore.value_pence)}
      </span>
      <button
        onClick={() => removeChore.mutate(chore.id)}
        className="text-slate-300 hover:text-rose-500 transition p-1"
      >
        <X size={14} />
      </button>
    </div>
  );
}
