import { useState } from "react";
import { Centered, Card, BrandHeader, BigButton, primaryBtn } from "../components/common";
import { LegalFooter } from "../components/LegalFooter";
import * as api from "../lib/api";

export function AuthGate() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("signin"); // signin | signup
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr("");
    setBusy(true);
    try {
      if (mode === "signup") await api.signUp(email, password);
      else await api.signIn(email, password);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Centered>
      <Card>
        <BrandHeader />
        <div className="space-y-3">
          <input
            className="w-full border-2 border-indigo-100 focus:border-indigo-400 outline-none rounded-2xl px-4 py-3 transition"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="w-full border-2 border-indigo-100 focus:border-indigo-400 outline-none rounded-2xl px-4 py-3 transition"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {err && <p className="text-sm text-rose-600 font-medium">{err}</p>}
        <BigButton disabled={busy} onClick={submit} className={primaryBtn}>
          {mode === "signup" ? "Create account" : "Sign in"}
        </BigButton>
        <button
          className="w-full text-sm text-slate-500 font-medium hover:text-indigo-600 transition"
          onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
        >
          {mode === "signup" ? "Already have an account? Sign in" : "New parent? Create an account"}
        </button>
      </Card>
      <LegalFooter />
    </Centered>
  );
}
