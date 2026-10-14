import { useState } from "react";
import { Copy, CopyCheck } from "lucide-react";
import { useCreateFamilyInvite } from "../hooks/useFamily";

export function InviteCoParent() {
  const [invite, setInvite] = useState(null); // { code, expires_at }
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
      // clipboard unavailable — silently ignore, code is still visible to copy manually
    }
  };

  if (!invite) {
    return (
      <button
        onClick={makeInvite}
        disabled={createInvite.isPending}
        className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition rounded-full px-3 py-1 disabled:opacity-50"
      >
        {createInvite.isPending ? "Generating…" : "👨‍👩‍👧 Invite a co-parent"}
        {err && <span className="text-rose-600">· {err}</span>}
      </button>
    );
  }

  return (
    <div className="mt-1 flex items-center gap-2 flex-wrap">
      <button
        onClick={copyCode}
        title="Share this code — it expires in 24 hours and works once"
        className="flex items-center gap-1.5 text-xs font-mono font-extrabold tracking-widest text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition rounded-full px-3 py-1"
      >
        {copied ? <CopyCheck size={13} /> : <Copy size={13} />}
        {copied ? "Copied!" : invite.code}
      </button>
      <span className="text-[11px] text-slate-400">expires in 24h · one-time use</span>
    </div>
  );
}
