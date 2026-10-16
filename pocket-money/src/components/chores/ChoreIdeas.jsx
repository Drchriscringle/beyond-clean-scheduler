import { useState } from "react";
import { Check, PenLine } from "lucide-react";
import { CHORE_IDEAS, ChoreIcon } from "../../lib/choreIcons";
import { Card, IconCircle } from "../ui";
import { ChoreComposer } from "./ChoreComposer";

// Ready-made chores to hand out, plus "Custom chore" for anything else.
// Tapping one opens the composer prefilled: who, when, how much.
export function ChoreIdeas({ familyId, kids, existing }) {
  const [picked, setPicked] = useState(null); // idea | "custom" | null
  const [justAdded, setJustAdded] = useState(null);

  const has = (idea) => existing.some((c) => c.name.toLowerCase() === idea.name.toLowerCase());
  const added = ({ name, kids: who }) => {
    setJustAdded(`${name} → ${who.map((k) => k.name).join(", ")}`);
    setTimeout(() => setJustAdded(null), 2400);
  };

  return (
    <Card className="p-4">
      <div className="text-[15px] font-semibold text-ink">Chores to give out</div>
      <p className="text-[12.5px] text-ink-muted mt-0.5 mb-3">Tap a chore or make your own, then choose who it's for and when.</p>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setPicked(picked === "custom" ? null : "custom")}
          className={`flex items-center gap-2.5 rounded-xl border-2 border-dashed px-2.5 py-2 text-left transition active:scale-[0.98] ${picked === "custom" ? "border-brand-400 bg-brand-50" : "border-brand-200 bg-white hover:bg-brand-50"}`}
        >
          <IconCircle tone="brand" size={34}><PenLine size={17} /></IconCircle>
          <span className="flex-1 min-w-0">
            <span className="block text-[13px] font-semibold text-brand-700">Custom chore</span>
            <span className="block text-[10.5px] text-ink-muted">Your own name &amp; icon</span>
          </span>
        </button>
        {CHORE_IDEAS.map((idea) => {
          const on = picked?.name === idea.name;
          return (
            <button
              key={idea.name}
              onClick={() => setPicked(on ? null : idea)}
              className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition active:scale-[0.98] ${on ? "border-brand-400 bg-brand-50 ring-4 ring-brand-100" : "border-line bg-white hover:bg-surface"}`}
            >
              <IconCircle tone="amber" size={34}><ChoreIcon icon={idea.icon} size={17} /></IconCircle>
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] font-medium text-ink truncate">{idea.name}</span>
                {has(idea) && <span className="block text-[10.5px] text-ink-muted">already given</span>}
              </span>
            </button>
          );
        })}
      </div>

      {picked && (
        <div className="mt-3">
          <ChoreComposer
            key={picked === "custom" ? "custom" : picked.name}
            familyId={familyId}
            kids={kids}
            chores={existing}
            idea={picked === "custom" ? null : picked}
            onClose={() => setPicked(null)}
            onAdded={added}
          />
        </div>
      )}
      {justAdded && (
        <p className="mt-3 text-[13px] font-medium text-emerald-800 bg-emerald-50 rounded-xl px-3 py-2 flex items-center gap-2 tip-in">
          <Check size={15} /> Added {justAdded}
        </p>
      )}
    </Card>
  );
}
