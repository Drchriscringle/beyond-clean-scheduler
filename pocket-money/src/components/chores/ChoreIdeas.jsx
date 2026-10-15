import { useState } from "react";
import { Plus, Check } from "lucide-react";
import { useAddChore } from "../../hooks/useChores";
import { Card, IconCircle, Button, Select } from "../ui";
import { ChildAvatar } from "../children/ChildAvatar";

export const CHORE_IDEAS = [
  { icon: "🛏️", name: "Make bed" },
  { icon: "🍽️", name: "Clear the table" },
  { icon: "🧼", name: "Wash up" },
  { icon: "🧹", name: "Tidy bedroom" },
  { icon: "🧺", name: "Put laundry away" },
  { icon: "🚮", name: "Take bins out" },
  { icon: "🐕", name: "Feed the pet" },
  { icon: "🌱", name: "Water the plants" },
  { icon: "📚", name: "Homework done" },
  { icon: "🪥", name: "Brush teeth" },
  { icon: "🧸", name: "Put toys away" },
  { icon: "🛒", name: "Help with shopping" },
  { icon: "🧽", name: "Wipe the surfaces" },
  { icon: "🪴", name: "Help in the garden" },
  { icon: "🚗", name: "Wash the car" },
  { icon: "👟", name: "Line up shoes" },
];

const TIMES = Array.from({ length: 7 }, (_, i) => i + 1);

// A list of ready-made chores to hand out: tap one, pick who it's for and
// how often, and it's added to that child's week (auto-split amount).
export function ChoreIdeas({ familyId, kids, existing }) {
  const [picked, setPicked] = useState(null);
  const [childId, setChildId] = useState(kids[0]?.id || "");
  const [times, setTimes] = useState(1);
  const [justAdded, setJustAdded] = useState(null);
  const add = useAddChore();

  const give = async () => {
    const kid = kids.find((k) => k.id === (childId || kids[0]?.id));
    if (!picked || !kid) return;
    await add.mutateAsync({ familyId, childId: kid.id, name: picked.name, icon: picked.icon, timesPerWeek: times, customValue: false });
    setJustAdded(`${picked.name} → ${kid.name}`);
    setPicked(null);
    setTimeout(() => setJustAdded(null), 2200);
  };

  const has = (idea) => existing.some((c) => c.name.toLowerCase() === idea.name.toLowerCase());

  return (
    <Card className="p-4">
      <div className="text-[15px] font-semibold text-ink">Chores to give out</div>
      <p className="text-[12.5px] text-ink-muted mt-0.5 mb-3">Tap a chore, choose who it's for. Or add your own in a child's list below.</p>
      <div className="grid grid-cols-2 gap-2">
        {CHORE_IDEAS.map((idea) => {
          const on = picked?.name === idea.name;
          return (
            <button
              key={idea.name}
              onClick={() => setPicked(on ? null : idea)}
              className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition active:scale-[0.98] ${on ? "border-brand-400 bg-brand-50 ring-4 ring-brand-100" : "border-line bg-white hover:bg-surface"}`}
            >
              <IconCircle tone="amber" size={34}>{idea.icon}</IconCircle>
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] font-medium text-ink truncate">{idea.name}</span>
                {has(idea) && <span className="block text-[10.5px] text-ink-muted">already given</span>}
              </span>
            </button>
          );
        })}
      </div>

      {picked && (
        <div className="mt-3 rounded-xl bg-surface p-3 space-y-3 tip-in">
          <div className="text-[13px] font-semibold text-ink">Give "{picked.name}" to…</div>
          <div className="flex flex-wrap gap-2">
            {kids.map((k) => {
              const on = (childId || kids[0]?.id) === k.id;
              return (
                <button key={k.id} onClick={() => setChildId(k.id)} className={`inline-flex items-center gap-2 rounded-full border pl-1 pr-3 h-10 text-[13px] font-semibold transition ${on ? "border-brand-400 bg-white text-brand-700 ring-4 ring-brand-100" : "border-line bg-white text-ink"}`}>
                  <ChildAvatar kid={k} size={30} /> {k.name}
                </button>
              );
            })}
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Select label="Times a week" value={times} onChange={(e) => setTimes(Number(e.target.value))}>
                {TIMES.map((n) => <option key={n} value={n}>{n}×</option>)}
              </Select>
            </div>
            <Button className="h-11" onClick={give} disabled={add.isPending || kids.length === 0}>
              <Plus size={16} /> Give chore
            </Button>
          </div>
        </div>
      )}
      {justAdded && (
        <p className="mt-3 text-[13px] font-medium text-emerald-800 bg-emerald-50 rounded-xl px-3 py-2 flex items-center gap-2 tip-in">
          <Check size={15} /> Added {justAdded}
        </p>
      )}
      {add.isError && <p className="mt-3 text-[12.5px] text-rose-600">{add.error.message}</p>}
    </Card>
  );
}
