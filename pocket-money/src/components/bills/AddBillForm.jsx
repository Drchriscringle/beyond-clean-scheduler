import { useState } from "react";
import { Plus } from "lucide-react";
import { useAddBill } from "../../hooks/useBills";
import { Button, Input, Select, ErrorText } from "../ui";

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
    const pence = Math.round(parseFloat(value) * 100);
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
      <Button variant="ghost" size="sm" className="w-full text-brand-600" onClick={() => setOpen(true)}>
        <Plus size={15} /> Add a bill
      </Button>
    );
  }

  return (
    <div className="rounded-xl bg-surface p-3 space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {BILL_ICONS.map((i) => (
          <button
            key={i}
            onClick={() => setIcon(i)}
            className={`h-9 w-9 rounded-xl flex items-center justify-center text-lg transition ${
              icon === i ? "bg-brand-600 ring-2 ring-brand-200" : "bg-white hover:bg-brand-50"
            }`}
          >
            {i}
          </button>
        ))}
      </div>
      <Input label="Bill" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rent" />
      <div className="grid grid-cols-2 gap-2">
        <Input
          label="Amount"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="0.00"
        />
        <Select label="Frequency" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </Select>
      </div>
      <ErrorText>{err}</ErrorText>
      <div className="flex gap-2">
        <Button size="sm" className="flex-1" onClick={add} disabled={addBill.isPending}>Add bill</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}
