import { useState } from "react";
import { Centered, Card, BrandHeader, BigButton, primaryBtn } from "../components/common";
import { LegalFooter } from "../components/LegalFooter";
import * as api from "../lib/api";

export function Paywall({ family }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const expired = family.subscription_status === "trial";

  const subscribe = async () => {
    setBusy(true);
    setErr("");
    try {
      const url = await api.createCheckoutSession();
      window.location.href = url;
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };

  return (
    <Centered>
      <Card>
        <BrandHeader />
        <div className="text-center space-y-2">
          <h2 className="font-display font-bold text-slate-700 text-lg">
            {expired ? "Your free trial has ended" : "Subscription needed"}
          </h2>
          <p className="text-sm text-slate-500">
            Keep {family.name}'s chores, jars and pocket money going with a Pocket Money
            subscription.
          </p>
        </div>
        {err && <p className="text-sm text-rose-600 font-medium text-center">{err}</p>}
        <BigButton disabled={busy} onClick={subscribe} className={primaryBtn}>
          {busy ? "One moment…" : "Subscribe"}
        </BigButton>
        <button
          onClick={() => api.signOut()}
          className="w-full text-sm text-slate-500 font-medium hover:text-indigo-600 transition"
        >
          Sign out
        </button>
      </Card>
      <LegalFooter />
    </Centered>
  );
}
