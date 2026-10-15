import { useState } from "react";
import { Plus, X, Pencil, Check } from "lucide-react";
import { useMoney } from "../../hooks/useCurrency";
import { useAddChore, useUpdateChore, useRemoveChore } from "../../hooks/useChores";
import { splitBudget } from "../../lib/budget";
import { themeColor } from "../../lib/theme";
import { Card, Button, Input, Select, IconCircle, Progress, Empty, ErrorText } from "../ui";
import { ChildAvatar } from "./ChildAvatar";
import { BudgetEditor } from "./BudgetEditor";

const CHORE_ICONS = ["⭐", "🧹", "🍽️", "🛏️", "🧺", "📚", "🐕", "🌱", "🚮", "🧼", "🚲", "🎒"];
const TIMES = Array.from({ length: 14 }, (_, i) => i + 1);

const toPence = (s) => Math.round(parseFloat(s || "0") * 100) || 0;
const toPounds = (p) => ((p || 0) / 100).toFixed(2);

export function ChildChoresCard({ kid, familyId, chores, weekClaims }) {
  const money = useMoney();
  const color = themeColor(kid.theme, kid.name);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const split = splitBudget(kid.weekly_budget_pence, chores);
  const completions = chores.reduce((s, c) => s + c.times_per_week, 0);
  const earned = weekClaims
    .filter((c) => c.status === "approved")
    .reduce((s, c) => s + (c.chores?.value_pence || 0), 0);
  const doneCount = weekClaims.filter((c) => c.status === "approved").length;
  const budget = kid.weekly_budget_pence;

  return (
    <Card className="p-4" accent={color.main}>
      <div className="flex items-center gap-3">
        <ChildAvatar kid={kid} size={44} />
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold text-ink truncate">{kid.name}</div>
          <div className="text-[12.5px] text-ink-muted">
            {chores.length} {chores.length === 1 ? "chore" : "chores"} · {completions} completions a week
          </div>
        </div>
        <BudgetEditor kid={kid} />
      </div>

      <div className="mt-4 rounded-xl bg-surface p-3">
        <div className="flex items-baseline justify-between text-[12.5px]">
          <span className="text-ink-muted">Earned this week</span>
          <span className="font-semibold text-ink tabular-nums">
            {money(earned)} <span className="text-ink-muted font-normal">of {money(budget)}</span>
          </span>
        </div>
        <div className="mt-2">
          <Progress value={budget > 0 ? (earned / budget) * 100 : 0} color={color.main} />
        </div>
        <div className="mt-1.5 text-[11.5px] text-ink-muted">
          {doneCount} of {completions} completions approved
        </div>
      </div>

      {split.unfunded && (
        <p className="mt-3 text-[12.5px] font-medium text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
          Set a weekly amount above and it'll be split across these chores automatically.
        </p>
      )}
      {split.overBudget && (
        <p className="mt-3 text-[12.5px] font-medium text-rose-700 bg-rose-50 rounded-lg px-3 py-2">
          The custom amounts add up to more than {money(budget)} a week.
        </p>
      )}
      {!split.unfunded && !split.overBudget && split.planned !== budget && budget > 0 && (
        <p className="mt-3 text-[12px] text-ink-muted px-1">
          Rounding leaves {money(budget - split.planned)} unassigned this week.
        </p>
      )}

      <div className="mt-3">
        {chores.map((c) =>
          editingId === c.id ? (
            <ChoreEditor key={c.id} chore={c} onClose={() => setEditingId(null)} />
          ) : (
            <ChoreRow key={c.id} chore={c} onEdit={() => setEditingId(c.id)} />
          )
        )}
        {chores.length === 0 && !adding && <Empty>No chores yet for {kid.name}.</Empty>}
      </div>

      {adding ? (
        <AddChore kid={kid} familyId={familyId} onClose={() => setAdding(false)} />
      ) : (
        <Button variant="secondary" className="w-full mt-3" onClick={() => setAdding(true)}>
          <Plus size={16} /> Add a chore for {kid.name}
        </Button>
      )}
    </Card>
  );
}

