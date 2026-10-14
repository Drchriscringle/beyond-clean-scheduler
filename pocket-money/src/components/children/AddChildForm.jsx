import { useState } from "react";
import { Plus } from "lucide-react";
import { useAddChild } from "../../hooks/useChildren";

const AVATARS = ["🙂", "🐶", "🐱", "🦊", "🐵", "🦄", "🐸", "🐼", "🐧", "🦁"];

export function AddChildForm({ familyId }) {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [pin, setPin] = useState("");
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const addChild = useAddChild();

  const add = async () => {
    if (!name.trim()) return;
    setErr("");
    try {
      await addChild.mutateAsync({ name: name.trim(), avatar, pin: pin || "0000", familyId });
      setName("");
      setAvatar(AVATARS[0]);
      setPin("");
      setOpen(false);
    } catch (e) {
      setErr(e.message);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 w-full flex items-center justify-center gap-1.5 text-sm font-bold text-indigo-600 border-2 border-dashed border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 transition rounded-2xl py-2"
      >
        <Plus size={16} /> Add a child
      </button>
    );
  }

  return (
    <div className="mt-3 p-3 rounded-2xl bg-indigo-50/70 space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {AVATARS.map((a) => (
          <button
            key={a}
            onClick={() => setAvatar(a)}
            className={`text-xl w-9 h-9 rounded-full flex items-center justify-center transition ${
              avatar === a ? "bg-indigo-500 scale-110 shadow" : "bg-white hover:bg-indigo-100"
            }`}
          >
            {a}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          autoFocus
          className="border-2 border-indigo-100 focus:border-indigo-400 outline-none rounded-xl px-3 py-2 text-sm flex-1"
          placeholder="Child's name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button onClick={add} className="bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white rounded-xl px-4 text-sm font-bold">
          Add
        </button>
      </div>
      <input
        className="w-full border-2 border-indigo-100 focus:border-indigo-400 outline-none rounded-xl px-3 py-2 text-sm tracking-widest text-center"
        placeholder="4-digit PIN (optional, defaults to 0000)"
        maxLength={4}
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
        onKeyDown={(e) => e.key === "Enter" && add()}
      />
      {err && <p className="text-xs text-rose-600 font-medium">{err}</p>}
    </div>
  );
}
