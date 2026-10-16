import { useState } from "react";
import { X, Delete } from "lucide-react";
import { useCheckChildPin } from "../hooks/useChildren";
import { themeColor } from "../lib/theme";
import { ChildAvatar } from "./children/ChildAvatar";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function PinPad({ kid, onCancel, onSuccess }) {
  const [entered, setEntered] = useState("");
  const [shake, setShake] = useState(false);
  const checkPin = useCheckChildPin();
  const color = themeColor(kid.theme, kid.name);

  const reject = () => {
    setShake(true);
    setTimeout(() => {
      setShake(false);
      setEntered("");
    }, 400);
  };

  const press = (digit) => {
    if (shake || checkPin.isPending) return;
    const next = (entered + digit).slice(0, 4);
    setEntered(next);
    if (next.length === 4) {
      checkPin.mutate(
        { childId: kid.id, pin: next },
        { onSuccess: (ok) => (ok ? onSuccess() : reject()), onError: reject }
      );
    }
  };

  const Key = ({ children, onClick, muted }) => (
    <button
      onClick={onClick}
      className={`h-14 rounded-xl text-xl font-semibold transition active:scale-[0.97] ${
        muted ? "text-ink-muted hover:bg-surface" : "bg-surface text-ink hover:bg-brand-50"
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className={`w-full max-w-xs bg-white rounded-3xl p-6 shadow-2xl text-center ${shake ? "animate-shake" : ""}`}>
        <div className="flex justify-center mb-2">
          <ChildAvatar kid={kid} size={56} />
        </div>
        <div className="font-semibold text-ink">{kid.name}</div>
        <div className="text-[12.5px] text-ink-muted mb-5">Enter your 4-digit PIN</div>
        <div className="flex justify-center gap-3 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="w-3 h-3 rounded-full transition" style={{ background: i < entered.length ? color.main : "#e9ebf2" }} />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {KEYS.map((d) => (
            <Key key={d} onClick={() => press(d)}>{d}</Key>
          ))}
          <Key muted onClick={onCancel}><X size={20} className="mx-auto" /></Key>
          <Key onClick={() => press("0")}>0</Key>
          <Key muted onClick={() => setEntered((e) => e.slice(0, -1))}><Delete size={18} className="mx-auto" /></Key>
        </div>
        <p className="text-[12px] text-ink-muted mt-5">Ask a grown-up if you forgot your PIN.</p>
      </div>
    </div>
  );
}
