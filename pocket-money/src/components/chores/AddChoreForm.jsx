import { useState } from "react";
import { Plus } from "lucide-react";
import { useAddChore } from "../../hooks/useChores";

const CHORE_ICONS = ["⭐", "🧹", "🍽️", "🛏️", "🧺", "📚", "🐕", "🌱", "🚮", "🧼"];

export function AddChoreForm({ familyId }) {
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [icon, setIcon] = useState(CHORE_ICONS[0]);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const addChore = useAddChore();

  const add = async () => {
    const pence = parseInt(value, 10);
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
      <button
        onClick={() => setOpen(true)}
        className="mt-3 w-full flex items-center justify-center gap-1.5 text-sm font-bold text-amber-600 border-2 border-dashed border-amber-200 hover:border-amber-400 hover:bg-amber-50 transition rounded-2xl py-2"
      >
        <Plus size={16} /> Add a chore
      </button>
    );
  }

  return (
    <div className="mt-3 p-3 rounded-2xl bg-amber-50/70 space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {CHORE_ICONS.map((i) => (
          <button
            key={i}
            onClick={() => setIcon(i)}
            className={`text-xl w-9 h-9 rounded-full flex items-center justify-center transition ${
              icon === i ? "bg-amber-400 scale-110 shadow" : "bg-white hover:bg-amber-100"
            }`}
          >
            {i}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          autoFocus
          className="border-2 border-amber-100 focus:border-amber-400 outline-none rounded-xl px-3 py-2 text-sm flex-1"
          placeholder="Chore name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="border-2 border-amber-100 focus:border-amber-400 outline-none rounded-xl px-3 py-2 text-sm w-16 text-center"
          placeholder="p"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button
          onClick={add}
          className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl px-4 text-sm font-bold transition"
        >
          Add
        </button>
      </div>
      {err && <p className="text-xs text-rose-600 font-medium">{err}</p>}
    </div>
  );
}
