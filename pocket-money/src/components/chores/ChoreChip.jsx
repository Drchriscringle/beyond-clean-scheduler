import { X } from "lucide-react";
import { useMoney } from "../../hooks/useCurrency";
import { useRemoveChore } from "../../hooks/useChores";
import { IconCircle, Pill } from "../ui";

export function ChoreChip({ chore }) {
  const money = useMoney();
  const removeChore = useRemoveChore();

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-line last:border-0">
      <IconCircle tone="amber" size={38}>{chore.icon}</IconCircle>
      <span className="flex-1 text-[14px] font-medium text-ink truncate">{chore.name}</span>
      <Pill tone="amber">{money(chore.value_pence)}</Pill>
      <button
        onClick={() => removeChore.mutate(chore.id)}
        aria-label="Remove chore"
        className="h-8 w-8 rounded-full text-ink-muted hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center transition"
      >
        <X size={15} />
      </button>
    </div>
  );
}
