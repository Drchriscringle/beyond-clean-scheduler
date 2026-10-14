import { useState } from "react";
import { PiggyBank, Calculator, ClipboardCheck, Coins, Palette, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button, Logo } from "./ui";

const SLIDES = [
  {
    icon: PiggyBank,
    title: "Welcome to Pocket Money",
    body: "Chores turn into pocket money your child can see, save, spend and give. It's all pretend money — no bank accounts involved — so they can learn with zero risk.",
  },
  {
    icon: Calculator,
    title: "Set the weekly amount",
    body: "Decide how much each child can earn this week. Add their chores and how many times a week they can do each one — the amount splits itself across them, or you give any chore its own value.",
  },
  {
    icon: ClipboardCheck,
    title: "They do, you approve",
    body: "Your child taps a chore when it's done. You get an alert, check it's really done, and tap Approve. Decline sends it back. Weekly limits reset every Monday.",
  },
  {
    icon: Coins,
    title: "Money drops into jars",
    body: "Each reward is split into Save, Spend and Give jars so they learn to put some aside and share some. Optional pretend bills teach that money goes out, too.",
  },
  {
    icon: Palette,
    title: "Make it theirs",
    body: "Every child gets their own screen, locked with a PIN: their colour, icon, photo and wallpaper, a daily money lesson pitched at their age, and a celebration when the week's jobs are done.",
  },
];

export function WelcomeTour({ onClose }) {
  const [i, setI] = useState(0);
  const slide = SLIDES[i];
  const Icon = slide.icon;
  const last = i === SLIDES.length - 1;

  return (
    <div className="fixed inset-0 z-[65] bg-ink/55 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] tip-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="How Pocket Money works"
      >
        <div className="flex items-center justify-between">
          <Logo size={36} />
          <button onClick={onClose} aria-label="Skip" className="h-9 w-9 rounded-full flex items-center justify-center text-ink-muted hover:bg-surface">
            <X size={18} />
          </button>
        </div>

        <div key={i} className="tip-in mt-5">
          <div className="h-16 w-16 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center">
            <Icon size={30} />
          </div>
          <h2 className="mt-4 text-[22px] font-bold tracking-tight text-ink">{slide.title}</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">{slide.body}</p>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div className="flex gap-1.5">
            {SLIDES.map((_, n) => (
              <span key={n} className="h-1.5 rounded-full transition-all" style={{ width: n === i ? 20 : 6, background: n === i ? "#5b2fa8" : "#e9ebf2" }} />
            ))}
          </div>
          <div className="flex gap-2">
            {i > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setI(i - 1)}>
                <ChevronLeft size={16} /> Back
              </Button>
            )}
            <Button size="sm" onClick={() => (last ? onClose() : setI(i + 1))}>
              {last ? "Let's go" : "Next"} {!last && <ChevronRight size={16} />}
            </Button>
          </div>
        </div>
        {!last && (
          <button onClick={onClose} className="mt-4 w-full text-[12.5px] text-ink-muted hover:text-ink">Skip the tour</button>
        )}
      </div>
    </div>
  );
}
