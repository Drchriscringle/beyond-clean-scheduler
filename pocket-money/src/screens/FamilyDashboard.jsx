import { useState } from "react";
import { LogOut, Settings as SettingsIcon, Users, ClipboardCheck, Receipt } from "lucide-react";
import { Page, Avatar, Card, Eyebrow, Empty, Logo } from "../components/ui";
import { Section } from "../components/common";
import { InviteCoParent } from "../components/InviteCoParent";
import { ChildCard } from "../components/children/ChildCard";
import { AddChildForm } from "../components/children/AddChildForm";
import { ChildChoresCard } from "../components/children/ChildChoresCard";
import { ClaimRow } from "../components/chores/ClaimRow";
import { ChildBillsCard } from "../components/bills/ChildBillsCard";
import { PinPad } from "../components/PinPad";
import { MoneyDrop } from "../components/MoneyDrop";
import { Tip } from "../components/Tip";
import { WelcomeTour } from "../components/WelcomeTour";
import { tipsEnabled, isTipSeen, markTipSeen } from "../lib/tips";
import { ChildView } from "./ChildView";
import { Settings } from "./Settings";
import * as api from "../lib/api";
import { useMoney } from "../hooks/useCurrency";
import { useChildren } from "../hooks/useChildren";
import { useChores } from "../hooks/useChores";
import { usePendingClaims, useWeekClaims, useClaimsRealtime } from "../hooks/useClaims";
import { useChildBalances } from "../hooks/useBalances";
import { useChildrenBills } from "../hooks/useBills";
import { trialDaysLeft } from "../lib/subscription";

