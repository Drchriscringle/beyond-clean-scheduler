import { useState } from "react";
import { Plus } from "lucide-react";
import { useAddBill } from "../../hooks/useBills";

const BILL_ICONS = ["🏠", "💡", "🍽️", "🚌", "📱", "🛒", "💧", "🌐"];

export function AddBillForm({ familyId, childId }) {
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [icon, setIcon] = useState(BILL_ICONS[0]);
  const [frequency, setFrequency] = useState("weekly");
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const addBill = useAddBill();

  const add = async () => {
    const pence = parseInt(value, 10);
    if (!name.trim() || !pence) return;
    setErr("");
    try {
      await addBill.mutateAsync({ familyId, childId, name: name.trim(), icon, amount_pence: pence, frequency });
      setName("");
      setValue("");
      setIcon(BILL_ICONS[0]);
      setFrequency("weekly");
      setOpen(false);
    } catch (e) {
      setErr(e.message);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-sky-600 border-2 border-dashed border-sky-200 hover:border-sky-400 hover:bg-sky-50 transition rounded-xl py-1.5"
      >
        <Plus size={14} /> Add a bill
      </button>
    );
  }

  return (
    <div className="p-2.5 rounded-xl bg-sky-50/70 space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {BILL_ICONS.map((i) => (
          <button
            key={i}
            onClick={() => setIcon(i)}
            className={`text-lg w-8 h-8 rounded-full flex items-center justify-center transition ${
              icon === i ? "bg-sky-400 scale-110 shadow" : "bg-white hover:bg-sky-100"
            }`}
          >
            {i}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          autoFocus
          className="border-2 border-sky-100 focus:border-sky-400 outline-none rounded-lg px-2.5 py-1.5 text-sm flex-1"
          placeholder="Bill name (e.g. Rent)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="border-2 border-sky-100 focus:border-sky-400 outline-none rounded-lg px-2.5 py-1.5 text-sm w-16 text-center"
          placeholder="p"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
      </div>
      <div className="flex gap-2 items-center">
        <select
          value={frequency}
          onChange={(e) => setFrequency(e.target.value)}
          className="border-2 border-sky-100 focus:border-sky-400 outline-none rounded-lg px-2 py-1.5 text-sm bg-white"
        >
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
        <button
          onClick={add}
          className="flex-1 bg-sky-500 hover:bg-sky-600 text-white rounded-lg px-3 py-1.5 text-sm font-bold transition"
        >
          Add bill
        </button>
      </div>
      {err && <p className="text-xs text-rose-600 font-medium">{err}</p>}
    </div>
  );
}
