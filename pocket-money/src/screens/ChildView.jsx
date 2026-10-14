import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Hourglass, Receipt, History, Check, Palette, Trophy } from "lucide-react";
import { Page, Card, Eyebrow, Empty, IconCircle, Pill, Button } from "../components/ui";
import { Section } from "../components/common";
import { JarStats } from "../components/Jars";
import { ChildAvatar } from "../components/children/ChildAvatar";
import { PersonaliseSheet } from "../components/children/PersonaliseSheet";
import { MoneyDrop } from "../components/MoneyDrop";
import { useMoney } from "../hooks/useCurrency";
import { useClaimChore } from "../hooks/useClaims";
import { useRecentActivity } from "../hooks/useActivity";
import { notifyParents } from "../hooks/usePush";
import { themeColor, ThemeBadge, wallpaperStyle } from "../lib/theme";
import { ageMode } from "../lib/ageMode";

export function ChildView({ kid, family, chores, pending, weekClaims = [], balance, bills, onExit }) {
  const money = useMoney();
  const [claimingId, setClaimingId] = useState(null);
  const [justClaimed, setJustClaimed] = useState(null);
  const [personalising, setPersonalising] = useState(false);
  const [drop, setDrop] = useState(null);
  const [err, setErr] = useState("");
  const claimChore = useClaimChore();
  const { data: activity } = useRecentActivity(kid.id, 6);

  const mode = ageMode(kid); // little | middle | big
  const color = themeColor(kid.theme, kid.name);
  const total = balance?.total_pence ?? 0;

  // How many times each chore has been done (or is waiting) this week.
  const doneThisWeek = {};
  for (const c of weekClaims) {
    if (c.status === "pending" || c.status === "approved") doneThisWeek[c.chore_id] = (doneThisWeek[c.chore_id] || 0) + 1;
  }
  const myChores = chores.map((c) => ({ ...c, left: Math.max(0, c.times_per_week - (doneThisWeek[c.id] || 0)) }));
  const available = myChores.filter((c) => c.left > 0);
  const finished = myChores.filter((c) => c.left === 0);
  const myPending = pending.filter((p) => p.children.id === kid.id);
  const earned = weekClaims.filter((c) => c.status === "approved").reduce((s, c) => s + (c.chores?.value_pence || 0), 0);
  const budget = kid.weekly_budget_pence || 0;

  // Celebrate when a grown-up approves something (arrives via realtime).
  const seenApproved = useRef(null);
  useEffect(() => {
    const approved = weekClaims.filter((c) => c.status === "approved");
    if (seenApproved.current === null) {
      seenApproved.current = new Set(approved.map((c) => c.id));
      return;
    }
    const fresh = approved.filter((c) => !seenApproved.current.has(c.id));
    if (fresh.length) {
      fresh.forEach((c) => seenApproved.current.add(c.id));
      setDrop({ amount: fresh.reduce((s, c) => s + (c.chores?.value_pence || 0), 0) });
    }
  }, [weekClaims]);

  const claim = async (chore) => {
    setClaimingId(chore.id);
    setErr("");
    try {
      await claimChore.mutateAsync({ choreId: chore.id, childId: kid.id });
      setJustClaimed(chore.name);
      setTimeout(() => setJustClaimed(null), 2500);
      notifyParents({
        title: `${kid.name} finished a chore`,
        body: `${chore.name} · ${money(chore.value_pence)} — tap to approve`,
      });
    } catch (e) {
      setErr(e?.message?.includes("already done") ? "You've already done that one this week!" : "Something went wrong — ask a grown-up to try again.");
    } finally {
      setClaimingId(null);
    }
  };

  const little = mode === "little";
  const big = mode === "big";

  return (
    <div className="min-h-screen" style={wallpaperStyle(kid.theme?.wallpaper, color)}>
      <Page>
        <header className="flex items-center justify-between pt-5 pb-3">
          <button onClick={onExit} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-muted hover:text-ink transition">
            <ArrowLeft size={16} /> Parent
          </button>
          <button
            onClick={() => setPersonalising(true)}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-white/80 backdrop-blur border border-line text-[13px] font-semibold transition hover:bg-white"
            style={{ color: color.main }}
          >
            <Palette size={15} /> Make it yours
          </button>
        </header>

        <Card className={`${little ? "p-6" : "p-5"} text-white border-0`} style={{ background: `linear-gradient(135deg, ${color.main} 0%, ${color.dark} 100%)` }}>
          <div className="flex items-center gap-4">
            <ChildAvatar kid={kid} size={little ? 76 : 60} className="ring-4 ring-white/25" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[13px] text-white/75">
                <span>{little ? `Hi ${kid.name}! You have` : `Hi ${kid.name}, you have`}</span>
                {kid.avatar_url && <ThemeBadge theme={kid.theme} name={kid.name} size={26} onDark />}
              </div>
              <div className={`${little ? "text-[44px]" : "text-[32px]"} font-bold tabular-nums tracking-tight leading-none mt-1`}>{money(total)}</div>
            </div>
          </div>
          {budget > 0 && !little && (
            <div className="mt-4">
              <div className="flex items-baseline justify-between text-[12px] text-white/80 mb-1.5">
                <span>Earned this week</span>
                <span className="tabular-nums font-semibold text-white">{money(earned)} of {money(budget)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
                <div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: `${Math.min(100, (earned / budget) * 100)}%` }} />
              </div>
            </div>
          )}
        </Card>

        <Eyebrow>Your jars</Eyebrow>
        <Card className={`p-4 ${drop ? "jar-bump" : ""}`}>
          <JarStats balance={balance} />
        </Card>

        {justClaimed && (
          <p className="mt-4 text-[13px] font-medium text-emerald-800 bg-emerald-50 rounded-xl px-4 py-3 flex items-center gap-2">
            <Check size={16} /> {little ? "Brilliant! A grown-up will check it." : `Nice! "${justClaimed}" is waiting for a grown-up to approve.`}
          </p>
        )}
        {err && <p className="mt-4 text-[13px] font-medium text-rose-700 bg-rose-50 rounded-xl px-4 py-3">{err}</p>}

        <Eyebrow>{little ? "Jobs to do" : "Chores you can do"}</Eyebrow>
        {little ? (
          <div className="space-y-3">
            {available.map((c) => (
              <Card key={c.id} className="p-4 flex items-center gap-4">
                <IconCircle tone="amber" size={64}>{c.icon}</IconCircle>
                <div className="flex-1 min-w-0">
                  <div className="text-[18px] font-bold text-ink leading-snug">{c.name}</div>
                  <div className="text-[13px] text-ink-muted mt-0.5">{c.left} more {c.left === 1 ? "time" : "times"} this week</div>
                </div>
                <Button size="lg" onClick={() => claim(c)} disabled={claimingId === c.id} style={{ background: color.main }} className="shrink-0 px-4">
                  <Check size={18} /> I did it!
                </Button>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {available.map((c) => (
              <Card key={c.id} onClick={() => claim(c)} className={`p-4 ${claimingId === c.id ? "opacity-50" : ""}`}>
                <div className="flex items-start justify-between">
                  <IconCircle tone="amber" size={40}>{c.icon}</IconCircle>
                  {c.times_per_week > 1 && <Pill tone="grey">{c.left} left</Pill>}
                </div>
                <div className="mt-3 text-[14px] font-semibold text-ink leading-snug">{c.name}</div>
                <div className="mt-2 flex items-center justify-between">
                  <Pill tone="green">+{money(c.value_pence)}</Pill>
                  <span className="text-[12px] font-semibold" style={{ color: color.main }}>Done →</span>
                </div>
              </Card>
            ))}
          </div>
        )}
        {available.length === 0 && (
          <Card className="p-5 text-center">
            <Trophy size={24} className="mx-auto mb-2" style={{ color: color.main }} />
            <p className="text-[14px] font-semibold text-ink">{myChores.length ? "All done for this week!" : "No chores set yet."}</p>
            <p className="text-[12.5px] text-ink-muted mt-1">{myChores.length ? "New ones unlock on Monday." : "Ask a grown-up to add some."}</p>
          </Card>
        )}

        {myPending.length > 0 && (
          <>
            <Eyebrow>{little ? "Waiting for a grown-up" : "Waiting for approval"}</Eyebrow>
            <Section title={little ? "Checking…" : "Sent to a grown-up"} icon={<Hourglass size={18} />}>
              {myPending.map((p) => (
                <div key={p.id} className="flex items-center gap-3 py-2.5 border-b border-line last:border-0">
                  <IconCircle tone="grey" size={36}>{p.chores?.icon}</IconCircle>
                  <span className="flex-1 text-[14px] font-medium text-ink">{p.chores?.name}</span>
                  <Pill tone="grey">{money(p.chores?.value_pence)}</Pill>
                </div>
              ))}
            </Section>
          </>
        )}

        {big && finished.length > 0 && (
          <>
            <Eyebrow>Done this week</Eyebrow>
            <Section title="Finished" icon={<Check size={18} />}>
              {finished.map((c) => (
                <div key={c.id} className="flex items-center gap-3 py-2.5 border-b border-line last:border-0">
                  <IconCircle tone="green" size={36}>{c.icon}</IconCircle>
                  <span className="flex-1 text-[14px] font-medium text-ink">{c.name}</span>
                  <Pill tone="green">{c.times_per_week}× done</Pill>
                </div>
              ))}
            </Section>
          </>
        )}

        {bills.length > 0 && !little && (
          <>
            <Eyebrow>What you pay for</Eyebrow>
            <Section title="Your bills" icon={<Receipt size={18} />} subtitle="Real bills, just like grown-ups have.">
              {bills.map((b) => (
                <div key={b.id} className="flex items-center gap-3 py-2.5 border-b border-line last:border-0">
                  <IconCircle tone="blue" size={36}>{b.icon}</IconCircle>
                  <span className="flex-1 text-[14px] font-medium text-ink">{b.name}</span>
                  <Pill tone="blue">{money(b.amount_pence)}/{b.frequency === "weekly" ? "wk" : "mo"}</Pill>
                </div>
              ))}
            </Section>
          </>
        )}

        {!little && (
          <>
            <Eyebrow>Recent activity</Eyebrow>
            <Section title="What's happened" icon={<History size={18} />}>
              {(activity || []).map((a) => (
                <div key={a.id} className="flex items-center gap-3 py-2.5 border-b border-line last:border-0">
                  <IconCircle tone="grey" size={36}>{a.chores?.icon || "•"}</IconCircle>
                  <span className="flex-1 text-[14px] text-ink">{a.chores?.name}</span>
                  <Pill tone={a.status === "approved" ? "green" : a.status === "declined" ? "rose" : "grey"}>
                    {a.status === "approved" ? `+${money(a.chores?.value_pence)}` : a.status}
                  </Pill>
                </div>
              ))}
              {activity !== undefined && activity.length === 0 && <Empty>Nothing yet — pick a chore above!</Empty>}
            </Section>
          </>
        )}
      </Page>

      {personalising && <PersonaliseSheet kid={kid} familyId={family.id} onClose={() => setPersonalising(false)} />}
      {drop && <MoneyDrop amount={drop.amount} color={color.main} label={little ? "Well done!" : "into your jars!"} onDone={() => setDrop(null)} />}
    </div>
  );
}
