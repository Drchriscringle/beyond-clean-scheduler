import { useState } from "react";
import { ArrowLeft, Trash2, CreditCard, Coins, Bell, Volume2, Lightbulb } from "lucide-react";
import { Page, Button, Input, Select, ErrorText } from "../components/ui";
import { Section } from "../components/common";
import { LegalFooter } from "../components/LegalFooter";
import { SUPPORTED_CURRENCIES } from "../lib/money";
import { useUpdateFamilyCurrency, useDeleteMyAccount } from "../hooks/useFamily";
import { useChoreAlerts } from "../hooks/usePush";
import { soundEnabled, setSoundEnabled, playCoinShower } from "../lib/sound";
import { tipsEnabled, setTipsEnabled, resetTips } from "../lib/tips";
import * as api from "../lib/api";

export function Settings({ family, onExit }) {
  const [currency, setCurrency] = useState(family.currency || "GBP");
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [err, setErr] = useState("");
  const [billingBusy, setBillingBusy] = useState(false);
  const updateCurrency = useUpdateFamilyCurrency();
  const deleteAccount = useDeleteMyAccount();
  const alerts = useChoreAlerts(family.id);
  const [sound, setSound] = useState(soundEnabled());
  const [tips, setTips] = useState(tipsEnabled());

  const saveCurrency = (value) => {
    setCurrency(value);
    updateCurrency.mutate({ familyId: family.id, currency: value });
  };

  const openBillingPortal = async () => {
    setBillingBusy(true);
    setErr("");
    try {
      window.location.href = await api.createBillingPortalSession();
    } catch (e) {
      setErr(e.message);
      setBillingBusy(false);
    }
  };

  const doDelete = async () => {
    setErr("");
    try {
      await deleteAccount.mutateAsync();
      window.location.href = "/";
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <Page>
      <header className="flex items-center gap-3 pt-5 pb-3">
        <button onClick={onExit} aria-label="Back" className="h-10 w-10 -ml-2 rounded-full flex items-center justify-center text-ink-muted hover:text-ink hover:bg-white transition">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-[18px] font-semibold text-ink">Settings</h1>
      </header>

      <div className="space-y-4">
        <Section title="Currency" icon={<Coins size={18} />} subtitle="How amounts are shown throughout the app.">
          <Select value={currency} onChange={(e) => saveCurrency(e.target.value)}>
            {SUPPORTED_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Section>

        <Section title="Tips" icon={<Lightbulb size={18} />} subtitle="Short explainer cards the first time you use each part of the app.">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13.5px] font-medium text-ink">{tips ? "Tips are on" : "Tips are off"}</span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => { resetTips(); setTips(true); }}>Show all again</Button>
              <Button variant="secondary" size="sm" onClick={() => { setTipsEnabled(!tips); setTips(!tips); }}>
                {tips ? "Turn off" : "Turn on"}
              </Button>
            </div>
          </div>
        </Section>

        <Section title="Sounds" icon={<Volume2 size={18} />} subtitle="Coins clinking when pocket money lands.">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13.5px] font-medium text-ink">{sound ? "Sounds are on" : "Sounds are off"}</span>
            <div className="flex gap-2">
              {sound && <Button variant="ghost" size="sm" onClick={() => playCoinShower(8, 0.8)}>Preview</Button>}
              <Button variant="secondary" size="sm" onClick={() => { setSoundEnabled(!sound); setSound(!sound); }}>
                {sound ? "Turn off" : "Turn on"}
              </Button>
            </div>
          </div>
        </Section>

        {alerts.configured && (
          <Section title="Chore alerts" icon={<Bell size={18} />} subtitle="Get a notification on this device when a child marks a chore done.">
            {alerts.status === "ios-install" && (
              <p className="text-[13px] text-ink-muted">On iPhone, alerts only work once Pocket Money is added to your Home Screen (Share → Add to Home Screen). Open it from there, then come back here.</p>
            )}
            {alerts.status === "unsupported" && <p className="text-[13px] text-ink-muted">This browser doesn't support notifications.</p>}
            {alerts.status === "checking" && <p className="text-[13px] text-ink-muted">Checking…</p>}
            {alerts.status === "off" && (
              <Button className="w-full" onClick={() => alerts.enable.mutate()} disabled={alerts.enable.isPending}>
                <Bell size={16} /> {alerts.enable.isPending ? "Turning on…" : "Turn on alerts on this device"}
              </Button>
            )}
            {alerts.status === "on" && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13.5px] font-medium text-emerald-700">Alerts are on for this device.</span>
                <Button variant="ghost" size="sm" onClick={() => alerts.disable.mutate()} disabled={alerts.disable.isPending}>Turn off</Button>
              </div>
            )}
            {alerts.enable.error && <ErrorText>{alerts.enable.error.message}</ErrorText>}
          </Section>
        )}

        <Section title="Billing" icon={<CreditCard size={18} />} subtitle="Manage your subscription, payment method and invoices.">
          <Button variant="secondary" className="w-full" onClick={openBillingPortal} disabled={billingBusy}>
            {billingBusy ? "One moment…" : "Manage billing"}
          </Button>
        </Section>

        <Section title="Delete account" icon={<Trash2 size={18} />}>
          {!confirming ? (
            <Button variant="ghost" className="w-full text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => setConfirming(true)}>
              <Trash2 size={16} /> Delete my family &amp; account
            </Button>
          ) : (
            <div className="space-y-3">
              <p className="text-[13px] text-ink-muted leading-relaxed">
                This permanently deletes your family, every child, chore, bill and transaction, and your sign-in account. It cannot be undone. Type <strong className="text-ink">DELETE</strong> to confirm.
              </p>
              <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" />
              <div className="flex gap-2">
                <Button variant="danger" className="flex-1" onClick={doDelete} disabled={confirmText !== "DELETE" || deleteAccount.isPending}>
                  {deleteAccount.isPending ? "Deleting…" : "Permanently delete"}
                </Button>
                <Button variant="ghost" onClick={() => { setConfirming(false); setConfirmText(""); }}>Cancel</Button>
              </div>
            </div>
          )}
        </Section>
        <ErrorText>{err}</ErrorText>
      </div>

      <LegalFooter />
    </Page>
  );
}
