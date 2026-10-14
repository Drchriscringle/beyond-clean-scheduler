import { useState } from "react";
import { Banknote } from "lucide-react";
import { useMoney } from "../../hooks/useCurrency";
import { useRunBillsNow } from "../../hooks/useBills";
import { Button, Card, Empty, ErrorText } from "../ui";
import { ChildAvatar } from "../children/ChildAvatar";
import { BillChip } from "./BillChip";
import { AddBillForm } from "./AddBillForm";
import { BillHistory } from "./BillHistory";

export function ChildBillsCard({ kid, familyId, bills }) {
  const money = useMoney();
  const [payResult, setPayResult] = useState(null);
  const [payErr, setPayErr] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const runBillsNow = useRunBillsNow();
  const totalWeekly = bills.reduce((sum, b) => sum + (b.frequency === "weekly" ? b.amount_pence : 0), 0);

  const payDay = async () => {
    setPayErr("");
    setPayResult(null);
    try {
      setPayResult(await runBillsNow.mutateAsync(kid.id));
    } catch (e) {
      setPayErr(e.message);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3 mb-2">
        <ChildAvatar kid={kid} size={40} />
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold text-ink truncate">{kid.name}</div>
          <div className="text-[12.5px] text-ink-muted">
            {bills.length > 0 ? `${money(totalWeekly)} / week in bills` : "No bills set"}
          </div>
        </div>
        <Button size="sm" onClick={payDay} disabled={runBillsNow.isPending || bills.length === 0}>
          <Banknote size={15} /> {runBillsNow.isPending ? "Paying…" : "Pay day"}
        </Button>
      </div>

      {bills.map((b) => <BillChip key={b.id} bill={b} />)}
      {bills.length === 0 && <Empty>Add a bill to teach real-world outgoings.</Empty>}

      <ErrorText>{payErr}</ErrorText>
      {payResult && (
        <p className="text-[12.5px] font-medium text-sky-800 bg-sky-50 rounded-lg px-3 py-2 mt-2">
          Paid {money(payResult.total_paid_pence)}
          {payResult.shortfall_pence > 0 && <span className="text-rose-600"> · {money(payResult.shortfall_pence)} short</span>}
        </p>
      )}

      <div className="mt-3">
        <AddBillForm familyId={familyId} childId={kid.id} />
      </div>

      <button
        onClick={() => setHistoryOpen((o) => !o)}
        className="mt-2 text-[12.5px] font-semibold text-ink-muted hover:text-ink transition"
      >
        {historyOpen ? "Hide" : "Show"} pay day history
      </button>
      {historyOpen && <BillHistory childId={kid.id} />}
    </Card>
  );
}
