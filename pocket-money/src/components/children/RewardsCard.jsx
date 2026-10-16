import { useState } from "react";
import { Star, Gift, X, Check, Hourglass, ChevronRight, History } from "lucide-react";
import { useRewards, useChildPoints, useRewardRequests, useRequestReward, usePointsHistory } from "../../hooks/useRewards";
import { useMoney } from "../../hooks/useCurrency";
import { ChoreIcon } from "../../lib/choreIcons";
import { playCoinShower } from "../../lib/sound";
import { Card, Button, Empty, Pill, Progress } from "../ui";

// Child's screen: how rewards work for them. Money mode just explains;
// points mode shows the pot and opens the rewards shop.
export function RewardsCard({ kid, mode, color, ownDevice }) {
  const money = useMoney();
  const little = mode === "little";
  const rewardMode = kid.quiz_reward_mode || "points";
  const { data: points = {} } = useChildPoints();
  const { data: rewards = [] } = useRewards();
  const { data: requests = [] } = useRewardRequests();
  const [open, setOpen] = useState(false);
  const balance = points[kid.id] || 0;
  const mine = rewards.filter((r) => !r.child_id || r.child_id === kid.id);
  const waiting = requests.filter((r) => r.child_id === kid.id && r.status === "requested");
  const next = mine.find((r) => r.cost_points > balance);

  if (rewardMode === "none") return null;

  if (rewardMode === "money") {
    return (
      <Card className={little ? "p-5" : "p-4"}>
        <div className="flex items-center gap-3">
          <span className={`${little ? "h-12 w-12" : "h-10 w-10"} rounded-2xl flex items-center justify-center shrink-0`} style={{ background: color.soft, color: color.main }}>
            <Star size={little ? 24 : 20} />
          </span>
          <div className="min-w-0 flex-1">
            <div className={`${little ? "text-[16px]" : "text-[14px]"} font-semibold text-ink`}>Right answers pay {money(kid.quiz_reward_pence)} each</div>
            <div className={`${little ? "text-[14px]" : "text-[12.5px]"} text-ink-muted`}>Straight into your jars, just like a chore.</div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card onClick={() => setOpen(true)} className={little ? "p-5" : "p-4"} accent={color.fill}>
        <div className="flex items-center gap-3">
          <span className={`${little ? "h-14 w-14" : "h-11 w-11"} rounded-2xl flex items-center justify-center shrink-0 text-white`} style={{ background: color.fill }}>
            <Gift size={little ? 28 : 22} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-ink-muted">Your points</div>
            <div className={`${little ? "text-[24px]" : "text-[20px]"} font-bold text-ink tracking-tight tabular-nums inline-flex items-center gap-1.5`}>
              <Star size={little ? 22 : 18} className="text-amber-400 fill-amber-400" /> {balance}
            </div>
            <div className={`${little ? "text-[14px]" : "text-[12.5px]"} text-ink-muted`}>
              {waiting.length ? `Asked for ${waiting[0].reward_name} — waiting for a grown-up` : next ? `${next.cost_points - balance} more for ${next.name}` : mine.length ? "You can get a reward!" : "Right answers earn points for rewards."}
            </div>
          </div>
          <ChevronRight size={20} className="text-ink-muted" />
        </div>
        {next && (
          <div className="mt-3"><Progress value={(balance / next.cost_points) * 100} color={color.main} /></div>
        )}
      </Card>
      {open && <RewardsSheet kid={kid} little={little} color={color} balance={balance} rewards={mine} requests={requests.filter((r) => r.child_id === kid.id)} ownDevice={ownDevice} onClose={() => setOpen(false)} />}
    </>
  );
}

function RewardsSheet({ kid, little, color, balance, rewards, requests, ownDevice, onClose }) {
  const request = useRequestReward(kid);
  const [err, setErr] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const { data: history = [] } = usePointsHistory(kid.id, showHistory);
  const waitingIds = new Set(requests.filter((r) => r.status === "requested").map((r) => r.reward_id));

  const ask = (reward) => {
    setErr("");
    request.mutate({ rewardId: reward.id }, { onSuccess: () => playCoinShower(5, 0.5), onError: (e) => setErr(e.message) });
  };

  return (
    <div className="fixed inset-0 z-[60] bg-ink/55 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="w-full sm:max-w-md max-h-[92dvh] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Rewards">
        <header className="flex items-center gap-3 px-4 py-3 border-b border-line">
          <span className="h-9 w-9 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: color.fill }}><Gift size={18} /></span>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold text-ink">Rewards</div>
            <div className="text-[12px] text-ink-muted inline-flex items-center gap-1">You have <Star size={12} className="text-amber-400 fill-amber-400" /> <strong className="text-ink tabular-nums">{balance}</strong> points</div>
          </div>
          <button onClick={onClose} aria-label="Close" className="h-9 w-9 rounded-full flex items-center justify-center text-ink-muted hover:bg-surface"><X size={18} /></button>
        </header>
        <div className="flex-1 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-2">
          {rewards.length === 0 && <Empty>No rewards set up yet — ask a grown-up to add some!</Empty>}
          {rewards.map((r) => {
            const can = balance >= r.cost_points;
            const waiting = waitingIds.has(r.id);
            return (
              <div key={r.id} className="rounded-2xl border border-line bg-white p-3 flex items-center gap-3">
                <span className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: color.soft, color: color.main }}><ChoreIcon icon={r.icon} size={22} /></span>
                <div className="flex-1 min-w-0">
                  <div className={`${little ? "text-[16px]" : "text-[14px]"} font-semibold text-ink`}>{r.name}</div>
                  <div className="text-[12.5px] text-ink-muted inline-flex items-center gap-1"><Star size={12} className="text-amber-400 fill-amber-400" /> {r.cost_points} points{!can && !waiting ? ` · ${r.cost_points - balance} to go` : ""}</div>
                  {!can && !waiting && <div className="mt-1.5"><Progress value={(balance / r.cost_points) * 100} color={color.main} /></div>}
                </div>
                {waiting ? (
                  <Pill tone="amber"><Hourglass size={11} /> asked</Pill>
                ) : ownDevice ? (
                  <Button size="sm" disabled={!can || request.isPending} style={can ? { background: color.fill } : undefined} onClick={() => ask(r)}>Ask for it</Button>
                ) : (
                  <Pill tone="grey">{can ? "ready" : "saving"}</Pill>
                )}
              </div>
            );
          })}
          {err && <p className="text-[12.5px] text-rose-600">{err}</p>}
          {!ownDevice && rewards.length > 0 && <p className="text-[12px] text-ink-muted">Asking for a reward works from the child's own device.</p>}

          {requests.filter((r) => r.status !== "requested").slice(0, 5).length > 0 && (
            <div className="pt-2">
              <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-ink-muted mb-1.5">Recently</div>
              {requests.filter((r) => r.status !== "requested").slice(0, 5).map((r) => (
                <div key={r.id} className="flex items-center gap-2 py-1.5 text-[13px]">
                  {r.status === "granted" ? <Check size={14} className="text-emerald-600" /> : <X size={14} className="text-rose-500" />}
                  <span className="flex-1 text-ink">{r.reward_name}</span>
                  <span className="text-ink-muted">{r.status === "granted" ? "yes!" : "not this time"}</span>
                </div>
              ))}
            </div>
          )}

          <button onClick={() => setShowHistory((s) => !s)} className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-muted hover:text-ink">
            <History size={14} /> {showHistory ? "Hide" : "How did I get my points?"}
          </button>
          {showHistory && (
            <div>
              {history.map((h) => (
                <div key={h.id} className="flex items-center gap-2 py-1.5 border-t border-line text-[13px]">
                  <span className="flex-1 text-ink">{h.reason}</span>
                  <span className={`font-bold tabular-nums ${h.delta > 0 ? "text-emerald-700" : "text-rose-600"}`}>{h.delta > 0 ? "+" : ""}{h.delta}</span>
                </div>
              ))}
              {history.length === 0 && <Empty>Nothing yet — try today's quiz!</Empty>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
