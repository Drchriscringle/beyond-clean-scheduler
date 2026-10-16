import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Hourglass, Receipt, History, Check, Palette, Trophy, MessageCircle, LogOut, Bell, ChevronRight, CalendarDays, Camera } from "lucide-react";
import { ChoreIcon } from "../lib/choreIcons";
import { dateKey, dueOn, shortDay } from "../lib/schedule";
import { Page, Card, Eyebrow, Empty, IconCircle, Pill, Button } from "../components/ui";
import { Section } from "../components/common";
import { JarStats } from "../components/Jars";
import { ChildAvatar } from "../components/children/ChildAvatar";
import { PersonaliseSheet } from "../components/children/PersonaliseSheet";
import { MessagesSheet } from "../components/messages/MessagesSheet";
import { MoneyDrop } from "../components/MoneyDrop";
import { Tip } from "../components/Tip";
import { WellDone } from "../components/WellDone";
import { LessonCard } from "../components/children/LessonCard";
import { MoneyGamesCard } from "../components/children/MoneyGames";
import { RewardsCard } from "../components/children/RewardsCard";
import { AddClaimPhoto } from "../components/chores/ClaimPhoto";
import { weeklyFlagSeen, markWeeklyFlag, isTipSeen, markTipSeen } from "../lib/tips";
import { weekStartUTC } from "../lib/week";
import { useMoney } from "../hooks/useCurrency";
import { useClaimChore } from "../hooks/useClaims";
import { useRecentActivity } from "../hooks/useActivity";
import { useUnreadMessages } from "../hooks/useMessages";
import { notifyParents, useChoreAlerts } from "../hooks/usePush";
import { themeColor, ThemeBadge, wallpaperStyle } from "../lib/theme";
import { ageMode } from "../lib/ageMode";
import { playTap } from "../lib/sound";

