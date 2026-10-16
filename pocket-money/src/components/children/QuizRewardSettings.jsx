import { useState } from "react";
import { Star, Plus, Trash2, Gift, Check, Sparkles } from "lucide-react";
import { useMoney } from "../../hooks/useCurrency";
import { useUpdateQuizReward, useRewards, useAddReward, useRemoveReward, useAdjustPoints } from "../../hooks/useRewards";
import { QUIZ_REWARD_MODES, QUIZ_REWARD_PENCE, QUIZ_REWARD_POINTS, REWARD_IDEAS } from "../../lib/api/rewards";
import { ChoreIcon, CHORE_ICON_KEYS } from "../../lib/choreIcons";
import { Button, Input, ErrorText } from "../ui";

// Parent side: what a right answer is worth for this child, and (in points
// mode) the rewards they can save up for.
export function QuizRewardSettings({ kid, points = 0 }) {
  const money = useMoney();
  const update = useUpdateQuizReward();
  const mode = kid.quiz_reward_mode || "points";

  return (
    <div className="rounded-xl bg-surface p-3 space-y-4">
      <p className="text-[12.5px] text-ink-muted leading-relaxed">
        {kid.name} gets this for each right answer in the daily quiz and the money games (once per activity per day).
      </p>

      <div>
        <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-ink-muted mb-1.5">Reward</div>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-white border border-line p-1">
          {QUIZ_REWARD_MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => update.mutate({ childId: kid.id, mode: m.key })}
              aria-pressed={mode === m.key}
              className={`h-9 rounded-lg text-[12.5px] font-semibold transition ${mode === m.key ? "bg-brand-600 text-white" : "text-ink-muted hover:text-ink"}`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-[12px] text-ink-muted mt-1.5 px-1">{QUIZ_REWARD_MODES.find((m) => m.key === mode)?.hint}</p>
      </div>

      {mode === "money" && (
        <div>
          <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-ink-muted mb-1.5">Per right answer</div>
          <div className="flex flex-wrap gap-2">
            {QUIZ_REWARD_PENCE.map((p) => (
              <button key={p} onClick={() => update.mutate({ childId: kid.id, pence: p })} aria-pressed={kid.quiz_reward_pence === p} className={`h-10 px-3.5 rounded-xl border text-[14px] font-bold tabular-nums transition ${kid.quiz_reward_pence === p ? "border-brand-400 bg-brand-50 text-brand-700 ring-4 ring-brand-100" : "border-line bg-white text-ink"}`}>
                {money(p)}
              </button>
            ))}
          </div>
          <p className="text-[12px] text-ink-muted mt-1.5">Split into their Save, Spend and Give jars like a chore. A perfect 6-round game at {money(kid.quiz_reward_pence)} pays {money(kid.quiz_reward_pence * 6)}.</p>
        </div>
      )}

      {mode === "points" && (
        <>
          <div>
            <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-ink-muted mb-1.5">Points per right answer</div>
            <div className="flex flex-wrap gap-2">
              {QUIZ_REWARD_POINTS.map((p) => (
                <button key={p} onClick={() => update.mutate({ childId: kid.id, points: p })} aria-pressed={kid.quiz_points_per_correct === p} className={`h-10 px-3.5 rounded-xl border text-[14px] font-bold tabular-nums transition inline-flex items-center gap-1 ${kid.quiz_points_per_correct === p ? "border-brand-400 bg-brand-50 text-brand-700 ring-4 ring-brand-100" : "border-line bg-white text-ink"}`}>
                  <Star size={13} className="text-amber-400 fill-amber-400" /> {p}
                </button>
              ))}
            </div>
          </div>
          <PointsPot kid={kid} points={points} />
          <RewardsManager kid={kid} />
        </>
      )}
      <ErrorText>{update.error?.message}</ErrorText>
    </div>
  );
}

function PointsPot({ kid, points }) {
  const adjust = useAdjustPoints();
  const [amount, setAmount] = useState("5");
  const [why, setWhy] = useState("");
  const n = Math.max(1, Math.min(1000, Number(amount) || 0));
  return (
    <div>
      <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-ink-muted mb-1.5">Points pot</div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-800 px-3 h-9 text-[14px] font-bold tabular-nums"><Star size={14} className="fill-current text-amber-500" /> {points}</span>
        <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} aria-label="Points to add or take" className="w-16 h-9 rounded-xl border border-line bg-white px-2 text-center text-[14px] font-bold tabular-nums outline-none focus:border-brand-400" />
        <Button size="sm" variant="secondary" disabled={adjust.isPending} onClick={() => adjust.mutate({ childId: kid.id, delta: n, why })}><Sparkles size={14} /> Bonus</Button>
        <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50" disabled={adjust.isPending || points < 1} onClick={() => adjust.mutate({ childId: kid.id, delta: -Math.min(n, points), why })}>Take</Button>
      </div>
      <Input value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Reason (optional), e.g. kind to your sister" className="h-9 mt-2 text-[13px]" />
    </div>
  );
}

