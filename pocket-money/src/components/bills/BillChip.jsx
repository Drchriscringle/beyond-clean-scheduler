import { X } from "lucide-react";
import { useMoney } from "../../hooks/useCurrency";
import { useRemoveBill } from "../../hooks/useBills";
import { IconCircle, Pill } from "../ui";

export function BillChip({ bill }) {
  const money = useMoney();
  const removeBill = useRemoveBill();

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-line last:border-0">
      <IconCircle tone="blue" size={38}>{bill.icon}</IconCircle>
      <span className="flex-1 text-[14px] font-medium text-ink truncate">{bill.name}</span>
      <Pill tone="blue">
        {money(bill.amount_pence)}/{bill.frequency === "weekly" ? "wk" : "mo"}
      </Pill>
      <button
        onClick={() => removeBill.mutate(bill.id)}
        aria-label="Remove bill"
        className="h-8 w-8 rounded-full text-ink-muted hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center transition"
      >
        <X size={15} />
      </button>
    </div>
  );
}
