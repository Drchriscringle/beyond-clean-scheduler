import { useState } from "react";
import { Copy, CopyCheck, UserPlus } from "lucide-react";
import { useCreateFamilyInvite } from "../hooks/useFamily";

export function InviteCoParent({ light = false }) {
  const [invite, setInvite] = useState(null);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");
  const createInvite = useCreateFamilyInvite();

  const makeInvite = async () => {
    setErr("");
    try {
      setInvite(await createInvite.mutateAsync());
    } catch (e) {
      setErr(e.message);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(invite.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — the code is still visible to copy by hand
    }
  };

  const base = light
    ? "bg-white/15 text-white hover:bg-white/25"
    : "bg-brand-50 text-brand-700 hover:bg-brand-100";

  if (!invite) {
    return (
      <button
        onClick={makeInvite}
        disabled={createInvite.isPending}
        className={`inline-flex items-center gap-1.5 rounded-full px-3 h-8 text-[12.5px] font-semibold transition disabled:opacity-60 ${base}`}
      >
        <UserPlus size={14} />
        {createInvite.isPending ? "Generating…" : "Invite co-parent"}
        {err && <span className="text-rose-300">· {err}</span>}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={copyCode}
        title="Expires in 24 hours · one-time use"
        className={`inline-flex items-center gap-1.5 rounded-full px-3 h-8 font-mono text-[13px] font-bold tracking-[0.2em] transition ${base}`}
      >
        {copied ? <CopyCheck size={14} /> : <Copy size={14} />}
        {copied ? "Copied" : invite.code}
      </button>
      <span className={`text-[11px] ${light ? "text-white/70" : "text-ink-muted"}`}>24h · one-time use</span>
    </div>
  );
}