// The rewards this child can trade points for. Presets to tap, or your own.
function RewardsManager({ kid }) {
  const { data: rewards = [] } = useRewards();
  const add = useAddReward();
  const remove = useRemoveReward();
  const [custom, setCustom] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("gift");
  const [cost, setCost] = useState("10");
  const [err, setErr] = useState("");
  const mine = rewards.filter((r) => !r.child_id || r.child_id === kid.id);
  const has = (n) => mine.some((r) => r.name.toLowerCase() === n.toLowerCase());

  const addIdea = (idea) => add.mutate({ familyId: kid.family_id, childId: kid.id, name: idea.name, icon: idea.icon, costPoints: idea.cost_points });
  const addCustom = async () => {
    setErr("");
    const c = Number(cost);
    if (!name.trim()) return setErr("Give the reward a name.");
    if (!c || c < 1) return setErr("Cost must be at least 1 point.");
    try {
      await add.mutateAsync({ familyId: kid.family_id, childId: kid.id, name, icon, costPoints: c });
      setName("");
      setCost("10");
      setCustom(false);
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <div>
      <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-ink-muted mb-1.5">Rewards {kid.name} can save for</div>
      {mine.map((r) => (
        <div key={r.id} className="flex items-center gap-2.5 py-1.5 border-b border-line last:border-0">
          <span className="h-8 w-8 rounded-lg bg-white border border-line flex items-center justify-center text-brand-600"><ChoreIcon icon={r.icon} size={16} /></span>
          <span className="flex-1 text-[13.5px] font-medium text-ink truncate">{r.name}{!r.child_id ? <span className="text-ink-muted font-normal"> · everyone</span> : ""}</span>
          <span className="inline-flex items-center gap-1 text-[12.5px] font-bold text-ink tabular-nums"><Star size={12} className="text-amber-400 fill-amber-400" /> {r.cost_points}</span>
          <button onClick={() => remove.mutate(r.id)} aria-label={`Remove ${r.name}`} className="h-8 w-8 rounded-full text-ink-muted hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center"><Trash2 size={14} /></button>
        </div>
      ))}
      {mine.length === 0 && <p className="text-[12.5px] text-ink-muted py-1">Nothing yet. Tap an idea below or add your own.</p>}

      <div className="mt-2 flex flex-wrap gap-1.5">
        {REWARD_IDEAS.filter((i) => !has(i.name)).map((idea) => (
          <button key={idea.name} onClick={() => addIdea(idea)} disabled={add.isPending} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 h-8 text-[12px] font-semibold text-ink hover:bg-brand-50 hover:border-brand-200">
            <Plus size={12} /> {idea.name} <span className="text-ink-muted font-normal">· {idea.cost_points}</span>
          </button>
        ))}
        <button onClick={() => setCustom((c) => !c)} className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-brand-300 bg-brand-50 px-2.5 h-8 text-[12px] font-semibold text-brand-700">
          <Gift size={12} /> Your own
        </button>
      </div>

      {custom && (
        <div className="mt-2 rounded-xl bg-white border border-line p-2.5 space-y-2 tip-in">
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pancakes for breakfast" className="h-10" autoFocus />
            <input inputMode="numeric" value={cost} onChange={(e) => setCost(e.target.value.replace(/\D/g, ""))} aria-label="Points cost" className="w-20 h-10 rounded-xl border border-line bg-white px-2 text-center text-[14px] font-bold tabular-nums outline-none focus:border-brand-400" />
          </div>
          <div className="flex flex-wrap gap-1">
            {CHORE_ICON_KEYS.slice(0, 44).map((k) => (
              <button key={k} onClick={() => setIcon(k)} aria-label={k} aria-pressed={icon === k} className={`h-8 w-8 rounded-lg flex items-center justify-center ${icon === k ? "bg-brand-600 text-white" : "bg-surface text-brand-600"}`}><ChoreIcon icon={k} size={15} /></button>
            ))}
          </div>
          <ErrorText>{err}</ErrorText>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={addCustom} disabled={add.isPending}><Check size={14} /> Add reward</Button>
            <Button size="sm" variant="ghost" onClick={() => setCustom(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
