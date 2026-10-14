import { useState } from "react";
import { Centered, Card, BrandHeader, BigButton, primaryBtn } from "../components/common";
import { LegalFooter } from "../components/LegalFooter";
import { useCreateFamily, useRedeemFamilyInvite } from "../hooks/useFamily";

export function CreateOrJoinFamily() {
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [err, setErr] = useState("");
  const createFamily = useCreateFamily();
  const redeemInvite = useRedeemFamilyInvite();

  const create = async () => {
    setErr("");
    try {
      await createFamily.mutateAsync(name.trim());
    } catch (e) {
      setErr(e.message);
    }
  };

  const join = async () => {
    setErr("");
    try {
      await redeemInvite.mutateAsync(joinCode.trim());
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <Centered>
      <Card>
        <BrandHeader />
        <div className="space-y-2">
          <h2 className="font-display font-bold text-slate-700">🏠 Start a family</h2>
          <input
            className="w-full border-2 border-indigo-100 focus:border-indigo-400 outline-none rounded-2xl px-4 py-3 transition"
            placeholder="Family name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <BigButton onClick={create} className={primaryBtn}>
            Create
          </BigButton>
        </div>
        <div className="flex items-center gap-3 text-xs font-semibold text-slate-400">
          <div className="h-px flex-1 bg-slate-200" />
          OR
          <div className="h-px flex-1 bg-slate-200" />
        </div>
        <div className="space-y-2">
          <h2 className="font-display font-bold text-slate-700">🔑 Join as co-parent</h2>
          <input
            className="w-full border-2 border-indigo-100 focus:border-indigo-400 outline-none rounded-2xl px-4 py-3 transition uppercase tracking-widest text-center font-display font-bold"
            placeholder="Invite code"
            maxLength={6}
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
          />
          <p className="text-xs text-slate-400 text-center">Ask the other parent for the 6-character code from their app.</p>
          <BigButton onClick={join} className="bg-white border-2 border-indigo-200 text-indigo-600">
            Join
          </BigButton>
        </div>
        {err && <p className="text-sm text-rose-600 font-medium">{err}</p>}
      </Card>
      <LegalFooter />
    </Centered>
  );
}