// `ownDevice` = the child is signed in on their own phone/tablet (messages,
// alerts and sign-out appear). Without it, a parent is previewing the screen.
export function ChildView({ kid, family, chores, pending, weekClaims = [], balance, bills, onExit, ownDevice = false, onSignOut }) {
  const money = useMoney();
  const [claimingId, setClaimingId] = useState(null);
  const [justClaimed, setJustClaimed] = useState(null);
  const [personalising, setPersonalising] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [drop, setDrop] = useState(null);
  const [wellDone, setWellDone] = useState(false);
  const [err, setErr] = useState("");
  const claimChore = useClaimChore();
  const { data: activity } = useRecentActivity(kid.id, 6);
  const { data: unread = {} } = useUnreadMessages("child", ownDevice);
  const unreadCount = unread[kid.id] || 0;

  const mode = ageMode(kid); // little | middle | big
  const color = themeColor(kid.theme, kid.name);
  const total = balance?.total_pence ?? 0;

  // What's left: "any day" chores count down over the week; "every day" and
  // planned-day chores are once a day, so they come back tomorrow.
  const today = dateKey();
  const doneThisWeek = {};
  for (const c of weekClaims) {
    if (c.status === "pending" || c.status === "approved") doneThisWeek[c.chore_id] = (doneThisWeek[c.chore_id] || 0) + 1;
  }
  const myChores = chores.map((c) => {
    if (c.schedule === "daily" || c.schedule === "dates") {
      const onToday = dueOn(c, today);
      const doneToday = weekClaims.some((cl) => cl.chore_id === c.id && cl.for_day === today && cl.status !== "declined");
      const later = c.schedule === "dates" && !onToday && (c.dates || []).some((d) => d > today);
      return { ...c, left: onToday && !doneToday ? 1 : 0, today: onToday, later };
    }
    return { ...c, left: Math.max(0, c.times_per_week - (doneThisWeek[c.id] || 0)), today: false, later: false };
  });
  const available = myChores.filter((c) => c.left > 0);
  const comingUp = myChores.filter((c) => c.later);
  const finished = myChores.filter((c) => c.left === 0 && !c.later);
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

  // Full-screen sticker the first time this week's jobs are all done.
  useEffect(() => {
    if (myChores.length === 0 || available.length > 0) return;
    const key = `welldone_${kid.id}_${weekStartUTC().toISOString().slice(0, 10)}`;
    if (weeklyFlagSeen(key)) return;
    markWeeklyFlag(key);
    const t = setTimeout(() => setWellDone(true), drop ? 2600 : 400);
    return () => clearTimeout(t);
  }, [available.length, myChores.length, kid.id, drop]);

  const claim = async (chore) => {
    setClaimingId(chore.id);
    setErr("");
    try {
      const created = await claimChore.mutateAsync({ choreId: chore.id, childId: kid.id, claimDay: today });
      playTap();
      setJustClaimed({ name: chore.name, claimId: created?.id });
      setTimeout(() => setJustClaimed((j) => (j?.photoSent ? null : j)), 12000);
      notifyParents({
        title: `${kid.name} finished a chore`,
        body: `${chore.name} · ${money(chore.value_pence)} — tap to approve`,
        tag: `claim-${created?.id || chore.id}`,
      });
    } catch (e) {
      const m = e?.message || "";
      setErr(
        m.includes("already done for today") ? "You've already done that one today!"
          : m.includes("already done") ? "You've already done that one this week!"
          : m.includes("planned for today") ? "That one isn't planned for today."
          : "Something went wrong — ask a grown-up to try again."
      );
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
          {ownDevice ? (
            <button onClick={onSignOut} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-muted hover:text-ink transition">
              <LogOut size={15} /> Sign out
            </button>
          ) : (
            <button onClick={onExit} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-muted hover:text-ink transition">
              <ArrowLeft size={16} /> Parent
            </button>
          )}
          <button
            onClick={() => setPersonalising(true)}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-white/80 backdrop-blur border border-line text-[13px] font-semibold transition hover:bg-white"
            style={{ color: color.main }}
          >
            <Palette size={15} /> Make it yours
          </button>
        </header>

        <Card className={`${little ? "p-6" : "p-5"} text-white border-0`} style={{ background: color.gradient ? color.fill : `linear-gradient(135deg, ${color.main} 0%, ${color.dark} 100%)` }}>
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

        {ownDevice && (
          <>
            <Card onClick={() => setMessagesOpen(true)} className={`${little ? "p-5" : "p-4"} mt-4 flex items-center gap-3`} accent={unreadCount ? color.main : undefined}>
              <span className={`${little ? "h-14 w-14" : "h-11 w-11"} rounded-2xl flex items-center justify-center shrink-0 relative`} style={{ background: color.soft, color: color.main }}>
                <MessageCircle size={little ? 28 : 22} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-rose-600 text-white text-[11px] font-bold flex items-center justify-center">{unreadCount}</span>
                )}
              </span>
              <span className="flex-1 min-w-0">
                <span className={`block ${little ? "text-[18px]" : "text-[15px]"} font-semibold text-ink`}>Messages from home</span>
                <span className={`block ${little ? "text-[14px]" : "text-[12.5px]"} text-ink-muted`}>
                  {unreadCount > 0 ? `${unreadCount} new ${unreadCount === 1 ? "message" : "messages"}!` : little ? "Say hi to your grown-ups" : "Chat with your grown-ups"}
                </span>
              </span>
              <ChevronRight size={20} className="text-ink-muted" />
            </Card>
            <ChildAlerts family={family} kid={kid} color={color} little={little} />
          </>
        )}

        <Eyebrow>Your jars</Eyebrow>
        <Card className={`p-4 ${drop ? "jar-bump" : ""}`}>
          <JarStats balance={balance} />
        </Card>

        <Eyebrow>Learn &amp; play</Eyebrow>
        <LessonCard kid={kid} mode={mode} color={color} />
        <div className="mt-3">
          <MoneyGamesCard kid={kid} mode={mode} color={color} />
        </div>
        <div className="mt-3">
          <RewardsCard kid={kid} mode={mode} color={color} ownDevice={ownDevice} />
        </div>

        {justClaimed && (
          <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 tip-in">
            <p className={`${little ? "text-[15px]" : "text-[13px]"} font-medium text-emerald-800 flex items-center gap-2`}>
              <Check size={16} /> {little ? "Brilliant! A grown-up will check it." : `Nice! "${justClaimed.name}" is waiting for a grown-up to approve.`}
            </p>
            {justClaimed.claimId && !justClaimed.photoSent && (
              <div className="mt-2 flex items-center justify-between gap-3 flex-wrap">
                <span className={`${little ? "text-[14px]" : "text-[12.5px]"} text-emerald-900/80`}>{little ? "Show them! Take a photo." : "Send a photo so they can approve it from anywhere."}</span>
                <AddClaimPhoto claim={{ id: justClaimed.claimId }} familyId={family.id} color={color.main} little={little} onDone={() => setJustClaimed((j) => ({ ...j, photoSent: true }))} />
              </div>
            )}
            {justClaimed.photoSent && <p className={`mt-1.5 ${little ? "text-[14px]" : "text-[12.5px]"} font-semibold text-emerald-800`}>Photo sent!</p>}
            <button onClick={() => setJustClaimed(null)} className="mt-1 text-[12px] text-emerald-900/60">Dismiss</button>
          </div>
        )}
        {err && <p className="mt-4 text-[13px] font-medium text-rose-700 bg-rose-50 rounded-xl px-4 py-3">{err}</p>}

        <Eyebrow>{little ? "Jobs to do" : "Chores you can do"}</Eyebrow>
        <Tip id={`child-home-${mode}`} kid color={color.main} title={little ? "How it works" : "How your pocket money works"}>
          {little
            ? "Do a job, then tap the big button. A grown-up checks it, and your money drops into your jars! Jobs marked Today are for today — they come back tomorrow."
            : "Tap a chore once you've done it. A grown-up checks and approves it, and the money lands in your Save, Spend and Give jars. Chores tagged Today are once a day and come back tomorrow; the others you can do any time this week. Finish everything for a surprise!"}
        </Tip>
        {little ? (
          <div className="space-y-3">
            {available.map((c) => (
              <Card key={c.id} className="p-4 flex items-center gap-4">
                <IconCircle tone="amber" size={64}><ChoreIcon icon={c.icon} size={32} /></IconCircle>
                <div className="flex-1 min-w-0">
                  <div className="text-[18px] font-bold text-ink leading-snug">{c.name}</div>
                  <div className="text-[13px] text-ink-muted mt-0.5">{c.today ? "Today's job" : `${c.left} more ${c.left === 1 ? "time" : "times"} this week`}</div>
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
                  <IconCircle tone="amber" size={40}><ChoreIcon icon={c.icon} size={20} /></IconCircle>
                  {c.today ? <Pill tone="brand">Today</Pill> : c.times_per_week > 1 && <Pill tone="grey">{c.left} left</Pill>}
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
            <p className="text-[14px] font-semibold text-ink">{myChores.length ? (comingUp.length || myChores.some((c) => c.schedule === "daily") ? "All done for today!" : "All done for this week!") : "No chores set yet."}</p>
            <p className="text-[12.5px] text-ink-muted mt-1">{myChores.length ? (comingUp.length || myChores.some((c) => c.schedule === "daily") ? "More tomorrow." : "New ones unlock on Monday.") : "Ask a grown-up to add some."}</p>
          </Card>
        )}

        {comingUp.length > 0 && (
          <>
            <Eyebrow>{little ? "Coming up" : "Planned for later"}</Eyebrow>
            <Section title="Next few days" icon={<CalendarDays size={18} />}>
              {comingUp.map((c) => (
                <div key={c.id} className="flex items-center gap-3 py-2.5 border-b border-line last:border-0">
                  <IconCircle tone="grey" size={36}><ChoreIcon icon={c.icon} size={18} /></IconCircle>
                  <span className="flex-1 text-[14px] font-medium text-ink">{c.name}</span>
                  <Pill tone="grey">{shortDay((c.dates || []).filter((d) => d > today)[0])}</Pill>
                </div>
              ))}
            </Section>
          </>
        )}

        {myPending.length > 0 && (
          <>
            <Eyebrow>{little ? "Waiting for a grown-up" : "Waiting for approval"}</Eyebrow>
            <Section title={little ? "Checking…" : "Sent to a grown-up"} icon={<Hourglass size={18} />}>
              {myPending.map((p) => (
                <div key={p.id} className="flex items-center gap-3 py-2.5 border-b border-line last:border-0">
                  <IconCircle tone="grey" size={36}><ChoreIcon icon={p.chores?.icon} size={18} /></IconCircle>
                  <span className="flex-1 text-[14px] font-medium text-ink">{p.chores?.name}</span>
                  {p.photo_path ? (
                    <Pill tone="green"><Camera size={11} /> photo sent</Pill>
                  ) : ownDevice ? (
                    <AddClaimPhoto claim={p} familyId={family.id} color={color.main} />
                  ) : null}
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
                  <IconCircle tone="green" size={36}><ChoreIcon icon={c.icon} size={18} /></IconCircle>
                  <span className="flex-1 text-[14px] font-medium text-ink">{c.name}</span>
                  <Pill tone="green">{c.schedule === "daily" || c.schedule === "dates" ? "done today" : `${c.times_per_week}× done`}</Pill>
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
                  <IconCircle tone="grey" size={36}><ChoreIcon icon={a.chores?.icon} size={18} /></IconCircle>
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
      {messagesOpen && <MessagesSheet kid={kid} me="child" mode={mode} onClose={() => setMessagesOpen(false)} />}
      {drop && <MoneyDrop amount={drop.amount} color={color.main} label={little ? "Well done!" : "into your jars!"} onDone={() => setDrop(null)} />}
      {wellDone && <WellDone name={kid.name} color={color.main} onClose={() => setWellDone(false)} />}
    </div>
  );
}

// "Turn on alerts" nudge for the child's own device: approvals and messages.
// Dismissible; disappears once alerts are on.
function ChildAlerts({ family, kid, color, little }) {
  const alerts = useChoreAlerts(family.id, { audience: "child", childId: kid.id });
  const [hidden, setHidden] = useState(() => isTipSeen(`child-alerts-${kid.id}`));
  if (!alerts.configured || hidden || alerts.status === "on" || alerts.status === "checking" || alerts.status === "unsupported") return null;

  const dismiss = () => {
    markTipSeen(`child-alerts-${kid.id}`);
    setHidden(true);
  };

  return (
    <Card className={`${little ? "p-5" : "p-4"} mt-3`}>
      <div className="flex items-start gap-3">
        <span className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: color.soft, color: color.main }}>
          <Bell size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className={`${little ? "text-[16px]" : "text-[14px]"} font-semibold text-ink`}>Get a buzz when money lands</div>
          <p className={`${little ? "text-[14px]" : "text-[12.5px]"} text-ink-muted mt-0.5 leading-relaxed`}>
            {alerts.status === "ios-install"
              ? "Add Pocket Money to your Home Screen first (Share → Add to Home Screen), then open it from there."
              : "We'll tell you when a grown-up approves a chore or sends you a message."}
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        {alerts.status === "off" && (
          <Button className="flex-1" style={{ background: color.main }} onClick={() => alerts.enable.mutate()} disabled={alerts.enable.isPending}>
            <Bell size={16} /> {alerts.enable.isPending ? "Turning on…" : "Turn on"}
          </Button>
        )}
        <Button variant="ghost" onClick={dismiss}>Not now</Button>
      </div>
      {alerts.enable.error && <p className="mt-2 text-[12.5px] text-rose-600">{alerts.enable.error.message}</p>}
    </Card>
  );
}
