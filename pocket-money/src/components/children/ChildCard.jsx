import { ListChecks, ChevronRight } from "lucide-react";
import { useMoney } from "../../hooks/useCurrency";
import { Avatar, Card, Row, Divider, avatarColors } from "../ui";
import { JarStats } from "../Jars";

export function ChildCard({ kid, balance, onOpen }) {
  const money = useMoney();
  const [accent] = avatarColors(kid.name);
  const total = balance?.total_pence ?? 0;
  const spend = balance?.spend_pence ?? 0;

  return (
    <Card accent={accent} className="p-4">
      <div className="flex items-center gap-3">
        <Avatar name={kid.name} size={52} />
        <div className="flex-1 min-w-0">
          <div className="text-[16px] font-semibold text-ink truncate">{kid.name}</div>
          <Row label="Spend balance" value={money(spend)} />
          <Row label="Total" value={money(total)} strong />
        </div>
      </div>
      <Divider />
      <JarStats balance={balance} compact />
      <Divider />
      <button
        onClick={onOpen}
        className="w-full flex items-center justify-between text-[14px] font-semibold text-brand-600 hover:text-brand-700 transition py-0.5"
      >
        <span className="inline-flex items-center gap-2">
          <ListChecks size={18} /> Open {kid.name}'s chores
        </span>
        <ChevronRight size={18} className="text-ink-muted" />
      </button>
    </Card>
  );
}