function ChoreRow({ chore, onEdit }) {
  const money = useMoney();
  return (
    <button onClick={onEdit} className="w-full flex items-center gap-3 py-2.5 border-b border-line last:border-0 text-left">
      <IconCircle tone="amber" size={38}>{chore.icon}</IconCircle>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-medium text-ink truncate">{chore.name}</div>
        <div className="text-[12px] text-ink-muted">
          {chore.times_per_week}× a week · {chore.custom_value ? "custom amount" : "auto split"}
        </div>
      </div>
      <div className="text-right">
        <div className="text-[14px] font-semibold tabular-nums text-ink">{money(chore.value_pence)}</div>
        <div className="text-[11px] text-ink-muted">each</div>
      </div>
      <Pencil size={15} className="text-ink-muted" />
    </button>
  );
}

function ChoreEditor({ chore, onClose }) {
  const [times, setTimes] = useState(chore.times_per_week);
  const [custom, setCustom] = useState(chore.custom_value);
  const [amount, setAmount] = useState(toPounds(chore.value_pence));
  const [err, setErr] = useState("");
  const update = useUpdateChore();
  const remove = useRemoveChore();

  const save = async () => {
    setErr("");
    const pence = toPence(amount);
    if (custom && pence < 1) return setErr("Enter an amount of at least 1p.");
    try {
      await update.mutateAsync({
        choreId: chore.id,
        patch: { times_per_week: times, custom_value: custom, ...(custom ? { value_pence: pence } : {}) },
      });
      onClose();
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <div className="rounded-xl bg-surface p-3 my-2 space-y-3">
      <div className="flex items-center gap-3">
        <IconCircle tone="amber" size={38}>{chore.icon}</IconCircle>
        <div className="flex-1 text-[14px] font-semibold text-ink">{chore.name}</div>
        <button onClick={onClose} aria-label="Close" className="h-8 w-8 rounded-full text-ink-muted hover:bg-white flex items-center justify-center"><X size={15} /></button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Select label="Times a week" value={times} onChange={(e) => setTimes(Number(e.target.value))}>
          {TIMES.map((n) => <option key={n} value={n}>{n}×</option>)}
        </Select>
        <Select label="Amount" value={custom ? "custom" : "auto"} onChange={(e) => setCustom(e.target.value === "custom")}>
          <option value="auto">Auto split</option>
          <option value="custom">Custom</option>
        </Select>
      </div>
      {custom && (
        <Input label="Amount each time" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0.25" />
      )}
      <ErrorText>{err}</ErrorText>
      <div className="flex gap-2">
        <Button size="sm" className="flex-1" onClick={save} disabled={update.isPending}><Check size={15} /> Save</Button>
        <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50" onClick={() => remove.mutate(chore.id, { onSuccess: onClose })} disabled={remove.isPending}>
          Remove
        </Button>
      </div>
    </div>
  );
}

function AddChore({ kid, familyId, onClose }) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(CHORE_ICONS[0]);
  const [times, setTimes] = useState(1);
  const [custom, setCustom] = useState(false);
  const [amount, setAmount] = useState("");
  const [err, setErr] = useState("");
  const add = useAddChore();

  const save = async () => {
    setErr("");
    if (!name.trim()) return setErr("Give the chore a name.");
    const pence = toPence(amount);
    if (custom && pence < 1) return setErr("Enter an amount of at least 1p.");
    try {
      await add.mutateAsync({ familyId, childId: kid.id, name: name.trim(), icon, timesPerWeek: times, customValue: custom, valuePence: pence });
      onClose();
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <div className="rounded-xl bg-surface p-3 mt-3 space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {CHORE_ICONS.map((i) => (
          <button key={i} onClick={() => setIcon(i)} className={`h-9 w-9 rounded-xl flex items-center justify-center text-lg transition ${icon === i ? "bg-brand-600 ring-2 ring-brand-200" : "bg-white hover:bg-brand-50"}`}>{i}</button>
        ))}
      </div>
      <Input label="Chore" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Make bed" />
      <div className="grid grid-cols-2 gap-2">
        <Select label="Times a week" value={times} onChange={(e) => setTimes(Number(e.target.value))}>
          {TIMES.map((n) => <option key={n} value={n}>{n}×</option>)}
        </Select>
        <Select label="Amount" value={custom ? "custom" : "auto"} onChange={(e) => setCustom(e.target.value === "custom")}>
          <option value="auto">Auto split</option>
          <option value="custom">Custom</option>
        </Select>
      </div>
      {custom && (
        <Input label="Amount each time" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0.25" />
      )}
      <ErrorText>{err}</ErrorText>
      <div className="flex gap-2">
        <Button size="sm" className="flex-1" onClick={save} disabled={add.isPending}>Add chore</Button>
        <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}
