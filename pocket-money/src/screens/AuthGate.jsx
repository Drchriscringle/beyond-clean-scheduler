import { useState } from "react";
import { Smile, ArrowLeft } from "lucide-react";
import { Card, Centered, BrandHeader, Button, Input, ErrorText } from "../components/ui";
import { LegalFooter } from "../components/LegalFooter";
import * as api from "../lib/api";

export function AuthGate({ onChild }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("signin"); // signin | signup | forgot
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const switchMode = (next) => {
    setMode(next);
    setErr("");
    setNotice("");
  };

  const submit = async (e) => {
    e?.preventDefault();
    setErr("");
    setNotice("");
    setBusy(true);
    try {
      if (mode === "forgot") {
        await api.sendPasswordReset(email.trim());
        setNotice(`If there's an account for ${email.trim()}, we've emailed a link to reset the password. Check your junk folder too.`);
      } else if (mode === "signup") {
        const data = await api.signUp(email, password);
        // With email confirmation on, Supabase creates the account but
        // doesn't sign in until the link in the email is tapped.
        if (!data?.session) {
          setNotice(`We've sent a confirmation link to ${email}. Tap it, then sign in here.`);
          setMode("signin");
          setPassword("");
        }
      } else {
        await api.signIn(email, password);
      }
    } catch (e) {
      const m = e?.message || "Something went wrong.";
      if (/not confirmed/i.test(m)) setErr("Please tap the confirmation link we emailed you first, then sign in.");
      else if (/invalid login/i.test(m)) setErr("That email or password isn't right. Tap \"Forgot password?\" if you need a new one.");
      else if (/rate limit/i.test(m)) setErr("Too many emails sent just now — please wait a little while and try again.");
      else setErr(m);
    } finally {
      setBusy(false);
    }
  };

  if (mode === "forgot") {
    return (
      <Centered>
        <Card className="max-w-sm p-7">
          <BrandHeader subtitle="Enter your email and we'll send a link to choose a new password." />
          <form onSubmit={submit} className="space-y-3 mt-5">
            <Input label="Email" type="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            <ErrorText>{err}</ErrorText>
            {notice && <p className="text-[13px] font-medium text-emerald-800 bg-emerald-50 rounded-xl px-3.5 py-2.5">{notice}</p>}
            <Button type="submit" size="lg" className="w-full" disabled={busy || !email.trim()}>
              {busy ? "Sending…" : "Email me a reset link"}
            </Button>
          </form>
          <button type="button" className="mt-4 w-full text-[13px] text-ink-muted hover:text-brand-600 transition inline-flex items-center justify-center gap-1" onClick={() => switchMode("signin")}>
            <ArrowLeft size={14} /> Back to sign in
          </button>
        </Card>
        <LegalFooter />
      </Centered>
    );
  }

  return (
    <Centered>
      <Card className="max-w-sm p-7">
        <BrandHeader />
        <form onSubmit={submit} className="space-y-3 mt-5">
          <Input label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          <Input
            label="Password"
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
          <ErrorText>{err}</ErrorText>
          {notice && <p className="text-[13px] font-medium text-emerald-800 bg-emerald-50 rounded-xl px-3.5 py-2.5">{notice}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? "One moment…" : mode === "signup" ? "Create account" : "Sign in"}
          </Button>
        </form>
        {mode === "signin" && (
          <button type="button" className="mt-3 w-full text-[13px] text-ink-muted hover:text-brand-600 transition" onClick={() => switchMode("forgot")}>
            Forgot password?
          </button>
        )}
        <button
          type="button"
          className="mt-3 w-full text-[13px] text-ink-muted hover:text-brand-600 transition"
          onClick={() => switchMode(mode === "signup" ? "signin" : "signup")}
        >
          {mode === "signup" ? "Already have an account? Sign in" : "New here? Create a parent account"}
        </button>
        {onChild && (
          <button
            type="button"
            onClick={onChild}
            className="mt-4 w-full h-12 rounded-xl border border-brand-200 bg-brand-50 text-brand-700 text-[14px] font-semibold inline-flex items-center justify-center gap-2 transition hover:bg-brand-100"
          >
            <Smile size={17} /> I'm a child
          </button>
        )}
      </Card>
      <LegalFooter />
    </Centered>
  );
}
