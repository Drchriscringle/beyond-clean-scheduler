import { useState } from "react";
import { Plus } from "lucide-react";
import { useAddChore } from "../../hooks/useChores";
import { Button, Input, ErrorText, Card } from "../ui";

const CHORE_ICONS = ["⭐", "🧹", "🍽️", "🛏️", "🧺", "📚", "🐕", "🌱", "🚮", "🧼"];

export function AddChoreForm({ familyId }) {
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [icon, setIcon] = useState(CHORE_ICONS[0]);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const addChore = useAddChore();

  const add = async () => {
    const pence = Math.round(parseFloat(value) * 100);
    if (!name.trim() || !pence) return;
    setErr("");
    try {
      await addChore.mutateAsync({ name: name.trim(), icon, value_pence: pence, familyId });
      setName("");
      setValue("");
      setIcon(CHORE_ICONS[0]);
      setOpen(false);
    } catch (e) {
      setErr(e.message);
    }
  };

  if (!open) {
    return (
      <Button variant="secondary" className="w-full mt-3" onClick={() => setOpen(true)}>
        <Plus size={16} /> Add a chore
      </Button>
    );
  }

  return (
    <Card className="p-4 space-y-3 mt-3">
      <div>
        <span className="block text-[12px] font-semibold text-ink-muted mb-1.5">Icon</span>
        <div className="flex flex-wrap gap-1.5">
          {CHORE_ICONS.map((i) => (
            <button
              key={i}
              onClick={() => setIcon(i)}
              className={`h-9 w-9 rounded-xl flex items-center justify-center text-lg transition ${
                icon === i ? "bg-brand-600 ring-2 ring-brand-200" : "bg-surface hover:bg-brand-50"
              }`}
            >
              {i}
            </button>
          ))}
        </div>
      </div>
      <Input label="Chore" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Make bed" />
      <Input
        label="Reward (e.g. 0.50)"
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ""))}
        onKeyDown={(e) => e.key === "Enter" && add()}
        placeholder="0.00"
      />
      <ErrorText>{err}</ErrorText>
      <div className="flex gap-2">
        <Button className="flex-1" onClick={add} disabled={addChore.isPending}>Add chore</Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </Card>
  );
}
