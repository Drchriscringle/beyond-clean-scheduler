import { useState } from "react";
import { LogOut, Settings as SettingsIcon, Users, ClipboardCheck, Receipt, House, ClipboardList, PiggyBank } from "lucide-react";
import { Page, Avatar, Card, Eyebrow, Empty, Logo } from "../components/ui";
import { Section } from "../components/common";
import { InviteCoParent } from "../components/InviteCoParent";
import { ChildCard } from "../components/children/ChildCard";
import { AddChildForm } from "../components/children/AddChildForm";
import { ChildChoresCard } from "../components/children/ChildChoresCard";
import { ChildAvatar } from "../components/children/ChildAvatar";
import { ClaimRow } from "../components/chores/ClaimRow";
import { ChoreIdeas } from "../components/chores/ChoreIdeas";
import { DayPlanner } from "../components/chores/DayPlanner";
import { ChildBillsCard } from "../components/bills/ChildBillsCard";
import { MessagesCard } from "../components/messages/MessagesCard";
import { MessagesSheet } from "../components/messages/MessagesSheet";
import { JarStats } from "../components/Jars";
import { PinPad } from "../components/PinPad";
import { MoneyDrop } from "../components/MoneyDrop";
import { Tip } from "../components/Tip";
import { TabBar } from "../components/TabBar";
import { WelcomeTour } from "../components/WelcomeTour";
import { tipsEnabled, isTipSeen, markTipSeen } from "../lib/tips";
import { themeColor } from "../lib/theme";
import { ChildView } from "./ChildView";
import { Settings } from "./Settings";
import * as api from "../lib/api";
import { useMoney } from "../hooks/useCurrency";
import { useChildren } from "../hooks/useChildren";
import { useChores, useRefreshChoreSchedules } from "../hooks/useChores";
import { usePendingClaims, useWeekClaims, useClaimsRealtime } from "../hooks/useClaims";
import { useChildBalances } from "../hooks/useBalances";
import { useChildrenBills } from "../hooks/useBills";
import { useUnreadMessages, useMessagesRealtime } from "../hooks/useMessages";
import { trialDaysLeft } from "../lib/subscription";

const TABS = [
  { key: "home", label: "Home", icon: House },
  { key: "chores", label: "Chores", icon: ClipboardList },
  { key: "jars", label: "Bills & Jars", icon: PiggyBank },
];

export function FamilyDashboard({ family, parentEmail }) {
  const [tab, setTab] = useState("home");
  const [pinTarget, setPinTarget] = useState(null);
  const [activeChildId, setActiveChildId] = useState(null);
  const [chatChildId, setChatChildId] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [drop, setDrop] = useState(null);
  const [tourOpen, setTourOpen] = useState(() => tipsEnabled() && !isTipSeen("welcome-tour"));

  const { data: children = [] } = useChildren();
  const { data: chores = [] } = useChores();
  const { data: pending = [] } = usePendingClaims();
  const { data: weekClaims = [] } = useWeekClaims();
  const { data: unread = {} } = useUnreadMessages("parent");
  const balances = useChildBalances(children);
  const bills = useChildrenBills(children);
  useClaimsRealtime(family.id);
  useMessagesRealtime(family.id);
  useRefreshChoreSchedules();

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

  const unreadTotal = Object.values(unread).reduce((s, n) => s + n, 0);
  const chatChild = children.find((k) => k.id === chatChildId);

  return (
    <Page className="pb-28">
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

      {tab === "home" && (
        <HomeTab
          family={family}
          kids={children}
          pending={pending}
          weekClaims={weekClaims}
          balances={balances}
          unread={unread}
          onApproved={(d) => setDrop(d)}
          onOpenChild={(kid) => setPinTarget(kid)}
          onOpenChat={(kid) => setChatChildId(kid.id)}
        />
      )}
      {tab === "chores" && <ChoresTab family={family} kids={children} chores={chores} weekClaims={weekClaims} />}
      {tab === "jars" && <JarsTab family={family} kids={children} balances={balances} bills={bills} />}

      <TabBar tabs={TABS} active={tab} onChange={setTab} badges={{ home: pending.length + unreadTotal }} />

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
      {chatChild && <MessagesSheet kid={chatChild} me="parent" onClose={() => setChatChildId(null)} />}
      {drop && <MoneyDrop amount={drop.amount} label={drop.label} onDone={() => setDrop(null)} />}
      {tourOpen && <WelcomeTour onClose={() => { markTipSeen("welcome-tour"); setTourOpen(false); }} />}
    </Page>
  );
}

/* ---------------- Home: welcome, approvals, messages, set-up ---------------- */

