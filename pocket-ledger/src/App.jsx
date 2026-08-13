import React, { useEffect, useState, useCallback } from "react";
import { Check, X, LogOut, Copy, CopyCheck, Plus } from "lucide-react";
import { supabase } from "./lib/supabaseClient";
import * as api from "./lib/api";

const money = (pence) => `£${((pence || 0) / 100).toFixed(2)}`;

const AVATARS = ["🙂", "🐶", "🐱", "🦊", "🐵", "🦄", "🐸", "🐼", "🐧", "🦁"];
const CHORE_ICONS = ["⭐", "🧹", "🍽️", "🛏️", "🧺", "📚", "🐕", "🌱", "🚮", "🧼"];

export default function App() {
  const [session, setSession] = useState(null);
  const [family, setFamily] = useState(null); // { id, name, role }
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const sub = api.onAuthChange(setSession);
    return () => sub.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setFamily(null);
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      const f = await api.getMyFamily();
      setFamily(f);
      setLoading(false);
    })();
  }, [session]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <BackgroundBlobs />
      <div className="relative">
        {loading && <LoadingScreen />}
        {!loading && !session && <AuthGate />}
        {!loading && session && !family && <CreateOrJoinFamily onDone={setFamily} />}
        {!loading && session && family && <FamilyDashboard family={family} />}
      </div>
    </div>
  );
}

function BackgroundBlobs() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-fuchsia-300/30 blur-3xl" />
      <div className="absolute top-1/3 -right-20 h-80 w-80 rounded-full bg-indigo-300/30 blur-3xl" />
      <div className="absolute bottom-0 left-1/4 h-72 w-72 rounded-full bg-amber-200/30 blur-3xl" />
    </div>
  );
}

function Centered({ children }) {
  return <div className="min-h-screen flex items-center justify-center p-4">{children}</div>;
}

function LoadingScreen() {
  return (
    <Centered>
      <div className="flex flex-col items-center gap-3 text-slate-500">
        <span className="text-5xl animate-bounce">🫙</span>
        <p className="font-display font-semibold">Loading…</p>
      </div>
    </Centered>
  );
}

function BrandHeader() {
  return (
    <div className="flex flex-col items-center gap-1 mb-2">
      <span className="text-5xl">🫙</span>
      <h1 className="font-display text-3xl font-extrabold bg-gradient-to-r from-indigo-600 via-fuchsia-500 to-amber-500 bg-clip-text text-transparent">
        Pocket Ledger
      </h1>
      <p className="text-sm text-slate-500">Chores turn into real, saved-up money</p>
    </div>
  );
}

function Card({ children }) {
  return (
    <div className="w-full max-w-sm space-y-4 bg-white/90 backdrop-blur p-7 rounded-[2rem] shadow-xl shadow-indigo-100 border border-white">
      {children}
    </div>
  );
}

function BigButton({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`w-full font-display font-bold rounded-2xl py-3 shadow-md active:scale-[0.98] transition disabled:opacity-50 disabled:active:scale-100 ${className}`}
    >
      {children}
    </button>
  );
}

const primaryBtn =
  "bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white hover:brightness-105";

/* ---------------- auth ---------------- */

function AuthGate() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("signin"); // signin | signup
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr("");
    setBusy(true);
    try {
      if (mode === "signup") await api.signUp(email, password);
      else await api.signIn(email, password);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Centered>
      <Card>
        <BrandHeader />
        <div className="space-y-3">
          <input
            className="w-full border-2 border-indigo-100 focus:border-indigo-400 outline-none rounded-2xl px-4 py-3 transition"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="w-full border-2 border-indigo-100 focus:border-indigo-400 outline-none rounded-2xl px-4 py-3 transition"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {err && <p className="text-sm text-rose-600 font-medium">{err}</p>}
        <BigButton disabled={busy} onClick={submit} className={primaryBtn}>
          {mode === "signup" ? "Create account" : "Sign in"}
        </BigButton>
        <button
          className="w-full text-sm text-slate-500 font-medium hover:text-indigo-600 transition"
          onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
        >
          {mode === "signup" ? "Already have an account? Sign in" : "New parent? Create an account"}
        </button>
      </Card>
    </Centered>
  );
}

