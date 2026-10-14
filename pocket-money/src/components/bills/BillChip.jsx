import { X } from "lucide-react";
import { useMoney } from "../../hooks/useCurrency";
import { useRemoveBill } from "../../hooks/useBills";

export function BillChip({ bill }) {
  const money = useMoney();
  const removeBill = useRemoveBill();

  return (
    <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-full pl-3 pr-1.5 py-1.5">
      <span>{bill.icon}</span>
      <span className="text-sm font-semibold text-slate-700">{bill.name}</span>
      <span className="text-xs font-bold text-sky-700 bg-sky-100 rounded-full px-2 py-0.5">
        {money(bill.amount_pence)}/{bill.frequency === "weekly" ? "wk" : "mo"}
      </span>
      <button
        onClick={() => removeBill.mutate(bill.id)}
        className="text-slate-300 hover:text-rose-500 transition p-1"
      >
        <X size={14} />
      </button>
    </div>
  );
}
