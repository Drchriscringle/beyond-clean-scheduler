import { useMoney } from "../../hooks/useCurrency";
import { useBillRuns } from "../../hooks/useBills";

export function BillHistory({ childId }) {
  const money = useMoney();
  const { data: runs } = useBillRuns(childId);

  if (runs === undefined) return <p className="text-xs text-slate-400 mt-1">Loading…</p>;
  if (runs.length === 0) return <p className="text-xs text-slate-400 italic mt-1">No pay days yet.</p>;

  return (
    <div className="mt-2 space-y-1">
      {runs.map((r) => (
        <div key={r.id} className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-2.5 py-1.5">
          <span className="text-slate-500">{new Date(r.run_at).toLocaleDateString()}</span>
          <span className="font-semibold text-slate-700">
            Paid {money(r.total_paid_pence)} of {money(r.total_due_pence)}
          </span>
          {r.shortfall_pence > 0 && (
            <span className="font-semibold text-rose-600">{money(r.shortfall_pence)} short</span>
          )}
        </div>
      ))}
    </div>
  );
}
