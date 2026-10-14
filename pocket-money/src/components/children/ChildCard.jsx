import { ListChecks, ChevronRight } from "lucide-react";
import { useMoney } from "../../hooks/useCurrency";
import { themeColor, ThemeBadge } from "../../lib/theme";
import { Card, Row, Divider, Progress } from "../ui";
import { JarStats } from "../Jars";
import { ChildAvatar } from "./ChildAvatar";

export function ChildCard({ kid, balance, weekClaims = [], onOpen }) {
  const money = useMoney();
  const color = themeColor(kid.theme, kid.name);
  const total = balance?.total_pence ?? 0;
  const spend = balance?.spend_pence ?? 0;
  const budget = kid.weekly_budget_pence || 0;
  const earned = weekClaims.filter((c) => c.status === "approved").reduce((s, c) => s + (c.chores?.value_pence || 0), 0);

  return (
    <Card accent={color.main} className="p-4">
      <div className="flex items-center gap-3">
        <ChildAvatar kid={kid} size={52} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[16px] font-semibold text-ink truncate">{kid.name}</span>
            {kid.avatar_url && <ThemeBadge theme={kid.theme} name={kid.name} size={24} />}
          </div>
          <Row label="Spend balance" value={money(spend)} />
          <Row label="Total" value={money(total)} strong />
        </div>
      </div>
      <Divider />
      <JarStats balance={balance} compact />
      {budget > 0 && (
        <>
          <Divider />
          <div className="flex items-baseline justify-between text-[12.5px] mb-1.5">
            <span className="text-ink-muted">Earned this week</span>
            <span className="font-semibold tabular-nums text-ink">
              {money(earned)} <span className="text-ink-muted font-normal">of {money(budget)}</span>
            </span>
          </div>
          <Progress value={(earned / budget) * 100} color={color.main} />
        </>
      )}
      <Divider />
      <button
        onClick={onOpen}
        className="w-full flex items-center justify-between text-[14px] font-semibold transition py-0.5"
        style={{ color: color.main }}
      >
        <span className="inline-flex items-center gap-2">
          <ListChecks size={18} /> Open {kid.name}'s chores
        </span>
        <ChevronRight size={18} className="text-ink-muted" />
      </button>
    </Card>
  );
}
