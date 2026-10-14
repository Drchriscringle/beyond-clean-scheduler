import { useState } from "react";
import { ArrowLeft, Trash2, CreditCard, Coins } from "lucide-react";
import { Page, Button, Input, Select, ErrorText } from "../components/ui";
import { Section } from "../components/common";
import { LegalFooter } from "../components/LegalFooter";
import { SUPPORTED_CURRENCIES } from "../lib/money";
import { useUpdateFamilyCurrency, useDeleteMyAccount } from "../hooks/useFamily";
import * as api from "../lib/api";

export function Settings({ family, onExit }) {
  const [currency, setCurrency] = useState(family.currency || "GBP");
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [err, setErr] = useState("");
  const [billingBusy, setBillingBusy] = useState(false);
  const updateCurrency = useUpdateFamilyCurrency();
  const deleteAccount = useDeleteMyAccount();

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
