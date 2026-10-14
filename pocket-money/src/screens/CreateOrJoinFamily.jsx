import { useState } from "react";
import { Card, Centered, BrandHeader, Button, Input, ErrorText } from "../components/ui";
import { LegalFooter } from "../components/LegalFooter";
import { useCreateFamily, useRedeemFamilyInvite } from "../hooks/useFamily";

export function CreateOrJoinFamily() {
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [err, setErr] = useState("");
  const createFamily = useCreateFamily();
  const redeemInvite = useRedeemFamilyInvite();

  const run = async (fn) => {
    setErr("");
    try {
      await fn();
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <Centered>
      <Card className="max-w-sm p-7 space-y-6">
        <BrandHeader subtitle="Set up your household to get started." />
        <div className="space-y-3">
          <Input label="Family name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. The Lynns" />
          <Button size="lg" className="w-full" disabled={!name.trim() || createFamily.isPending} onClick={() => run(() => createFamily.mutateAsync(name.trim()))}>
            Create family
          </Button>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-semibold tracking-[0.18em] text-ink-muted">
          <div className="h-px flex-1 bg-line" /> OR <div className="h-px flex-1 bg-line" />
        </div>
        <div className="space-y-3">
          <Input
            label="Join with an invite code"
            className="uppercase tracking-[0.3em] text-center font-semibold"
            maxLength={6}
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="ABC123"
          />
          <p className="text-[12px] text-ink-muted -mt-1">Ask the other parent for the 6-character code from their app.</p>
          <Button variant="secondary" size="lg" className="w-full" disabled={joinCode.trim().length < 6 || redeemInvite.isPending} onClick={() => run(() => redeemInvite.mutateAsync(joinCode.trim()))}>
            Join as co-parent
          </Button>
        </div>
        <ErrorText>{err}</ErrorText>
      </Card>
      <LegalFooter />
    </Centered>
  );
}
