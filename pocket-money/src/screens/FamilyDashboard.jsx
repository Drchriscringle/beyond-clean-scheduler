import { useState } from "react";
import { LogOut, Settings as SettingsIcon } from "lucide-react";
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
import { useChildren } from "../hooks/useChildren";
import { useChores } from "../hooks/useChores";
import { usePendingClaims, useClaimsRealtime } from "../hooks/useClaims";
import { useChildBalances } from "../hooks/useBalances";
import { useChildrenBills } from "../hooks/useBills";

export function FamilyDashboard({ family }) {
  const [pinTarget, setPinTarget] = useState(null); // child being unlocked
  const [activeChildId, setActiveChildId] = useState(null); // child currently in child mode
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { data: children = [] } = useChildren();
  const { data: chores = [] } = useChores();
  const { data: pending = [] } = usePendingClaims();
  const balances = useChildBalances(children);
  const bills = useChildrenBills(children);
  useClaimsRealtime(family.id);

  if (settingsOpen) {
    return <Settings family={family} onExit={() => setSettingsOpen(false)} />;
  }

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

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-8 pb-16">
      <DashboardHeader family={family} onOpenSettings={() => setSettingsOpen(true)} />

      <Section title="Children" emoji="👨‍👩‍👧‍👦" subtitle="Tap a child to open their own screen — locked behind their PIN.">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {children.map((kid) => (
            <ChildCard key={kid.id} kid={kid} balance={balances[kid.id]} onOpen={() => setPinTarget(kid)} />
          ))}
        </div>
        <AddChildForm familyId={family.id} />
      </Section>

      <Section title="Awaiting approval" emoji="✅" badge={pending.length}>
        <div className="space-y-2">
          {pending.map((claim) => (
            <ClaimRow key={claim.id} claim={claim} />
          ))}
          {pending.length === 0 && (
            <p className="text-sm text-slate-400 italic py-2">Nothing waiting. 🎉</p>
          )}
        </div>
      </Section>

      <Section title="Chores" emoji="⭐">
        <div className="flex flex-wrap gap-2">
          {chores.map((c) => (
            <ChoreChip key={c.id} chore={c} />
          ))}
        </div>
        <AddChoreForm familyId={family.id} />
      </Section>

      <Section
        title="Bills"
        emoji="🧾"
        subtitle="Set weekly household bills per child — pay day deducts them from their total balance, so they see saving up for chores and paying for essentials are the same pot."
      >
        <div className="space-y-3">
          {children.map((kid) => (
            <ChildBillsCard key={kid.id} kid={kid} familyId={family.id} bills={bills[kid.id] || []} />
          ))}
          {children.length === 0 && (
            <p className="text-sm text-slate-400 italic py-2">Add a child first.</p>
          )}
        </div>
      </Section>

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
    </div>
  );
}

function DashboardHeader({ family, onOpenSettings }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 pt-2">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-slate-800">🐷 {family.name}</h1>
        <InviteCoParent />
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-indigo-600 transition"
        >
          <SettingsIcon size={16} /> Settings
        </button>
        <button
          onClick={() => api.signOut()}
          className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-rose-600 transition"
        >
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </header>
  );
}
