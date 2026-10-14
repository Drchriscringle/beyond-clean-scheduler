import { useMoney } from "../../hooks/useCurrency";
import { useBillRuns } from "../../hooks/useBills";
import { Empty } from "../ui";

export function BillHistory({ childId }) {
  const money = useMoney();
  const { data: runs } = useBillRuns(childId);

  if (runs === undefined) return <p className="text-[12.5px] text-ink-muted mt-2">Loading…</p>;
  if (runs.length === 0) return <Empty>No pay days yet.</Empty>;

  return (
    <div className="mt-2 divide-y divide-line">
      {runs.map((r) => (
        <div key={r.id} className="flex items-center justify-between text-[12.5px] py-2">
          <span className="text-ink-muted">{new Date(r.run_at).toLocaleDateString()}</span>
          <span className="font-semibold text-ink tabular-nums">
            {money(r.total_paid_pence)} <span className="text-ink-muted font-normal">of {money(r.total_due_pence)}</span>
          </span>
          {r.shortfall_pence > 0 && <span className="font-semibold text-rose-600 tabular-nums">−{money(r.shortfall_pence)} short</span>}
        </div>
      ))}
    </div>
  );
}
