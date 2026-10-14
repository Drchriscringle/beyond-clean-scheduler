import { useState } from "react";
import { LogOut, Settings as SettingsIcon, Users, ClipboardCheck, Star, Receipt } from "lucide-react";
import { Page, Avatar, Card, Eyebrow, Empty, Logo } from "../components/ui";
import { Section } from "../components/common";
import { InviteCoParent } from "../components/InviteCoParent";
import { ChildCard } from "../components/children/ChildCard";
import { AddChildForm } from "../components/children/AddChildForm";
import { ClaimRow } from "../components/chores/ClaimRow";
import { ChoreChip } from "../components/chores/ChoreChip";
import { AddChoreForm } from "../components/chores/AddChoreForm";
import { ChildBillsCard } from "../components/bills/ChildBillsCard";
import { PinPad } from "../components/PinPad";
import { ChildView } from "./ChildView";
import { Settings } from "./Settings";
import * as api from "../lib/api";
import { useMoney } from "../hooks/useCurrency";
import { useChildren } from "../hooks/useChildren";
import { useChores } from "../hooks/useChores";
import { usePendingClaims, useClaimsRealtime } from "../hooks/useClaims";
import { useChildBalances } from "../hooks/useBalances";
import { useChildrenBills } from "../hooks/useBills";
import { trialDaysLeft } from "../lib/subscription";

export function FamilyDashboard({ family, parentEmail }) {
  const money = useMoney();
  const [pinTarget, setPinTarget] = useState(null);
  const [activeChildId, setActiveChildId] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { data: children = [] } = useChildren();
  const { data: chores = [] } = useChores();
  const { data: pending = [] } = usePendingClaims();
  const balances = useChildBalances(children);
  const bills = useChildrenBills(children);
  useClaimsRealtime(family.id);

  if (settingsOpen) return <Settings family={family} onExit={() => setSettingsOpen(false)} />;

  const activeChild = children.find((k) => k.id === activeChildId);
  if (activeChild) {
    return (
      <ChildView
        kid={activeChild}
        family={family}
        chores={chores}
        pending={pending}
        balance={balances[activeChild.id]}
        bills={bills[activeChild.id] || []}
        onExit={() => setActiveChildId(null)}
      />
    );
  }

  const familyTotal = children.reduce((sum, kid) => sum + (balances[kid.id]?.total_pence ?? 0), 0);
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
      <Card className="p-5 text-white border-0 bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[12.5px] text-white/70">Total pocket money</div>
            <div className="text-[32px] font-bold tabular-nums tracking-tight leading-none mt-1">{money(familyTotal)}</div>
            <div className="text-[12.5px] text-white/70 mt-2">
              {children.length} {children.length === 1 ? "child" : "children"} · {pending.length} awaiting approval
            </div>
          </div>
          <div className="opacity-90"><Logo size={44} /></div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-2 flex-wrap">
          <InviteCoParent light />
          {daysLeft !== null && <span className="text-[11.5px] text-white/70">Free trial · {daysLeft} days left</span>}
        </div>
      </Card>

      <Eyebrow>Children</Eyebrow>
      <div className="space-y-3">
        {children.map((kid) => (
          <ChildCard key={kid.id} kid={kid} balance={balances[kid.id]} onOpen={() => setPinTarget(kid)} />
        ))}
        {children.length === 0 && (
          <Card className="p-5 text-center">
            <Users size={22} className="mx-auto text-brand-500 mb-2" />
            <p className="text-[13.5px] text-ink-muted">Add your first child to get started.</p>
          </Card>
        )}
        <AddChildForm familyId={family.id} />
      </div>

      <Eyebrow>Awaiting approval</Eyebrow>
      <Section title="Chores to check" icon={<ClipboardCheck size={18} />} badge={pending.length}>
        {pending.map((claim) => <ClaimRow key={claim.id} claim={claim} />)}
        {pending.length === 0 && <Empty>Nothing waiting — all caught up.</Empty>}
      </Section>

      <Eyebrow>Chores</Eyebrow>
      <Section title="Available chores" icon={<Star size={18} />}>
        {chores.map((c) => <ChoreChip key={c.id} chore={c} />)}
        {chores.length === 0 && <Empty>No chores yet.</Empty>}
        <AddChoreForm familyId={family.id} />
      </Section>

      <Eyebrow>Bills</Eyebrow>
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
