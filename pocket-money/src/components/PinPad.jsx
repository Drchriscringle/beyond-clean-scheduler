import { useState } from "react";
import { X, Delete } from "lucide-react";
import { useCheckChildPin } from "../hooks/useChildren";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function PinPad({ kid, onCancel, onSuccess }) {
  const [entered, setEntered] = useState("");
  const [shake, setShake] = useState(false);
  const checkPin = useCheckChildPin();

  const press = (digit) => {
    if (shake || checkPin.isPending) return;
    const next = (entered + digit).slice(0, 4);
    setEntered(next);
    if (next.length === 4) {
      checkPin.mutate(
        { childId: kid.id, pin: next },
        {
          onSuccess: (correct) => {
            if (correct) {
              onSuccess();
            } else {
              setShake(true);
              setTimeout(() => {
                setShake(false);
                setEntered("");
              }, 400);
            }
          },
          onError: () => {
            setShake(true);
            setTimeout(() => {
              setShake(false);
              setEntered("");
            }, 400);
          },
        }
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className={`w-full max-w-xs bg-white rounded-[2rem] p-6 shadow-2xl text-center ${shake ? "animate-shake" : ""}`}
      >
        <span className="text-4xl">{kid.avatar}</span>
        <div className="font-display font-bold text-slate-800 mt-1 mb-4">{kid.name}'s PIN</div>
        <div className="flex justify-center gap-3 mb-5">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-3.5 h-3.5 rounded-full border-2 transition ${
                i < entered.length ? "bg-indigo-500 border-indigo-500" : "border-slate-300"
              }`}
            />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {KEYS.map((d) => (
            <button
              key={d}
              onClick={() => press(d)}
              className="h-14 rounded-2xl bg-slate-50 hover:bg-indigo-50 active:bg-indigo-100 text-xl font-display font-bold text-slate-700 transition"
            >
              {d}
            </button>
          ))}
          <button
            onClick={onCancel}
            className="h-14 rounded-2xl bg-slate-50 hover:bg-rose-50 text-slate-400 flex items-center justify-center transition"
          >
            <X size={20} />
          </button>
          <button
            onClick={() => press("0")}
            className="h-14 rounded-2xl bg-slate-50 hover:bg-indigo-50 active:bg-indigo-100 text-xl font-display font-bold text-slate-700 transition"
          >
            0
          </button>
          <button
            onClick={() => setEntered((e) => e.slice(0, -1))}
            className="h-14 rounded-2xl bg-slate-50 hover:bg-indigo-50 text-slate-500 flex items-center justify-center transition"
          >
            <Delete size={18} />
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-4">Ask a grown-up if you forgot your PIN.</p>
      </div>
    </div>
  );
}
