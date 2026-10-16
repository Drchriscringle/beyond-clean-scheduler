import { useState } from "react";
import { Delete, ArrowRight, ArrowLeft } from "lucide-react";
import { Card, Centered, Logo, Input, ErrorText, LoadingScreen } from "../components/ui";
import { LegalFooter } from "../components/LegalFooter";
import { useChildSignIn } from "../hooks/useChildDevice";
import { normaliseUsername } from "../lib/api/children";
import { playTap } from "../lib/sound";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

// Child sign-in: username, then a 4-digit PIN pad. `checking` is true while
// we're finding out whether this device is already signed in (page reload).
export function ChildSignIn({ onParent, checking = false }) {
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [step, setStep] = useState("name"); // name | pin
  const [err, setErr] = useState("");
  const [shake, setShake] = useState(false);
  const signIn = useChildSignIn();

  if (checking && !signIn.isPending && !signIn.isError) return <LoadingScreen />;

  const next = (e) => {
    e?.preventDefault();
    const u = normaliseUsername(username);
    if (u.length < 3) return setErr("Ask a grown-up for your username.");
    setErr("");
    setUsername(u);
    setStep("pin");
  };

  const reject = (message) => {
    setErr(message);
    setShake(true);
    setTimeout(() => {
      setShake(false);
      setPin("");
    }, 450);
  };

  const press = (digit) => {
    if (shake || signIn.isPending) return;
    playTap();
    const value = (pin + digit).slice(0, 4);
    setPin(value);
    if (value.length === 4) {
      signIn.mutate(
        { username, pin: value },
        {
          onError: (e) => {
            const m = e?.message || "";
            if (/username/i.test(m)) {
              setStep("name");
              setPin("");
              setErr("We couldn't find that username — check it with a grown-up.");
            } else if (/too many/i.test(m)) {
              reject("Too many tries — ask a grown-up and try again in a few minutes.");
            } else {
              reject("That PIN isn't right. Try again.");
            }
          },
        }
      );
    }
  };

  const Key = ({ children, onClick, muted }) => (
    <button
      type="button"
      onClick={onClick}
      className={`h-16 rounded-2xl text-2xl font-semibold transition active:scale-[0.97] ${muted ? "text-ink-muted hover:bg-surface" : "bg-surface text-ink hover:bg-brand-50"}`}
    >
      {children}
    </button>
  );

  return (
    <Centered>
      <Card className={`max-w-sm p-7 ${shake ? "animate-shake" : ""}`}>
        <div className="flex flex-col items-center text-center gap-3">
          <Logo size={56} />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">Hi there!</h1>
            <p className="text-sm text-ink-muted mt-1">{step === "name" ? "Type your username to start." : `Now your 4-digit PIN, ${username}.`}</p>
          </div>
        </div>

        {step === "name" ? (
          <form onSubmit={next} className="mt-6 space-y-3">
            <Input
              label="Username"
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. ella-m"
              className="text-[18px] h-13"
            />
            <ErrorText>{err}</ErrorText>
            <button type="submit" className="w-full h-13 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-[16px] font-semibold inline-flex items-center justify-center gap-2 transition active:scale-[0.98]">
              Next <ArrowRight size={18} />
            </button>
          </form>
        ) : (
          <div className="mt-6">
            <div className="flex justify-center gap-3 mb-6">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="w-3.5 h-3.5 rounded-full transition" style={{ background: i < pin.length ? "#5b2fa8" : "#e9ebf2" }} />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {KEYS.map((d) => <Key key={d} onClick={() => press(d)}>{d}</Key>)}
              <Key muted onClick={() => { setStep("name"); setPin(""); setErr(""); }}><ArrowLeft size={22} className="mx-auto" /></Key>
              <Key onClick={() => press("0")}>0</Key>
              <Key muted onClick={() => setPin((p) => p.slice(0, -1))}><Delete size={20} className="mx-auto" /></Key>
            </div>
            <div className="mt-4 min-h-5 text-center">
              {signIn.isPending ? <p className="text-[13px] text-ink-muted">Signing in…</p> : <ErrorText>{err}</ErrorText>}
            </div>
          </div>
        )}

        <button type="button" onClick={onParent} className="mt-5 w-full text-[13px] text-ink-muted hover:text-brand-600 transition">
          I'm a parent
        </button>
      </Card>
      <LegalFooter />
    </Centered>
  );
}
