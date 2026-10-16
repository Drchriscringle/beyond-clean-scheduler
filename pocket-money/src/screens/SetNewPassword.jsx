import { useState } from "react";
import { KeyRound } from "lucide-react";
import { Card, Centered, Logo, Button, Input, ErrorText } from "../components/ui";
import { LegalFooter } from "../components/LegalFooter";
import * as api from "../lib/api";

// Shown after a parent taps the link in a password-reset email.
export function SetNewPassword({ onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (password.length < 6) return setErr("Use at least 6 characters.");
    if (password !== confirm) return setErr("Those passwords don't match.");
    setBusy(true);
    try {
      await api.updatePassword(password);
      onDone();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Centered>
      <Card className="max-w-sm p-7">
        <div className="flex flex-col items-center text-center gap-3 mb-5">
          <Logo size={56} />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">Choose a new password</h1>
            <p className="text-sm text-ink-muted mt-1">You're signed in — just pick a password you'll remember.</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <Input label="New password" type="password" autoComplete="new-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          <Input label="Type it again" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" />
          <ErrorText>{err}</ErrorText>
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            <KeyRound size={17} /> {busy ? "Saving…" : "Save password"}
          </Button>
        </form>
        <button type="button" onClick={onDone} className="mt-4 w-full text-[13px] text-ink-muted hover:text-brand-600 transition">
          Skip for now
        </button>
      </Card>
      <LegalFooter />
    </Centered>
  );
}
