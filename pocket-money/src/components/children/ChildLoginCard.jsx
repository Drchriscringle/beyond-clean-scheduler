import { useState } from "react";
import { Eye, EyeOff, Smartphone, LogOut, Check, KeyRound, AtSign, Pencil } from "lucide-react";
import { useChildDevices, useRevokeChildDevice, useUpdateChildUsername, useUpdateChildPin, useRevealChildPin, useRenameChild } from "../../hooks/useChildDevice";
import { normaliseUsername } from "../../lib/api/children";
import { Button, Input, ErrorText } from "../ui";

const APP_HOST = typeof window !== "undefined" ? window.location.host : "pocket-money-family.netlify.app";

// Parent-side: the child's sign-in details for their own device — their
// username, their PIN (hidden until you ask), and which devices are signed in.
export function ChildLoginCard({ kid }) {
  return (
    <div className="rounded-xl bg-surface p-3 space-y-4">
      <p className="text-[12.5px] text-ink-muted leading-relaxed">
        On {kid.name}'s phone or tablet, open <strong className="text-ink">{APP_HOST}/child</strong> and sign in with these details. They'll see their chores, jars and your messages — nothing else.
      </p>
      <NameRow kid={kid} />
      <UsernameRow kid={kid} />
      <PinRow kid={kid} />
      <Devices kid={kid} />
    </div>
  );
}

function FieldLabel({ icon, children }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.14em] uppercase text-ink-muted mb-1.5">
      {icon} {children}
    </div>
  );
}

function NameRow({ kid }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(kid.name);
  const rename = useRenameChild();
  if (!editing) {
    return (
      <div>
        <FieldLabel icon={<Pencil size={12} />}>Name</FieldLabel>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[15px] font-semibold text-ink">{kid.name}</span>
          <Button size="sm" variant="ghost" onClick={() => { setName(kid.name); setEditing(true); }}>Rename</Button>
        </div>
      </div>
    );
  }
  return (
    <div>
      <FieldLabel icon={<Pencil size={12} />}>Name</FieldLabel>
      <div className="flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} className="h-10" autoFocus />
        <Button size="sm" className="h-10" disabled={!name.trim() || rename.isPending} onClick={() => rename.mutate({ childId: kid.id, name }, { onSuccess: () => setEditing(false) })}>
          <Check size={15} /> Save
        </Button>
      </div>
    </div>
  );
}

function UsernameRow({ kid }) {
  const [value, setValue] = useState(kid.username || "");
  const [err, setErr] = useState("");
  const update = useUpdateChildUsername();
  const dirty = normaliseUsername(value) !== (kid.username || "");

  const save = () => {
    setErr("");
    update.mutate({ childId: kid.id, username: value }, { onError: (e) => setErr(e.message), onSuccess: (v) => setValue(v || "") });
  };

  return (
    <div>
      <FieldLabel icon={<AtSign size={12} />}>Username</FieldLabel>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && dirty && save()}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder={`e.g. ${normaliseUsername(kid.name).slice(0, 12) || "ella"}-${String(new Date().getFullYear()).slice(2)}`}
          className="h-10"
        />
        <Button size="sm" className="h-10" disabled={!dirty || update.isPending} onClick={save}>
          <Check size={15} /> Save
        </Button>
      </div>
      <p className="text-[11.5px] text-ink-muted mt-1">
        {kid.username ? "Lower-case letters, numbers, - or _." : "Set a username so they can sign in on their own device."}
      </p>
      <ErrorText>{err}</ErrorText>
    </div>
  );
}

function PinRow({ kid }) {
  const [shown, setShown] = useState(null); // the revealed PIN
  const [changing, setChanging] = useState(false);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const reveal = useRevealChildPin();
  const update = useUpdateChildPin();

  const toggle = () => {
    if (shown) return setShown(null);
    reveal.mutate(kid.id, { onSuccess: setShown, onError: (e) => setErr(e.message) });
  };

  const save = () => {
    setErr("");
    update.mutate(
      { childId: kid.id, pin },
      {
        onSuccess: () => {
          setShown(pin);
          setChanging(false);
          setPin("");
        },
        onError: (e) => setErr(e.message),
      }
    );
  };

  return (
    <div>
      <FieldLabel icon={<KeyRound size={12} />}>PIN</FieldLabel>
      {!changing ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[20px] font-bold tabular-nums tracking-[0.3em] text-ink">{shown || "••••"}</span>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={toggle} disabled={reveal.isPending}>
              {shown ? <EyeOff size={15} /> : <Eye size={15} />} {shown ? "Hide" : "Show"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setChanging(true)}>Change</Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input
            inputMode="numeric"
            maxLength={4}
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && pin.length === 4 && save()}
            placeholder="New 4-digit PIN"
            className="h-10"
          />
          <Button size="sm" className="h-10" disabled={pin.length !== 4 || update.isPending} onClick={save}><Check size={15} /> Save</Button>
          <Button size="sm" variant="ghost" className="h-10" onClick={() => { setChanging(false); setPin(""); }}>Cancel</Button>
        </div>
      )}
      <ErrorText>{err}</ErrorText>
    </div>
  );
}

function Devices({ kid }) {
  const { data: devices = [] } = useChildDevices();
  const revoke = useRevokeChildDevice();
  const mine = devices.filter((d) => d.child_id === kid.id);

  return (
    <div>
      <FieldLabel icon={<Smartphone size={12} />}>Signed-in devices</FieldLabel>
      {mine.length === 0 && <p className="text-[12.5px] text-ink-muted">Not signed in anywhere yet.</p>}
      {mine.map((d) => (
        <div key={d.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-line last:border-0">
          <div className="min-w-0">
            <div className="text-[13.5px] font-medium text-ink truncate">{d.label || "Device"}</div>
            <div className="text-[11.5px] text-ink-muted">Last used {timeAgo(d.last_seen_at)}</div>
          </div>
          <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50" onClick={() => revoke.mutate(d.id)} disabled={revoke.isPending}>
            <LogOut size={14} /> Sign out
          </Button>
        </div>
      ))}
    </div>
  );
}

function timeAgo(iso) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}
