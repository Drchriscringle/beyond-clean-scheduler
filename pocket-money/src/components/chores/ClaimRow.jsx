import { Check, X } from "lucide-react";
import { useMoney } from "../../hooks/useCurrency";
import { useDecideClaim } from "../../hooks/useClaims";
import { IconCircle } from "../ui";
import { ChildAvatar } from "../children/ChildAvatar";

export function ClaimRow({ claim }) {
  const money = useMoney();
  const decideClaim = useDecideClaim();
  const busy = decideClaim.isPending;

  return (
    <div className="flex items-center gap-3 py-3 border-b border-line last:border-0">
      <div className="relative">
        <ChildAvatar kid={claim.children} size={44} />
        <div className="absolute -bottom-1 -right-1">
          <IconCircle tone="amber" size={22}>{claim.chores.icon}</IconCircle>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-semibold text-ink truncate">{claim.chores.name}</div>
        <div className="text-[12.5px] text-ink-muted">
          {claim.children.name} · {money(claim.chores.value_pence)}
        </div>
      </div>
      <button
        onClick={() => decideClaim.mutate({ claimId: claim.id, approve: false })}
        disabled={busy}
        aria-label="Decline"
        className="h-9 w-9 rounded-full bg-surface text-ink-muted hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center transition disabled:opacity-50"
      >
        <X size={16} />
      </button>
      <button
        onClick={() => decideClaim.mutate({ claimId: claim.id, approve: true })}
        disabled={busy}
        className="h-9 px-3 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-semibold inline-flex items-center gap-1 transition disabled:opacity-50"
      >
        <Check size={15} /> Approve
      </button>
    </div>
  );
}