function HomeTab({ family, kids, pending, weekClaims, balances, unread, onApproved, onOpenChild, onOpenChat }) {
  const money = useMoney();
  const familyTotal = kids.reduce((sum, kid) => sum + (balances[kid.id]?.total_pence ?? 0), 0);
  const weeklyBudget = kids.reduce((sum, kid) => sum + (kid.weekly_budget_pence || 0), 0);
  const daysLeft = family.subscription_status === "trial" ? trialDaysLeft(family) : null;

  return (
    <>
      <Eyebrow>Family overview</Eyebrow>
      <Tip id="dash-overview" title="Welcome to Pocket Money">
        This is your home tab: the family total, chores waiting for your approval, messages from the kids, and each child's set-up. Chores live in the Chores tab; bills and jars in Bills &amp; Jars.
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
          <ClaimRow key={claim.id} claim={claim} onApproved={({ amount, childName }) => onApproved({ amount, label: `sent to ${childName}` })} />
        ))}
        {pending.length === 0 && <Empty>Nothing waiting — all caught up.</Empty>}
      </Section>

      <Eyebrow>Messages</Eyebrow>
      <Tip id="dash-messages" title="Chat with each child">
        Once a child is signed in on their own device you can message each other here — with one-tap quick replies for little ones. You'll both get an alert when something new arrives.
      </Tip>
      <MessagesCard kids={kids} unread={unread} onOpen={onOpenChat} />

      <Eyebrow>Children &amp; set-up</Eyebrow>
      <Tip id="dash-children" title="Each child's set-up">
        Set how much each child can earn per week and their age here. Open "Sign-in details" to give them a username and PIN for their own phone or tablet — you can always see the PIN. "Preview" shows you exactly what they see.
      </Tip>
      <div className="space-y-3">
        {kids.map((kid) => (
          <ChildCard
            key={kid.id}
            kid={kid}
            balance={balances[kid.id]}
            weekClaims={weekClaims.filter((c) => c.child_id === kid.id)}
            onOpen={() => onOpenChild(kid)}
          />
        ))}
        {kids.length === 0 && (
          <Card className="p-5 text-center">
            <Users size={22} className="mx-auto text-brand-500 mb-2" />
            <p className="text-[13.5px] text-ink-muted">Add your first child to get started.</p>
          </Card>
        )}
        <AddChildForm familyId={family.id} />
      </div>
    </>
  );
}

/* ---------------- Chores: hand out chores, each child's week ---------------- */

function ChoresTab({ family, kids, chores, weekClaims }) {
  return (
    <>
      <Eyebrow>Plan the week</Eyebrow>
      <Tip id="dash-planner" title="Today and the next seven days">
        Tap a day to see what each child has on. "Every day" chores show on every day, planned chores on the days you picked, and "any day" chores can be done whenever during the week. Add a chore straight onto a day from here.
      </Tip>
      {kids.length > 0 && <DayPlanner familyId={family.id} kids={kids} chores={chores} weekClaims={weekClaims} />}

      <Eyebrow>Chores to give out</Eyebrow>
      <Tip id="dash-weekly" title="How weekly pocket money works">
        Each child has a weekly amount (set on Home). Add their chores and choose when: any days this week, every day, or picked days. The amount splits evenly across every completion this week, or give a chore its own amount and the rest re-balance.
      </Tip>
      {kids.length > 0 ? (
        <ChoreIdeas familyId={family.id} kids={kids} existing={chores} />
      ) : (
        <Card className="p-5 text-center">
          <ClipboardList size={22} className="mx-auto text-brand-500 mb-2" />
          <p className="text-[13.5px] text-ink-muted">Add a child on the Home tab first.</p>
        </Card>
      )}

      {kids.map((kid) => (
        <div key={kid.id}>
          <Eyebrow>{kid.name}'s chores this week</Eyebrow>
          <ChildChoresCard
            kid={kid}
            familyId={family.id}
            chores={chores.filter((c) => c.child_id === kid.id)}
            weekClaims={weekClaims.filter((c) => c.child_id === kid.id)}
          />
        </div>
      ))}
    </>
  );
}

/* ---------------- Bills & Jars ---------------- */

function JarsTab({ family, kids, balances, bills }) {
  const money = useMoney();
  return (
    <>
      <Eyebrow>Jars</Eyebrow>
      <Tip id="dash-jars" title="Save, Spend, Give">
        Every approved chore is split into three jars so kids learn to put some aside and share some. The bars show how each jar compares.
      </Tip>
      <div className="space-y-3">
        {kids.map((kid) => {
          const color = themeColor(kid.theme, kid.name);
          return (
            <Card key={kid.id} className="p-4" accent={color.main}>
              <div className="flex items-center gap-3 mb-3">
                <ChildAvatar kid={kid} size={44} />
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-semibold text-ink truncate">{kid.name}</div>
                  <div className="text-[12.5px] text-ink-muted">Total {money(balances[kid.id]?.total_pence ?? 0)}</div>
                </div>
              </div>
              <JarStats balance={balances[kid.id]} />
            </Card>
          );
        })}
        {kids.length === 0 && <Empty>Add a child on the Home tab first.</Empty>}
      </div>

      <Eyebrow>Bills</Eyebrow>
      <Tip id="dash-bills" title="Bills (optional)">
        Pretend household bills teach that money goes out as well as in. Add a weekly bill per child and tap "Pay day" to take it from their total — if they can't cover it, the shortfall is recorded rather than taking them into debt.
      </Tip>
      <div className="space-y-3">
        {kids.map((kid) => (
          <ChildBillsCard key={kid.id} kid={kid} familyId={family.id} bills={bills[kid.id] || []} />
        ))}
        {kids.length === 0 && (
          <Card className="p-5 text-center">
            <Receipt size={22} className="mx-auto text-brand-500 mb-2" />
            <p className="text-[13.5px] text-ink-muted">Add a child first.</p>
          </Card>
        )}
      </div>
    </>
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
