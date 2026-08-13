import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "./lib/supabaseClient";
import * as api from "./lib/api";

/*
 * Reference wiring for Pocket Ledger on Supabase.
 * This intentionally keeps styling minimal — drop your existing
 * Baloo 2 / bright-jars UI from the prototype around these same
 * calls. The point of this file is the DATA FLOW, not the visuals.
 */

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

  if (loading) return <Centered>Loading…</Centered>;
  if (!session) return <AuthGate />;
  if (!family) return <CreateOrJoinFamily onDone={setFamily} />;
  return <FamilyDashboard family={family} />;
}

function Centered({ children }) {
  return <div className="min-h-screen flex items-center justify-center text-slate-500">{children}</div>;
}

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
      <div className="w-full max-w-sm space-y-3 bg-white p-6 rounded-2xl shadow border">
        <h1 className="text-xl font-bold">Pocket Ledger</h1>
        <input className="w-full border rounded-lg px-3 py-2" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="w-full border rounded-lg px-3 py-2" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button disabled={busy} onClick={submit} className="w-full bg-indigo-600 text-white rounded-lg py-2 font-semibold">
          {mode === "signup" ? "Create account" : "Sign in"}
        </button>
        <button className="text-sm text-slate-500 underline" onClick={() => setMode(mode === "signup" ? "signin" : "signup")}>
          {mode === "signup" ? "Already have an account? Sign in" : "New parent? Create an account"}
        </button>
      </div>
    </Centered>
  );
}

function CreateOrJoinFamily({ onDone }) {
  const [name, setName] = useState("");
  const [joinId, setJoinId] = useState("");
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
      await api.joinFamilyAsCoParent(joinId.trim());
      onDone(await api.getMyFamily());
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <Centered>
      <div className="w-full max-w-sm space-y-4 bg-white p-6 rounded-2xl shadow border">
        <div className="space-y-2">
          <h2 className="font-semibold">Start a family</h2>
          <input className="w-full border rounded-lg px-3 py-2" placeholder="Family name" value={name} onChange={(e) => setName(e.target.value)} />
          <button onClick={create} className="w-full bg-indigo-600 text-white rounded-lg py-2 font-semibold">Create</button>
        </div>
        <div className="space-y-2 pt-3 border-t">
          <h2 className="font-semibold">Join as co-parent</h2>
          <input className="w-full border rounded-lg px-3 py-2" placeholder="Family ID (from other parent)" value={joinId} onChange={(e) => setJoinId(e.target.value)} />
          <button onClick={join} className="w-full bg-white border rounded-lg py-2 font-semibold">Join</button>
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
      </div>
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
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <header className="flex justify-between items-center">
        <h1 className="text-lg font-bold">{family.name}</h1>
        <button onClick={() => api.signOut()} className="text-sm text-slate-500 underline">Sign out</button>
      </header>

      <section>
        <h2 className="font-semibold mb-2">Children</h2>
        <div className="grid grid-cols-2 gap-2">
          {children.map((kid) => (
            <div key={kid.id} className="border rounded-xl p-3 bg-white">
              <div className="font-medium">{kid.avatar} {kid.name}</div>
              <div className="text-lg font-bold text-emerald-600">
                {((balances[kid.id]?.total_pence || 0) / 100).toFixed(2)} total
              </div>
              <div className="text-xs text-slate-500">
                save {balances[kid.id]?.save_pence ?? 0}p · spend {balances[kid.id]?.spend_pence ?? 0}p · give {balances[kid.id]?.give_pence ?? 0}p
              </div>
            </div>
          ))}
        </div>
        <AddChildForm familyId={family.id} onAdded={refreshAll} />
      </section>

      <section>
        <h2 className="font-semibold mb-2">Awaiting approval ({pending.length})</h2>
        <div className="space-y-2">
          {pending.map((claim) => (
            <div key={claim.id} className="border rounded-xl p-3 bg-white flex items-center gap-3">
              <span>{claim.children.avatar}</span>
              <div className="flex-1">
                <div className="text-sm font-medium">{claim.children.name} · {claim.chores.name}</div>
                <div className="text-xs text-slate-500">{claim.chores.value_pence}p</div>
              </div>
              <button onClick={() => api.decideClaim(claim.id, true).then(refreshAll)} className="bg-emerald-500 text-white rounded-full px-3 py-1 text-sm">Approve</button>
              <button onClick={() => api.decideClaim(claim.id, false).then(refreshAll)} className="bg-slate-200 rounded-full px-3 py-1 text-sm">Decline</button>
            </div>
          ))}
          {pending.length === 0 && <p className="text-sm text-slate-400 italic">Nothing waiting.</p>}
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-2">Chores</h2>
        <div className="space-y-1">
          {chores.map((c) => (
            <div key={c.id} className="border rounded-lg px-3 py-2 bg-white flex items-center gap-2">
              <span>{c.icon}</span>
              <span className="flex-1 text-sm">{c.name}</span>
              <span className="text-sm font-semibold">{c.value_pence}p</span>
              <button onClick={() => api.removeChore(c.id).then(refreshAll)} className="text-slate-400 text-sm">✕</button>
            </div>
          ))}
        </div>
        <AddChoreForm onAdded={refreshAll} />
      </section>

      <section>
        <h2 className="font-semibold mb-2">Claim a chore (child mode demo)</h2>
        <p className="text-xs text-slate-500 mb-2">In the full UI this lives behind the child PIN toggle.</p>
        <div className="flex flex-wrap gap-2">
          {chores.map((c) =>
            children.map((kid) => (
              <button
                key={c.id + kid.id}
                onClick={() => api.claimChore(c.id, kid.id, family.id).then(refreshAll)}
                className="text-xs border rounded-full px-2 py-1 bg-white"
              >
                {kid.avatar} did "{c.name}"
              </button>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function AddChildForm({ onAdded }) {
  const [name, setName] = useState("");
  const add = async () => {
    if (!name.trim()) return;
    await api.addChild({ name: name.trim(), avatar: "🙂" });
    setName("");
    onAdded();
  };
  return (
    <div className="flex gap-2 mt-2">
      <input className="border rounded-lg px-2 py-1 text-sm flex-1" placeholder="Child's name" value={name} onChange={(e) => setName(e.target.value)} />
      <button onClick={add} className="bg-indigo-600 text-white rounded-lg px-3 text-sm">Add</button>
    </div>
  );
}

function AddChoreForm({ onAdded }) {
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const add = async () => {
    const pence = parseInt(value, 10);
    if (!name.trim() || !pence) return;
    await api.addChore({ name: name.trim(), icon: "⭐", value_pence: pence });
    setName("");
    setValue("");
    onAdded();
  };
  return (
    <div className="flex gap-2 mt-2">
      <input className="border rounded-lg px-2 py-1 text-sm flex-1" placeholder="Chore name" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="border rounded-lg px-2 py-1 text-sm w-16" placeholder="p" value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))} />
      <button onClick={add} className="bg-indigo-600 text-white rounded-lg px-3 text-sm">Add</button>
    </div>
  );
}
