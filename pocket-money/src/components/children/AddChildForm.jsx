import { useState } from "react";
import { Plus } from "lucide-react";
import { useAddChild } from "../../hooks/useChildren";
import { AGE_OPTIONS } from "../../lib/ageMode";
import { Button, Input, Select, ErrorText, Card } from "../ui";

export function AddChildForm({ familyId }) {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [pin, setPin] = useState("");
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const addChild = useAddChild();

  const add = async () => {
    if (!name.trim()) return;
    setErr("");
    try {
      const birthYear = age ? new Date().getFullYear() - Number(age) : null;
      await addChild.mutateAsync({ name: name.trim(), avatar: name.trim()[0].toUpperCase(), pin: pin || "0000", familyId, birthYear });
      setName("");
      setAge("");
      setPin("");
      setOpen(false);
    } catch (e) {
      setErr(e.message);
    }
  };

  if (!open) {
    return (
      <Button variant="secondary" className="w-full" onClick={() => setOpen(true)}>
        <Plus size={16} /> Add a child
      </Button>
    );
  }

  return (
    <Card className="p-4 space-y-3">
      <Input label="Child's name" autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="e.g. Ella" />
      <Select label="Age" value={age} onChange={(e) => setAge(e.target.value)}>
        <option value="">Choose…</option>
        {AGE_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
      </Select>
      <p className="text-[12px] text-ink-muted -mt-1">Their screen adapts to their age — bigger and simpler for little ones.</p>
      <Input
        label="4-digit PIN (optional — defaults to 0000)"
        inputMode="numeric"
        maxLength={4}
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
        onKeyDown={(e) => e.key === "Enter" && add()}
        placeholder="••••"
      />
      <ErrorText>{err}</ErrorText>
      <div className="flex gap-2">
        <Button className="flex-1" onClick={add} disabled={addChild.isPending}>Add child</Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </Card>
  );
}