function CreateOrJoinFamily({ onDone }) {
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [err, setErr] = useState("");

  const create = async () => {
    try {
      await api.createFamily(name.trim());
      onDone(await api.getMyFamily());
    } catch (e) {
      setErr(e.message);
    }
  };

  const join = async () => {
    try {
      await api.redeemFamilyInvite(joinCode.trim());
      onDone(await api.getMyFamily());
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
    </Centered>
  );
}

/* ---------------- dashboard ---------------- */

function FamilyDashboard({ family }) {
  const [children, setChildren] = useState([]);
  const [chores, setChores] = useState([]);
  const [pending, setPending] = useState([]);
  const [balances, setBalances] = useState({}); // childId -> balance row

  const refreshAll = useCallback(async () => {
    const [c, ch, p] = await Promise.all([api.listChildren(), api.listChores(), api.listPendingClaims()]);
    setChildren(c);
    setChores(ch);
    setPending(p);
    const balPairs = await Promise.all(c.map(async (kid) => [kid.id, await api.getChildBalance(kid.id)]));
    setBalances(Object.fromEntries(balPairs));
  }, []);

  useEffect(() => {
    refreshAll();
    // live updates when a child claims a chore on another device
    const unsubscribe = api.subscribeToClaims(family.id, refreshAll);
    return unsubscribe;
  }, [family.id, refreshAll]);

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-8 pb-16">
      <DashboardHeader family={family} />

      <Section title="Children" emoji="👨‍👩‍👧‍👦">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {children.map((kid) => (
            <ChildCard key={kid.id} kid={kid} balance={balances[kid.id]} />
          ))}
        </div>
        <AddChildForm familyId={family.id} onAdded={refreshAll} />
      </Section>

      <Section title="Awaiting approval" emoji="✅" badge={pending.length}>
        <div className="space-y-2">
          {pending.map((claim) => (
            <ClaimRow key={claim.id} claim={claim} onDecided={refreshAll} />
          ))}
          {pending.length === 0 && (
            <p className="text-sm text-slate-400 italic py-2">Nothing waiting. 🎉</p>
          )}
        </div>
      </Section>

      <Section title="Chores" emoji="⭐">
        <div className="flex flex-wrap gap-2">
          {chores.map((c) => (
            <ChoreChip key={c.id} chore={c} onRemoved={refreshAll} />
          ))}
        </div>
        <AddChoreForm familyId={family.id} onAdded={refreshAll} />
      </Section>

      <Section title="Claim a chore" emoji="🙋" subtitle="Child-mode demo — lives behind the PIN toggle in the full app.">
        <div className="flex flex-wrap gap-2">
          {chores.map((c) =>
            children.map((kid) => (
              <button
                key={c.id + kid.id}
                onClick={() => api.claimChore(c.id, kid.id, family.id).then(refreshAll)}
                className="flex items-center gap-1.5 text-sm font-semibold rounded-full pl-1.5 pr-3 py-1.5 bg-white border-2 border-amber-200 hover:border-amber-400 hover:bg-amber-50 transition shadow-sm"
              >
                <span className="text-lg">{kid.avatar}</span>
                {kid.name} did {c.icon} {c.name}
              </button>
            ))
          )}
          {(chores.length === 0 || children.length === 0) && (
            <p className="text-sm text-slate-400 italic py-2">Add a child and a chore to try this.</p>
          )}
        </div>
      </Section>
    </div>
  );
}

function DashboardHeader({ family }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 pt-2">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-slate-800">🫙 {family.name}</h1>
        <InviteCoParent />
      </div>
      <button
        onClick={() => api.signOut()}
        className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-rose-600 transition"
      >
        <LogOut size={16} /> Sign out
      </button>
    </header>
  );
}

