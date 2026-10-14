import { useState } from "react";
import { Plus } from "lucide-react";
import { useAddChild } from "../../hooks/useChildren";
import { Button, Input, ErrorText, Card } from "../ui";

export function AddChildForm({ familyId }) {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const addChild = useAddChild();

  const add = async () => {
    if (!name.trim()) return;
    setErr("");
    try {
      await addChild.mutateAsync({ name: name.trim(), avatar: name.trim()[0].toUpperCase(), pin: pin || "0000", familyId });
      setName("");
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
