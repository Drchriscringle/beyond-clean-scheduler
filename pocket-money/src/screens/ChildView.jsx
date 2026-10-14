import { useState } from "react";
import { ArrowLeft, Star, Hourglass, Receipt, History, Check, Palette } from "lucide-react";
import { Page, Card, Eyebrow, Empty, IconCircle, Pill } from "../components/ui";
import { Section } from "../components/common";
import { JarStats } from "../components/Jars";
import { ChildAvatar } from "../components/children/ChildAvatar";
import { PersonaliseSheet } from "../components/children/PersonaliseSheet";
import { useMoney } from "../hooks/useCurrency";
import { useClaimChore } from "../hooks/useClaims";
import { useRecentActivity } from "../hooks/useActivity";
import { themeColor, ThemeBadge, wallpaperStyle } from "../lib/theme";

export function ChildView({ kid, family, chores, pending, balance, bills, onExit }) {
  const money = useMoney();
  const [claimingId, setClaimingId] = useState(null);
  const [justClaimed, setJustClaimed] = useState(null);
  const [personalising, setPersonalising] = useState(false);
  const [err, setErr] = useState("");
  const claimChore = useClaimChore();
  const { data: activity } = useRecentActivity(kid.id, 6);

  const color = themeColor(kid.theme, kid.name);
  const total = balance?.total_pence ?? 0;
  const myPending = pending.filter((p) => p.children.id === kid.id);
  const pendingChoreIds = new Set(myPending.map((p) => p.chores?.id).filter(Boolean));
  const availableChores = chores.filter((c) => !pendingChoreIds.has(c.id));

  const claim = async (chore) => {
    setClaimingId(chore.id);
    setErr("");
    try {
      await claimChore.mutateAsync({ choreId: chore.id, childId: kid.id, familyId: family.id });
      setJustClaimed(chore.name);
      setTimeout(() => setJustClaimed(null), 2500);
    } catch {
      setErr("Something went wrong — ask a grown-up to try again.");
    } finally {
      setClaimingId(null);
    }
  };

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

        <Card className="p-5 text-white border-0" style={{ background: `linear-gradient(135deg, ${color.main} 0%, ${color.dark} 100%)` }}>
          <div className="flex items-center gap-4">
            <ChildAvatar kid={kid} size={60} className="ring-4 ring-white/25" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[13px] text-white/75">
                <span>Hi {kid.name}</span>
                <ThemeBadge theme={kid.theme} name={kid.name} size={26} onDark />
              </div>
              <div className="text-[32px] font-bold tabular-nums tracking-tight leading-none mt-1">{money(total)}</div>
            </div>
          </div>
        </Card>

        <Eyebrow>Your jars</Eyebrow>
        <Card className="p-4">
          <JarStats balance={balance} />
        </Card>

        {justClaimed && (
          <p className="mt-4 text-[13px] font-medium text-emerald-800 bg-emerald-50 rounded-xl px-4 py-3 flex items-center gap-2">
            <Check size={16} /> Nice! "{justClaimed}" is waiting for a grown-up to approve.
          </p>
        )}
        {err && <p className="mt-4 text-[13px] font-medium text-rose-700 bg-rose-50 rounded-xl px-4 py-3">{err}</p>}

        <Eyebrow>Chores you can do</Eyebrow>
        <div className="grid grid-cols-2 gap-3">
          {availableChores.map((c) => (
            <Card key={c.id} onClick={() => claim(c)} className={`p-4 ${claimingId === c.id ? "opacity-50" : ""}`}>
              <IconCircle tone="amber" size={40}>{c.icon}</IconCircle>
              <div className="mt-3 text-[14px] font-semibold text-ink leading-snug">{c.name}</div>
              <div className="mt-2 flex items-center justify-between">
                <Pill tone="green">+{money(c.value_pence)}</Pill>
                <span className="text-[12px] font-semibold" style={{ color: color.main }}>Done →</span>
              </div>
            </Card>
          ))}
          {availableChores.length === 0 && (
            <Card className="p-5 col-span-2 text-center">
              <Star size={22} className="mx-auto mb-2" style={{ color: color.main }} />
              <p className="text-[13.5px] text-ink-muted">Nothing to do right now — nice work!</p>
            </Card>
          )}
        </div>

        {myPending.length > 0 && (
          <>
            <Eyebrow>Waiting for approval</Eyebrow>
            <Section title="Sent to a grown-up" icon={<Hourglass size={18} />}>
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

        {bills.length > 0 && (
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
      </Page>

      {personalising && <PersonaliseSheet kid={kid} familyId={family.id} onClose={() => setPersonalising(false)} />}
    </div>
  );
}
