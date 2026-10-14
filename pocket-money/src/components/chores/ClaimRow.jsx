import { Check, X } from "lucide-react";
import { useMoney } from "../../hooks/useCurrency";
import { useDecideClaim } from "../../hooks/useClaims";

export function ClaimRow({ claim }) {
  const money = useMoney();
  const decideClaim = useDecideClaim();

  return (
    <div className="rounded-2xl p-3 bg-white border border-slate-100 flex items-center gap-3 shadow-sm">
      <span className="text-2xl">{claim.children.avatar}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-slate-700 truncate">
          {claim.children.name} · {claim.chores.icon} {claim.chores.name}
        </div>
        <div className="text-xs text-slate-500 font-semibold">{money(claim.chores.value_pence)}</div>
      </div>
      <button
        onClick={() => decideClaim.mutate({ claimId: claim.id, approve: true })}
        disabled={decideClaim.isPending}
        className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-full px-3 py-1.5 text-sm font-bold transition"
      >
        <Check size={15} /> Approve
      </button>
      <button
        onClick={() => decideClaim.mutate({ claimId: claim.id, approve: false })}
        disabled={decideClaim.isPending}
        className="flex items-center bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-500 rounded-full p-1.5 transition"
      >
        <X size={15} />
      </button>
    </div>
  );
}
