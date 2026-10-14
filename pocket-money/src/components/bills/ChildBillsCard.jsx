import { useState } from "react";
import { useMoney } from "../../hooks/useCurrency";
import { useRunBillsNow } from "../../hooks/useBills";
import { BillChip } from "./BillChip";
import { AddBillForm } from "./AddBillForm";
import { BillHistory } from "./BillHistory";

export function ChildBillsCard({ kid, familyId, bills }) {
  const money = useMoney();
  const [payResult, setPayResult] = useState(null); // { total_paid_pence, shortfall_pence }
  const [payErr, setPayErr] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const runBillsNow = useRunBillsNow();
  const totalWeekly = bills.reduce((sum, b) => sum + (b.frequency === "weekly" ? b.amount_pence : 0), 0);

  const payDay = async () => {
    setPayErr("");
    setPayResult(null);
    try {
      const run = await runBillsNow.mutateAsync(kid.id);
      setPayResult(run);
    } catch (e) {
      setPayErr(e.message);
    }
  };

  return (
    <div className="rounded-2xl p-3 bg-white border border-slate-100 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">{kid.avatar}</span>
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold text-slate-800 text-sm">{kid.name}</div>
          {bills.length > 0 && (
            <div className="text-xs text-slate-400">{money(totalWeekly)} / week in bills</div>
          )}
        </div>
        <button
          onClick={payDay}
          disabled={runBillsNow.isPending || bills.length === 0}
          className="flex items-center gap-1.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white rounded-full px-3 py-1.5 text-sm font-bold transition"
        >
          💸 {runBillsNow.isPending ? "Paying…" : "Pay day"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-2">
        {bills.map((b) => (
          <BillChip key={b.id} bill={b} />
        ))}
        {bills.length === 0 && <p className="text-xs text-slate-400 italic">No bills set yet.</p>}
      </div>

      {payErr && <p className="text-xs text-rose-600 font-medium mb-2">{payErr}</p>}
      {payResult && (
        <p className="text-xs font-semibold mb-2 text-sky-700 bg-sky-50 rounded-lg px-2 py-1.5">
          Paid {money(payResult.total_paid_pence)}
          {payResult.shortfall_pence > 0 && (
            <span className="text-rose-600"> · {money(payResult.shortfall_pence)} shortfall</span>
          )}
        </p>
      )}

      <AddBillForm familyId={familyId} childId={kid.id} />

      <button
        onClick={() => setHistoryOpen((o) => !o)}
        className="mt-2 text-xs font-semibold text-slate-400 hover:text-slate-600 transition"
      >
        {historyOpen ? "Hide" : "Show"} pay day history
      </button>
      {historyOpen && <BillHistory childId={kid.id} />}
    </div>
  );
}
