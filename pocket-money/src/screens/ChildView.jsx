import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { BackgroundBlobs, Section } from "../components/common";
import { BigJar } from "../components/Jars";
import { useMoney } from "../hooks/useCurrency";
import { useClaimChore } from "../hooks/useClaims";
import { useRecentActivity } from "../hooks/useActivity";

export function ChildView({ kid, family, chores, pending, balance, bills, onExit }) {
  const money = useMoney();
  const [claimingId, setClaimingId] = useState(null);
  const [justClaimed, setJustClaimed] = useState(null); // chore name
  const [err, setErr] = useState("");
  const claimChore = useClaimChore();
  const { data: activity } = useRecentActivity(kid.id, 6);

  const save = balance?.save_pence ?? 0;
  const spend = balance?.spend_pence ?? 0;
  const give = balance?.give_pence ?? 0;
  const total = balance?.total_pence ?? 0;
  const shareOf = (v) => (total > 0 ? (v / total) * 100 : 0);

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
    <div className="relative min-h-screen overflow-hidden">
      <BackgroundBlobs />
      <div className="relative max-w-2xl mx-auto p-4 space-y-6 pb-16">
        <header className="flex items-center justify-between pt-2">
          <button
            onClick={onExit}
            className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-600 transition"
          >
            <ArrowLeft size={14} /> Parent
          </button>
          <div className="text-xs font-semibold text-slate-400">🐷 {family.name}</div>
        </header>

        <div className="text-center space-y-1">
          <span className="text-6xl">{kid.avatar}</span>
          <h1 className="font-display text-2xl font-extrabold text-slate-800">Hi {kid.name}!</h1>
          <div className="font-display text-4xl font-extrabold bg-gradient-to-r from-indigo-600 via-fuchsia-500 to-amber-500 bg-clip-text text-transparent">
            {money(total)}
          </div>
        </div>

        <div className="flex justify-center gap-4 bg-white/70 backdrop-blur rounded-3xl p-5 shadow-sm border border-white">
          <BigJar label="save" emoji="💰" title="Save" pence={save} sharePct={shareOf(save)} />
          <BigJar label="spend" emoji="🛍️" title="Spend" pence={spend} sharePct={shareOf(spend)} />
          <BigJar label="give" emoji="🎁" title="Give" pence={give} sharePct={shareOf(give)} />
        </div>

        {justClaimed && (
          <div className="text-center text-sm font-bold text-emerald-700 bg-emerald-50 rounded-2xl py-2.5">
            🎉 Nice! "{justClaimed}" is waiting for a grown-up to say yes.
          </div>
        )}
        {err && (
          <div className="text-center text-sm font-bold text-rose-600 bg-rose-50 rounded-2xl py-2.5">{err}</div>
        )}

        <Section title="Chores I can do" emoji="⭐">
          <div className="grid grid-cols-2 gap-2">
            {availableChores.map((c) => (
              <button
                key={c.id}
                onClick={() => claim(c)}
                disabled={claimingId === c.id}
                className="flex flex-col items-center gap-1 bg-white border-2 border-amber-100 hover:border-amber-400 hover:bg-amber-50 disabled:opacity-50 rounded-2xl py-3 transition shadow-sm"
              >
                <span className="text-2xl">{c.icon}</span>
                <span className="text-sm font-bold text-slate-700 text-center px-1">{c.name}</span>
                <span className="text-xs font-bold text-amber-600 bg-amber-50 rounded-full px-2 py-0.5">
                  {money(c.value_pence)}
                </span>
              </button>
            ))}
            {availableChores.length === 0 && (
              <p className="col-span-2 text-sm text-slate-400 italic py-2 text-center">
                Nothing to claim right now — nice work!
              </p>
            )}
          </div>
        </Section>

        {myPending.length > 0 && (
          <Section title="Waiting for approval" emoji="⏳">
            <div className="space-y-2">
              {myPending.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 bg-white border border-slate-100 rounded-2xl px-3 py-2 shadow-sm"
                >
                  <span className="text-xl">{p.chores?.icon}</span>
                  <span className="flex-1 text-sm font-semibold text-slate-700">{p.chores?.name}</span>
                  <span className="text-xs font-bold text-slate-400">{money(p.chores?.value_pence)}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {bills.length > 0 && (
          <Section title="What I pay for" emoji="🧾" subtitle="Real bills, just like grown-ups have.">
            <div className="flex flex-wrap gap-2">
              {bills.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded-full pl-3 pr-2.5 py-1.5"
                >
                  <span>{b.icon}</span>
                  <span className="text-sm font-semibold text-slate-700">{b.name}</span>
                  <span className="text-xs font-bold text-sky-700 bg-sky-100 rounded-full px-2 py-0.5">
                    {money(b.amount_pence)}/{b.frequency === "weekly" ? "wk" : "mo"}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        )}

        <Section title="Recent activity" emoji="📜">
          <div className="space-y-1.5">
            {(activity || []).map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-sm">
                <span>{a.chores?.icon || "⭐"}</span>
                <span className="flex-1 text-slate-600">{a.chores?.name}</span>
                <span
                  className={`text-xs font-bold rounded-full px-2 py-0.5 ${
                    a.status === "approved"
                      ? "bg-emerald-50 text-emerald-700"
                      : a.status === "declined"
                        ? "bg-rose-50 text-rose-600"
                        : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {a.status === "approved" ? `+${money(a.chores?.value_pence)}` : a.status}
                </span>
              </div>
            ))}
            {activity !== undefined && activity.length === 0 && (
              <p className="text-sm text-slate-400 italic py-2">Nothing yet — go claim a chore!</p>
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}
