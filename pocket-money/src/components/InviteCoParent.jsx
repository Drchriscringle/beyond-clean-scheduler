import { useState } from "react";
import { Copy, CopyCheck, UserPlus, Share2, X, Clock } from "lucide-react";
import { useCreateFamilyInvite } from "../hooks/useFamily";
import { Button } from "./ui";

const APP_ORIGIN = typeof window !== "undefined" ? window.location.origin : "https://pocket-money-family.netlify.app";

export function inviteMessage(code) {
  return `Join our family on Pocket Money:\n1. Open ${APP_ORIGIN}/parent\n2. Create your own parent account (or sign in)\n3. On "Set up your household", tap "Join with an invite code" and enter ${code}\nThe code works once and expires in 24 hours.`;
}

export function InviteCoParent({ light = false }) {
  const [invite, setInvite] = useState(null);
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

  const base = light
    ? "bg-white/15 text-white hover:bg-white/25"
    : "bg-brand-50 text-brand-700 hover:bg-brand-100";

  return (
    <>
      <button
        onClick={makeInvite}
        disabled={createInvite.isPending}
        className={`inline-flex items-center gap-1.5 rounded-full px-3 h-8 text-[12.5px] font-semibold transition disabled:opacity-60 ${base}`}
      >
        <UserPlus size={14} />
        {createInvite.isPending ? "Generating…" : "Invite co-parent"}
        {err && <span className="text-rose-300">· {err}</span>}
      </button>
      {invite && <InviteSheet invite={invite} onClose={() => setInvite(null)} />}
    </>
  );
}

// Explains what to do with the code: who to send it to, where they enter
// it, and that it's single-use for 24 hours. Share uses the phone's share
// sheet when available; Copy is always there.
function InviteSheet({ invite, onClose }) {
  const [copied, setCopied] = useState(null); // 'code' | 'message'
  const canShare = typeof navigator !== "undefined" && !!navigator.share;

  const copy = async (what) => {
    try {
      await navigator.clipboard.writeText(what === "code" ? invite.code : inviteMessage(invite.code));
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // clipboard unavailable — the code is still visible to copy by hand
    }
  };

  const share = async () => {
    try {
      await navigator.share({ title: "Join our family on Pocket Money", text: inviteMessage(invite.code) });
    } catch {
      // user dismissed the share sheet
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-ink/55 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] tip-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Invite a co-parent"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-bold tracking-tight text-ink">Invite a co-parent</h2>
            <p className="text-[13px] text-ink-muted mt-0.5">They'll see and manage the same children, chores and approvals as you.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="h-9 w-9 rounded-full flex items-center justify-center text-ink-muted hover:bg-surface shrink-0">
            <X size={18} />
          </button>
        </div>

        <button
          onClick={() => copy("code")}
          className="mt-5 w-full rounded-2xl bg-brand-50 border border-brand-100 px-4 py-4 text-center transition active:scale-[0.99]"
          aria-label="Copy invite code"
        >
          <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-brand-700/70">Invite code</div>
          <div className="font-mono text-[34px] font-bold tracking-[0.3em] text-brand-700 leading-tight mt-1">{invite.code}</div>
          <div className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand-700 mt-1">
            {copied === "code" ? <><CopyCheck size={13} /> Copied</> : <><Copy size={13} /> Tap to copy</>}
          </div>
        </button>

        <ol className="mt-5 space-y-2.5 text-[14px] text-ink">
          <Step n={1}>Send this code to the other parent (use Share below, or copy it into a text).</Step>
          <Step n={2}>They open <strong>{APP_ORIGIN.replace(/^https?:\/\//, "")}/parent</strong> and create their <em>own</em> parent account with their email.</Step>
          <Step n={3}>On the "Set up your household" screen they tap <strong>Join with an invite code</strong> and enter it. They must <em>not</em> create a new family.</Step>
        </ol>

        <p className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] text-ink-muted">
          <Clock size={13} /> Works once · expires in 24 hours. Generate a new one any time.
        </p>

        <div className="mt-5 flex gap-2">
          {canShare ? (
            <Button className="flex-1" onClick={share}><Share2 size={16} /> Share invite</Button>
          ) : (
            <Button className="flex-1" onClick={() => copy("message")}>
              {copied === "message" ? <><CopyCheck size={16} /> Copied message</> : <><Copy size={16} /> Copy message to send</>}
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  );
}

function Step({ n, children }) {
  return (
    <li className="flex gap-3">
      <span className="h-6 w-6 rounded-full bg-brand-600 text-white text-[12px] font-bold flex items-center justify-center shrink-0 mt-0.5">{n}</span>
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}