function InviteCoParent() {
  const [invite, setInvite] = useState(null); // { code, expires_at }
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const makeInvite = async () => {
    setBusy(true);
    setErr("");
    try {
      setInvite(await api.createFamilyInvite());
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(invite.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — silently ignore, code is still visible to copy manually
    }
  };

  if (!invite) {
    return (
      <button
        onClick={makeInvite}
        disabled={busy}
        className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition rounded-full px-3 py-1 disabled:opacity-50"
      >
        {busy ? "Generating…" : "👨‍👩‍👧 Invite a co-parent"}
        {err && <span className="text-rose-600">· {err}</span>}
      </button>
    );
  }

  return (
    <div className="mt-1 flex items-center gap-2 flex-wrap">
      <button
        onClick={copyCode}
        title="Share this code — it expires in 24 hours and works once"
        className="flex items-center gap-1.5 text-xs font-mono font-extrabold tracking-widest text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition rounded-full px-3 py-1"
      >
        {copied ? <CopyCheck size={13} /> : <Copy size={13} />}
        {copied ? "Copied!" : invite.code}
      </button>
      <span className="text-[11px] text-slate-400">expires in 24h · one-time use</span>
    </div>
  );
}

function Section({ title, emoji, subtitle, badge, children }) {
  return (
    <section className="bg-white/70 backdrop-blur rounded-3xl p-4 sm:p-5 shadow-sm border border-white">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="font-display font-bold text-slate-700 flex items-center gap-1.5">
          <span>{emoji}</span> {title}
        </h2>
        {typeof badge === "number" && (
          <span className="text-xs font-bold bg-fuchsia-500 text-white rounded-full h-5 min-w-5 px-1.5 flex items-center justify-center">
            {badge}
          </span>
        )}
      </div>
      {subtitle && <p className="text-xs text-slate-500 -mt-2 mb-3">{subtitle}</p>}
      {children}
    </section>
  );
}

const JAR_COLORS = {
  save: "from-emerald-400 to-emerald-300",
  spend: "from-amber-400 to-amber-300",
  give: "from-fuchsia-400 to-pink-300",
};

function Jar({ label, emoji, pence, sharePct }) {
  const fillPct = pence > 0 ? Math.max(10, Math.min(100, sharePct)) : 0;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-9 h-14 rounded-b-2xl rounded-t-md border-2 border-white bg-slate-100 shadow-inner overflow-hidden">
        <div
          className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t ${JAR_COLORS[label]} transition-all duration-500`}
          style={{ height: `${fillPct}%` }}
        />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-1 rounded-full bg-white/80" />
      </div>
      <div className="text-[10px] font-bold text-slate-500 leading-none mt-0.5">
        {emoji} {money(pence)}
      </div>
    </div>
  );
}

function ChildCard({ kid, balance }) {
  const save = balance?.save_pence ?? 0;
  const spend = balance?.spend_pence ?? 0;
  const give = balance?.give_pence ?? 0;
  const total = balance?.total_pence ?? 0;
  const shareOf = (v) => (total > 0 ? (v / total) * 100 : 0);

  return (
    <div className="rounded-2xl p-3 bg-white shadow-sm border border-slate-100 flex flex-col items-center text-center gap-1.5 hover:shadow-md transition">
      <span className="text-3xl">{kid.avatar}</span>
      <div className="font-display font-bold text-slate-800 text-sm">{kid.name}</div>
      <div className="font-display text-xl font-extrabold text-indigo-600">{money(total)}</div>
      <div className="flex gap-2 pt-1">
        <Jar label="save" emoji="💰" pence={save} sharePct={shareOf(save)} />
        <Jar label="spend" emoji="🛍️" pence={spend} sharePct={shareOf(spend)} />
        <Jar label="give" emoji="🎁" pence={give} sharePct={shareOf(give)} />
      </div>
    </div>
  );
}

function AddChildForm({ familyId, onAdded }) {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");

  const add = async () => {
    if (!name.trim()) return;
    setErr("");
    try {
      await api.addChild({ name: name.trim(), avatar, familyId });
      setName("");
      setAvatar(AVATARS[0]);
      setOpen(false);
      onAdded();
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
        <button onClick={add} className={`${primaryBtn} rounded-xl px-4 text-sm font-bold`}>
          Add
        </button>
      </div>
      {err && <p className="text-xs text-rose-600 font-medium">{err}</p>}
    </div>
  );
}

function ClaimRow({ claim, onDecided }) {
  return (
    <div className="rounded-2xl p-3 bg-white border border-slate-100 flex items-center gap-3 shadow-sm">
      <span className="text-2xl">{claim.children.avatar}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-slate-700 truncate">
          {claim.children.name} · {claim.chores.icon} {claim.chores.name}
        </div>
        <div className="text-xs text-slate-500 font-semibold">{money(claim.chores.value_pence)}</div>
      </div>
      <button
        onClick={() => api.decideClaim(claim.id, true).then(onDecided)}
        className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full px-3 py-1.5 text-sm font-bold transition"
      >
        <Check size={15} /> Approve
      </button>
      <button
        onClick={() => api.decideClaim(claim.id, false).then(onDecided)}
        className="flex items-center bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full p-1.5 transition"
      >
        <X size={15} />
      </button>
    </div>
  );
}

function ChoreChip({ chore, onRemoved }) {
  return (
    <div className="flex items-center gap-2 bg-white border border-slate-100 rounded-full pl-3 pr-1.5 py-1.5 shadow-sm">
      <span>{chore.icon}</span>
      <span className="text-sm font-semibold text-slate-700">{chore.name}</span>
      <span className="text-xs font-bold text-amber-600 bg-amber-50 rounded-full px-2 py-0.5">
        {money(chore.value_pence)}
      </span>
      <button
        onClick={() => api.removeChore(chore.id).then(onRemoved)}
        className="text-slate-300 hover:text-rose-500 transition p-1"
      >
        <X size={14} />
      </button>
    </div>
  );
}

function AddChoreForm({ familyId, onAdded }) {
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [icon, setIcon] = useState(CHORE_ICONS[0]);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");

  const add = async () => {
    const pence = parseInt(value, 10);
    if (!name.trim() || !pence) return;
    setErr("");
    try {
      await api.addChore({ name: name.trim(), icon, value_pence: pence, familyId });
      setName("");
      setValue("");
      setIcon(CHORE_ICONS[0]);
      setOpen(false);
      onAdded();
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
