import { useState } from "react";
import { PiggyBank, Calculator, CalendarDays, ClipboardCheck, Coins, Smartphone, MessageCircle, X, ChevronLeft, ChevronRight } from "lucide-react";
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
    body: "On Home, decide how much each child can earn per week. The amount splits itself across every chore completion planned for that week — or give any chore its own value and the rest re-balance.",
  },
  {
    icon: CalendarDays,
    title: "Plan the chores",
    body: "In the Chores tab, hand out ready-made chores or make your own with an icon. Each one happens on any days this week, every day, or on days you pick from today and the next seven. Tap a day in the planner to see who has what.",
  },
  {
    icon: ClipboardCheck,
    title: "They do, you approve",
    body: "Your child taps a chore when it's done. You get an alert, check it's really done, and tap Approve on Home. Decline sends it back. Every-day and planned chores come back each morning; any-day ones reset on Monday.",
  },
  {
    icon: Coins,
    title: "Money drops into jars",
    body: "Each reward is split into Save, Spend and Give jars so they learn to put some aside and share some. Optional pretend bills in Bills & Jars teach that money goes out, too.",
  },
  {
    icon: Smartphone,
    title: "Their own device",
    body: "Open a child's Sign-in details on Home to give them a username and PIN. On their phone or tablet they use the child link and see only their chores, jars and messages — and they can make it theirs with a colour, icon, photo and wallpaper.",
  },
  {
    icon: MessageCircle,
    title: "Stay in touch",
    body: "Message each child from Home, with one-tap quick replies for little ones. You'll both get an alert when something new arrives, and they get a buzz when money lands.",
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
