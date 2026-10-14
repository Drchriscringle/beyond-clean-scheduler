import { useState } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
import { BackgroundBlobs, Section, BigButton } from "../components/common";
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

  const saveCurrency = (value) => {
    setCurrency(value);
    updateCurrency.mutate({ familyId: family.id, currency: value });
  };

  const doDelete = async () => {
    setErr("");
    try {
      await deleteAccount.mutateAsync();
      // Account + auth session are gone server-side; reload to land back on sign-in.
      window.location.href = "/";
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <BackgroundBlobs />
      <div className="relative max-w-2xl mx-auto p-4 space-y-6 pb-16">
        <header className="flex items-center gap-2 pt-2">
          <button
            onClick={onExit}
            className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-600 transition"
          >
            <ArrowLeft size={14} /> Back
          </button>
          <h1 className="font-display text-xl font-extrabold text-slate-800">⚙️ Settings</h1>
        </header>

        <Section title="Currency" emoji="💱" subtitle="How amounts are displayed throughout the app.">
          <select
            value={currency}
            onChange={(e) => saveCurrency(e.target.value)}
            className="border-2 border-indigo-100 focus:border-indigo-400 outline-none rounded-xl px-3 py-2 text-sm bg-white font-semibold"
          >
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Section>

        <Section title="Billing" emoji="💳" subtitle="Manage your subscription, payment method, and invoices.">
          <BigButton onClick={openBillingPortal} disabled={billingBusy} className="bg-white border-2 border-indigo-200 text-indigo-600">
            {billingBusy ? "One moment…" : "Manage billing"}
          </BigButton>
        </Section>

        <Section title="Danger zone" emoji="⚠️">
          {!confirming ? (
            <button
              onClick={() => setConfirming(true)}
              className="flex items-center gap-1.5 text-sm font-bold text-rose-600 border-2 border-dashed border-rose-200 hover:border-rose-400 hover:bg-rose-50 transition rounded-2xl py-2 px-4"
            >
              <Trash2 size={15} /> Delete my family &amp; account
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-slate-600">
                This permanently deletes your family, every child, chore, bill and
                transaction, and your own sign-in account. This cannot be undone.
                Type <strong>DELETE</strong> to confirm.
              </p>
              <input
                className="w-full border-2 border-rose-200 focus:border-rose-400 outline-none rounded-xl px-3 py-2 text-sm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
              />
              {err && <p className="text-xs text-rose-600 font-medium">{err}</p>}
              <div className="flex gap-2">
                <BigButton
                  onClick={doDelete}
                  disabled={confirmText !== "DELETE" || deleteAccount.isPending}
                  className="bg-rose-600 text-white hover:brightness-105"
                >
                  {deleteAccount.isPending ? "Deleting…" : "Permanently delete"}
                </BigButton>
                <button
                  onClick={() => {
                    setConfirming(false);
                    setConfirmText("");
                  }}
                  className="px-4 text-sm font-semibold text-slate-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </Section>

        <LegalFooter />
      </div>
    </div>
  );
}
