import { Gift, Check, X, Star } from "lucide-react";
import { useRewardRequests, useDecideReward } from "../../hooks/useRewards";
import { ChoreIcon } from "../../lib/choreIcons";
import { Section } from "../common";
import { Empty } from "../ui";
import { ChildAvatar } from "./ChildAvatar";

// Parent Home: rewards children have asked for, to grant or decline.
export function RewardRequestsCard({ kids }) {
  const { data: requests = [] } = useRewardRequests("requested");
  const decide = useDecideReward();
  if (requests.length === 0) return null;

  return (
    <Section title="Rewards asked for" icon={<Gift size={18} />} badge={requests.length}>
      {requests.map((r) => {
        const kid = kids.find((k) => k.id === r.child_id);
        return (
          <div key={r.id} className="flex items-center gap-3 py-3 border-b border-line last:border-0">
            {kid && <ChildAvatar kid={kid} size={40} />}
            <span className="h-9 w-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0"><ChoreIcon icon={r.reward_icon} size={18} /></span>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold text-ink truncate">{r.reward_name}</div>
              <div className="text-[12.5px] text-ink-muted inline-flex items-center gap-1">{kid?.name || "Child"} · <Star size={11} className="text-amber-400 fill-amber-400" /> {r.cost_points} points</div>
            </div>
            <button onClick={() => decide.mutate({ request: r, grant: false })} disabled={decide.isPending} aria-label="Decline" className="h-9 w-9 rounded-full bg-surface text-ink-muted hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center transition disabled:opacity-50">
              <X size={16} />
            </button>
            <button onClick={() => decide.mutate({ request: r, grant: true })} disabled={decide.isPending} className="h-9 px-3 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-semibold inline-flex items-center gap-1 transition disabled:opacity-50">
              <Check size={15} /> Yes
            </button>
          </div>
        );
      })}
      {requests.length === 0 && <Empty>Nothing waiting.</Empty>}
    </Section>
  );
}
