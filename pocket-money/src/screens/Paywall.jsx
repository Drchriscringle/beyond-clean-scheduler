import { useState } from "react";
import { Check } from "lucide-react";
import { Card, Centered, BrandHeader, Button, ErrorText } from "../components/ui";
import { LegalFooter } from "../components/LegalFooter";
import * as api from "../lib/api";

const PERKS = ["Unlimited children and chores", "Save / Spend / Give jars", "Weekly bills and pay day", "Co-parent access"];

export function Paywall({ family }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const expired = family.subscription_status === "trial";

  const subscribe = async () => {
    setBusy(true);
    setErr("");
    try {
      window.location.href = await api.createCheckoutSession();
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };

  return (
    <Centered>
      <Card className="max-w-sm p-7">
        <BrandHeader subtitle={expired ? "Your free trial has ended." : "A subscription is needed to continue."} />
        <p className="text-[13.5px] text-ink-muted text-center mt-3">
          Keep {family.name}'s chores, jars and pocket money going.
        </p>
        <ul className="mt-5 space-y-2">
          {PERKS.map((p) => (
            <li key={p} className="flex items-center gap-2.5 text-[14px] text-ink">
              <span className="h-5 w-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center"><Check size={13} /></span>
              {p}
            </li>
          ))}
        </ul>
        <ErrorText>{err}</ErrorText>
        <Button size="lg" className="w-full mt-6" onClick={subscribe} disabled={busy}>
          {busy ? "One moment…" : "Subscribe"}
        </Button>
        <button onClick={() => api.signOut()} className="mt-3 w-full text-[13px] text-ink-muted hover:text-ink transition">
          Sign out
        </button>
      </Card>
      <LegalFooter />
    </Centered>
  );
}
