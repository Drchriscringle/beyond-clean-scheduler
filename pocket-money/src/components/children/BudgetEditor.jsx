import { useEffect, useState } from "react";
import { useUpdateChildBudget } from "../../hooks/useChildren";

const toPence = (s) => Math.round(parseFloat(s || "0") * 100) || 0;
const toPounds = (p) => ((p || 0) / 100).toFixed(2);

// The child's weekly pocket-money level. Saves on blur / Enter.
export function BudgetEditor({ kid, label = "Per week" }) {
  const [value, setValue] = useState(toPounds(kid.weekly_budget_pence));
  const update = useUpdateChildBudget();

  useEffect(() => setValue(toPounds(kid.weekly_budget_pence)), [kid.weekly_budget_pence]);

  const commit = () => {
    const pence = toPence(value);
    setValue(toPounds(pence));
    if (pence !== kid.weekly_budget_pence) update.mutate({ childId: kid.id, pence });
  };

  return (
    <label className="text-right shrink-0">
      <span className="block text-[11px] font-semibold text-ink-muted mb-1">{label}</span>
      <input
        inputMode="decimal"
        aria-label={`${kid.name} ${label.toLowerCase()}`}
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className="w-24 h-10 rounded-xl border border-line bg-white px-3 text-right text-[16px] font-bold tabular-nums text-ink outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
      />
    </label>
  );
}
