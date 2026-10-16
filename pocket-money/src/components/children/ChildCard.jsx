import { useState } from "react";
import { ListChecks, ChevronRight, ChevronDown, KeyRound, Gift } from "lucide-react";
import { useMoney } from "../../hooks/useCurrency";
import { themeColor, ThemeBadge } from "../../lib/theme";
import { Card, Row, Divider, Progress } from "../ui";
import { JarStats } from "../Jars";
import { ChildAvatar } from "./ChildAvatar";
import { AgeEditor } from "./AgeEditor";
import { BudgetEditor } from "./BudgetEditor";
import { ChildLoginCard } from "./ChildLoginCard";
import { ScreenTime } from "./ScreenTime";
import { QuizRewardSettings } from "./QuizRewardSettings";

// Parent Home: one card per child — balances, this week's progress, their
// pocket-money level and age, and their sign-in details for their own device.
export function ChildCard({ kid, balance, weekClaims = [], usage, points = 0, onOpen, showSetup = true }) {
  const money = useMoney();
  const color = themeColor(kid.theme, kid.name);
  const [loginOpen, setLoginOpen] = useState(false);
  const [rewardsOpen, setRewardsOpen] = useState(false);
  const total = balance?.total_pence ?? 0;
  const spend = balance?.spend_pence ?? 0;
  const budget = kid.weekly_budget_pence || 0;
  const earned = weekClaims.filter((c) => c.status === "approved").reduce((s, c) => s + (c.chores?.value_pence || 0), 0);

  return (
    <Card accent={color.fill} className="p-4">
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
        {showSetup && (
          <div className="flex items-start gap-2">
            <BudgetEditor kid={kid} />
            <AgeEditor kid={kid} />
          </div>
        )}
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
      {showSetup && (
        <>
          <Divider />
          <button
            onClick={() => setLoginOpen((o) => !o)}
            className="w-full flex items-center justify-between text-[14px] font-semibold text-ink transition py-0.5"
            aria-expanded={loginOpen}
          >
            <span className="inline-flex items-center gap-2">
              <KeyRound size={17} className="text-ink-muted" /> Sign-in details
              {!kid.username && <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">not set up</span>}
            </span>
            <ChevronDown size={18} className={`text-ink-muted transition ${loginOpen ? "rotate-180" : ""}`} />
          </button>
          {loginOpen && <div className="mt-3"><ChildLoginCard kid={kid} /></div>}
          <Divider />
          <button
            onClick={() => setRewardsOpen((o) => !o)}
            className="w-full flex items-center justify-between text-[14px] font-semibold text-ink transition py-0.5"
            aria-expanded={rewardsOpen}
          >
            <span className="inline-flex items-center gap-2">
              <Gift size={17} className="text-ink-muted" /> Quiz &amp; game rewards
              <span className="text-[12.5px] font-medium text-ink-muted">
                {kid.quiz_reward_mode === "money" ? `${money(kid.quiz_reward_pence)} a right answer` : kid.quiz_reward_mode === "none" ? "off" : `${kid.quiz_points_per_correct} pt a right answer · ${points} saved`}
              </span>
            </span>
            <ChevronDown size={18} className={`text-ink-muted transition ${rewardsOpen ? "rotate-180" : ""}`} />
          </button>
          {rewardsOpen && <div className="mt-3"><QuizRewardSettings kid={kid} points={points} /></div>}
          <Divider />
          <ScreenTime usage={usage} color={color.main} />
        </>
      )}
      <Divider />
      <button
        onClick={onOpen}
        className="w-full flex items-center justify-between text-[14px] font-semibold transition py-0.5"
        style={{ color: color.main }}
      >
        <span className="inline-flex items-center gap-2">
          <ListChecks size={18} /> Preview {kid.name}'s screen
        </span>
        <ChevronRight size={18} className="text-ink-muted" />
      </button>
    </Card>
  );
}
