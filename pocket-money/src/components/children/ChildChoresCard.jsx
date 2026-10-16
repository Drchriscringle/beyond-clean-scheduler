import { useState } from "react";
import { Plus, X, Pencil, Check } from "lucide-react";
import { useMoney } from "../../hooks/useCurrency";
import { useUpdateChore, useRemoveChore } from "../../hooks/useChores";
import { splitBudget } from "../../lib/budget";
import { themeColor } from "../../lib/theme";
import { ChoreIcon } from "../../lib/choreIcons";
import { scheduleLabel } from "../../lib/schedule";
import { Card, Button, Input, Select, IconCircle, Progress, Empty, ErrorText } from "../ui";
import { ChildAvatar } from "./ChildAvatar";
import { BudgetEditor } from "./BudgetEditor";
import { ChoreComposer, IconPicker, ScheduleEditor } from "../chores/ChoreComposer";

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
    <Card className="p-4" accent={color.fill}>
      <div className="flex items-center gap-3">
        <ChildAvatar kid={kid} size={44} />
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold text-ink truncate">{kid.name}</div>
          <div className="text-[12.5px] text-ink-muted">
            {chores.length} {chores.length === 1 ? "chore" : "chores"} · {completions} completions this week
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
            <ChoreEditor key={c.id} chore={c} color={color.main} onClose={() => setEditingId(null)} />
          ) : (
            <ChoreRow key={c.id} chore={c} onEdit={() => setEditingId(c.id)} />
          )
        )}
        {chores.length === 0 && !adding && <Empty>No chores yet for {kid.name}.</Empty>}
      </div>

      {adding ? (
        <div className="mt-3">
          <ChoreComposer familyId={familyId} kids={[kid]} fixedChild={kid} chores={chores} onClose={() => setAdding(false)} />
        </div>
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
      <IconCircle tone="amber" size={38}><ChoreIcon icon={chore.icon} size={19} /></IconCircle>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-medium text-ink truncate">{chore.name}</div>
        <div className="text-[12px] text-ink-muted">
          {scheduleLabel(chore)} · {chore.custom_value ? "custom amount" : "auto split"}
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

function ChoreEditor({ chore, color, onClose }) {
  const [name, setName] = useState(chore.name);
  const [icon, setIcon] = useState(chore.icon);
  const [schedule, setSchedule] = useState(chore.schedule || "weekly");
  const [times, setTimes] = useState(chore.times_per_week);
  const [dates, setDates] = useState(chore.dates || []);
  const [custom, setCustom] = useState(chore.custom_value);
  const [amount, setAmount] = useState(toPounds(chore.value_pence));
  const [iconOpen, setIconOpen] = useState(false);
  const [err, setErr] = useState("");
  const update = useUpdateChore();
  const remove = useRemoveChore();

  const onSchedule = (patch) => {
    if (patch.schedule !== undefined) setSchedule(patch.schedule);
    if (patch.times !== undefined) setTimes(patch.times);
    if (patch.dates !== undefined) setDates(patch.dates);
  };

  const save = async () => {
    setErr("");
    const pence = toPence(amount);
    if (!name.trim()) return setErr("Give the chore a name.");
    if (custom && pence < 1) return setErr("Enter an amount of at least 1p.");
    if (schedule === "dates" && dates.length === 0) return setErr("Pick at least one day.");
    try {
      await update.mutateAsync({
        choreId: chore.id,
        patch: { name: name.trim(), icon, schedule, dates, times_per_week: times, custom_value: custom, ...(custom ? { value_pence: pence } : {}) },
      });
      onClose();
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <div className="rounded-xl bg-surface p-3 my-2 space-y-3">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setIconOpen((o) => !o)} aria-label="Change icon" className="rounded-xl ring-offset-2 focus:ring-4 focus:ring-brand-100">
          <IconCircle tone="amber" size={40}><ChoreIcon icon={icon} size={20} /></IconCircle>
        </button>
        <div className="flex-1"><Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Chore name" /></div>
        <button onClick={onClose} aria-label="Close" className="h-8 w-8 rounded-full text-ink-muted hover:bg-white flex items-center justify-center"><X size={15} /></button>
      </div>
      {iconOpen && <IconPicker value={icon} onChange={(k) => { setIcon(k); setIconOpen(false); }} size={36} />}
      <ScheduleEditor schedule={schedule} times={times} dates={dates} onChange={onSchedule} color={color} />
      <div className="grid grid-cols-2 gap-2">
        <Select label="Amount" value={custom ? "custom" : "auto"} onChange={(e) => setCustom(e.target.value === "custom")}>
          <option value="auto">Auto split</option>
          <option value="custom">Custom</option>
        </Select>
        {custom && (
          <Input label="Each time" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0.25" />
        )}
      </div>
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