export function FamilyDashboard({ family, parentEmail }) {
  const money = useMoney();
  const [pinTarget, setPinTarget] = useState(null);
  const [activeChildId, setActiveChildId] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [drop, setDrop] = useState(null);
  const [tourOpen, setTourOpen] = useState(() => tipsEnabled() && !isTipSeen("welcome-tour"));

  const { data: children = [] } = useChildren();
  const { data: chores = [] } = useChores();
  const { data: pending = [] } = usePendingClaims();
  const { data: weekClaims = [] } = useWeekClaims();
  const balances = useChildBalances(children);
  const bills = useChildrenBills(children);
  useClaimsRealtime(family.id);

  if (settingsOpen) {
    return <Settings family={family} onExit={() => setSettingsOpen(false)} onShowTour={() => { setSettingsOpen(false); setTourOpen(true); }} />;
  }

  const activeChild = children.find((k) => k.id === activeChildId);
  if (activeChild) {
    return (
      <ChildView
        kid={activeChild}
        family={family}
        chores={chores.filter((c) => c.child_id === activeChild.id || c.child_id == null)}
        pending={pending}
        weekClaims={weekClaims.filter((c) => c.child_id === activeChild.id)}
        balance={balances[activeChild.id]}
        bills={bills[activeChild.id] || []}
        onExit={() => setActiveChildId(null)}
      />
    );
  }

  const familyTotal = children.reduce((sum, kid) => sum + (balances[kid.id]?.total_pence ?? 0), 0);
  const weeklyBudget = children.reduce((sum, kid) => sum + (kid.weekly_budget_pence || 0), 0);
  const daysLeft = family.subscription_status === "trial" ? trialDaysLeft(family) : null;

  return (
    <Page>
      <header className="flex items-center justify-between pt-5 pb-2">
        <div className="flex items-center gap-3">
          <Avatar name={parentEmail || family.name} size={40} />
          <div>
            <div className="text-[12px] text-ink-muted leading-tight">Welcome back</div>
            <div className="text-[15px] font-semibold text-ink leading-tight">{family.name}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <IconButton label="Settings" onClick={() => setSettingsOpen(true)}><SettingsIcon size={19} /></IconButton>
          <IconButton label="Sign out" onClick={() => api.signOut()}><LogOut size={19} /></IconButton>
        </div>
      </header>

      <Eyebrow>Family overview</Eyebrow>
      <Tip id="dash-overview" title="Welcome to Pocket Money">
        This card shows your family's total and how much is up for grabs this week. Everything else is in order below: chores waiting for your approval, each child, this week's chores and pocket money, and bills.
      </Tip>
      <Card className="p-5 text-white border-0 bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[12.5px] text-white/70">Total pocket money</div>
            <div className="text-[32px] font-bold tabular-nums tracking-tight leading-none mt-1">{money(familyTotal)}</div>
            <div className="text-[12.5px] text-white/70 mt-2">
              {money(weeklyBudget)} a week up for grabs · {pending.length} awaiting approval
            </div>
          </div>
          <div className="opacity-90"><Logo size={44} /></div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-2 flex-wrap">
          <InviteCoParent light />
          {daysLeft !== null && <span className="text-[11.5px] text-white/70">Free trial · {daysLeft} days left</span>}
        </div>
      </Card>

      <Eyebrow>Awaiting approval</Eyebrow>
      <Tip id="dash-approve" title="Approving chores">
        When a child marks a chore done it appears here (and you get an alert if they're on). Check it's really done, then tap Approve — the money drops into their jars with a little celebration. Decline sends it back.
      </Tip>
      <Section title="Chores to check" icon={<ClipboardCheck size={18} />} badge={pending.length}>
        {pending.map((claim) => (
          <ClaimRow key={claim.id} claim={claim} onApproved={({ amount, childName }) => setDrop({ amount, label: `sent to ${childName}` })} />
        ))}
        {pending.length === 0 && <Empty>Nothing waiting — all caught up.</Empty>}
      </Section>

      <Eyebrow>Children</Eyebrow>
      <Tip id="dash-children" title="Each child has their own screen">
        Tap "Open … chores" to switch to a child's view — it's locked behind their PIN. On their screen they can mark chores done and make it their own with colours, an icon, a photo and a wallpaper. Set their age here so their screen suits them.
      </Tip>
      <div className="space-y-3">
        {children.map((kid) => (
          <ChildCard
            key={kid.id}
            kid={kid}
            balance={balances[kid.id]}
            weekClaims={weekClaims.filter((c) => c.child_id === kid.id)}
            onOpen={() => setPinTarget(kid)}
          />
        ))}
        {children.length === 0 && (
          <Card className="p-5 text-center">
            <Users size={22} className="mx-auto text-brand-500 mb-2" />
            <p className="text-[13.5px] text-ink-muted">Add your first child to get started.</p>
          </Card>
        )}
        <AddChildForm familyId={family.id} />
      </div>

      <Eyebrow>This week's chores &amp; pocket money</Eyebrow>
      <Tip id="dash-weekly" title="How weekly pocket money works">
        Set how much each child can earn per week, then add their chores with how many times a week they can do each one. The amount is split evenly across every completion — or give any chore its own amount and the rest re-balance. Limits reset every Monday.
      </Tip>
      <p className="text-[12.5px] text-ink-muted -mt-1 mb-3 px-1 leading-relaxed">
        Set how much each child can earn this week, then add their chores. The amount is split across every completion automatically — or give any chore its own amount.
      </p>
      <div className="space-y-3">
        {children.map((kid) => (
          <ChildChoresCard
            key={kid.id}
            kid={kid}
            familyId={family.id}
            chores={chores.filter((c) => c.child_id === kid.id)}
            weekClaims={weekClaims.filter((c) => c.child_id === kid.id)}
          />
        ))}
        {children.length === 0 && <Empty>Add a child first.</Empty>}
      </div>

      <Eyebrow>Bills</Eyebrow>
      <Tip id="dash-bills" title="Bills (optional)">
        Pretend household bills teach that money goes out as well as in. Add a weekly bill per child and tap "Pay day" to take it from their total — if they can't cover it, the shortfall is recorded rather than taking them into debt.
      </Tip>
      <p className="text-[12.5px] text-ink-muted -mt-1 mb-3 px-1 leading-relaxed">
        Weekly household bills per child. Pay day deducts them from the child's total, so earning and paying for essentials come from the same pot.
      </p>
      <div className="space-y-3">
        {children.map((kid) => (
          <ChildBillsCard key={kid.id} kid={kid} familyId={family.id} bills={bills[kid.id] || []} />
        ))}
        {children.length === 0 && (
          <Card className="p-5 text-center">
            <Receipt size={22} className="mx-auto text-brand-500 mb-2" />
            <p className="text-[13.5px] text-ink-muted">Add a child first.</p>
          </Card>
        )}
      </div>

      {pinTarget && (
        <PinPad
          kid={pinTarget}
          onCancel={() => setPinTarget(null)}
          onSuccess={() => {
            setActiveChildId(pinTarget.id);
            setPinTarget(null);
          }}
        />
      )}
      {drop && <MoneyDrop amount={drop.amount} label={drop.label} onDone={() => setDrop(null)} />}
      {tourOpen && <WelcomeTour onClose={() => { markTipSeen("welcome-tour"); setTourOpen(false); }} />}
    </Page>
  );
}

function IconButton({ children, label, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="h-10 w-10 rounded-full flex items-center justify-center text-ink-muted hover:text-ink hover:bg-white transition"
    >
      {children}
    </button>
  );
}
