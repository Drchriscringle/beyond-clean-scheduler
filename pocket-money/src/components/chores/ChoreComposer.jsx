import { useState } from "react";
import { Plus, Check, X } from "lucide-react";
import { useMoney } from "../../hooks/useCurrency";
import { useAddChore } from "../../hooks/useChores";
import { CHORE_ICON_KEYS, ChoreIcon } from "../../lib/choreIcons";
import { SCHEDULES, planningDays, effectiveTimesPerWeek } from "../../lib/schedule";
import { splitBudget } from "../../lib/budget";
import { Button, Input, Select, IconCircle, ErrorText } from "../ui";
import { ChildAvatar } from "../children/ChildAvatar";

const TIMES = Array.from({ length: 7 }, (_, i) => i + 1);
const toPence = (s) => Math.round(parseFloat(s || "0") * 100) || 0;

export function IconPicker({ value, onChange, size = 38 }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CHORE_ICON_KEYS.map((key) => {
        const on = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            aria-label={key}
            aria-pressed={on}
            className={`rounded-xl flex items-center justify-center transition ${on ? "bg-brand-600 text-white ring-4 ring-brand-100" : "bg-white text-amber-600 border border-line hover:bg-amber-50"}`}
            style={{ width: size, height: size }}
          >
            <ChoreIcon icon={key} size={Math.round(size * 0.5)} />
          </button>
        );
      })}
    </div>
  );
}

// Segmented schedule control + the follow-up (times a week, or an 8-day
// calendar). Shared by the composer and the per-chore editor.
export function ScheduleEditor({ schedule, times, dates, onChange, color = "#5b2fa8" }) {
  const days = planningDays();
  const toggleDay = (key) => onChange({ dates: dates.includes(key) ? dates.filter((d) => d !== key) : [...dates, key].sort() });
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-white border border-line p-1">
        {SCHEDULES.map((s) => {
          const on = schedule === s.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => onChange({ schedule: s.key })}
              className={`h-9 rounded-lg text-[13px] font-semibold transition ${on ? "text-white" : "text-ink-muted hover:text-ink"}`}
              style={on ? { background: color } : undefined}
            >
              {s.label}
            </button>
          );
        })}
      </div>
      <p className="text-[12px] text-ink-muted px-1">{SCHEDULES.find((s) => s.key === schedule)?.hint}</p>
      {schedule === "weekly" && (
        <Select label="Times a week" value={times} onChange={(e) => onChange({ times: Number(e.target.value) })}>
          {TIMES.map((n) => <option key={n} value={n}>{n}×</option>)}
        </Select>
      )}
      {schedule === "dates" && (
        <div>
          <div className="text-[12px] font-semibold text-ink-muted mb-1.5">Tap the days</div>
          <div className="grid grid-cols-8 gap-1">
            {days.map((d) => {
              const on = dates.includes(d.key);
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => toggleDay(d.key)}
                  aria-pressed={on}
                  aria-label={`${d.label} ${d.dayNum} ${d.month}`}
                  className={`flex flex-col items-center justify-center rounded-xl border py-1.5 transition ${on ? "text-white border-transparent" : "bg-white border-line text-ink"}`}
                  style={on ? { background: color } : undefined}
                >
                  <span className={`text-[9.5px] font-semibold uppercase tracking-wide ${on ? "text-white/80" : "text-ink-muted"}`}>{d.label.slice(0, 3)}</span>
                  <span className="text-[15px] font-bold leading-tight">{d.dayNum}</span>
                </button>
              );
            })}
          </div>
          {dates.length === 0 && <p className="text-[12px] text-amber-700 mt-1.5">Pick at least one day.</p>}
        </div>
      )}
    </div>
  );
}

// Add a chore: name + icon, who it's for, when, and how much. Pass `idea`
// to prefill from the ready-made list, `fixedChild` to skip the child
// picker, `initialDates` to start on the calendar with a day selected.
export function ChoreComposer({ familyId, kids, chores = [], idea = null, fixedChild = null, initialDates = [], onClose, onAdded }) {
  const money = useMoney();
  const add = useAddChore();
  const [name, setName] = useState(idea?.name || "");
  const [icon, setIcon] = useState(idea?.icon || "star");
  const [childIds, setChildIds] = useState(fixedChild ? [fixedChild.id] : kids[0] ? [kids[0].id] : []);
  const [schedule, setSchedule] = useState(initialDates.length ? "dates" : "weekly");
  const [times, setTimes] = useState(1);
  const [dates, setDates] = useState(initialDates);
  const [custom, setCustom] = useState(false);
  const [amount, setAmount] = useState("");
  const [err, setErr] = useState("");

  const onSchedule = (patch) => {
    if (patch.schedule !== undefined) setSchedule(patch.schedule);
    if (patch.times !== undefined) setTimes(patch.times);
    if (patch.dates !== undefined) setDates(patch.dates);
  };

  const toggleKid = (id) => setChildIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  // Live preview of what each completion would be worth for the first chosen child.
  const previewKid = kids.find((k) => k.id === childIds[0]);
  const draft = { schedule, times_per_week: times, dates, custom_value: custom, value_pence: toPence(amount), active: true };
  const preview = previewKid
    ? splitBudget(previewKid.weekly_budget_pence || 0, [...chores.filter((c) => c.child_id === previewKid.id), { ...draft, times_per_week: effectiveTimesPerWeek(draft) }])
    : null;

  const save = async () => {
    setErr("");
    if (!name.trim()) return setErr("Give the chore a name.");
    if (childIds.length === 0) return setErr("Choose who it's for.");
    if (schedule === "dates" && dates.length === 0) return setErr("Pick at least one day.");
    const pence = toPence(amount);
    if (custom && pence < 1) return setErr("Enter an amount of at least 1p.");
    try {
      for (const childId of childIds) {
        await add.mutateAsync({ familyId, childId, name: name.trim(), icon, timesPerWeek: times, customValue: custom, valuePence: pence, schedule, dates });
      }
      onAdded?.({ name: name.trim(), kids: kids.filter((k) => childIds.includes(k.id)) });
      onClose?.();
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <div className="rounded-xl bg-surface p-3 space-y-3 tip-in">
      <div className="flex items-center gap-3">
        <IconCircle tone="amber" size={44}><ChoreIcon icon={icon} size={22} /></IconCircle>
        <div className="flex-1">
          <Input autoFocus={!idea} value={name} onChange={(e) => setName(e.target.value)} placeholder="Chore name, e.g. Make bed" aria-label="Chore name" />
        </div>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close" className="h-9 w-9 rounded-full text-ink-muted hover:bg-white flex items-center justify-center"><X size={16} /></button>
        )}
      </div>

      <div>
        <div className="text-[12px] font-semibold text-ink-muted mb-1.5">Icon</div>
        <IconPicker value={icon} onChange={setIcon} size={36} />
      </div>

      {!fixedChild && (
        <div>
          <div className="text-[12px] font-semibold text-ink-muted mb-1.5">For</div>
          <div className="flex flex-wrap gap-2">
            {kids.map((k) => {
              const on = childIds.includes(k.id);
              return (
                <button key={k.id} type="button" onClick={() => toggleKid(k.id)} aria-pressed={on} className={`inline-flex items-center gap-2 rounded-full border pl-1 pr-3 h-10 text-[13px] font-semibold transition ${on ? "border-brand-400 bg-white text-brand-700 ring-4 ring-brand-100" : "border-line bg-white text-ink"}`}>
                  <ChildAvatar kid={k} size={30} /> {k.name} {on && <Check size={14} />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <div className="text-[12px] font-semibold text-ink-muted mb-1.5">When</div>
        <ScheduleEditor schedule={schedule} times={times} dates={dates} onChange={onSchedule} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Select label="Amount" value={custom ? "custom" : "auto"} onChange={(e) => setCustom(e.target.value === "custom")}>
          <option value="auto">Auto split</option>
          <option value="custom">Custom</option>
        </Select>
        {custom ? (
          <Input label="Each time" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0.25" />
        ) : (
          preview && (
            <div className="rounded-xl bg-white border border-line px-3 py-2">
              <div className="text-[11px] font-semibold text-ink-muted">Each time (approx.)</div>
              <div className="text-[16px] font-bold tabular-nums text-ink">{preview.unfunded ? "—" : money(preview.perAuto)}</div>
            </div>
          )
        )}
      </div>
      {preview?.unfunded && <p className="text-[12px] text-amber-700">Set {previewKid.name}'s weekly amount on Home and this splits automatically.</p>}

      <ErrorText>{err}</ErrorText>
      <div className="flex gap-2">
        <Button className="flex-1" onClick={save} disabled={add.isPending}>
          <Plus size={16} /> {add.isPending ? "Adding…" : childIds.length > 1 ? `Add for ${childIds.length} children` : "Add chore"}
        </Button>
        {onClose && <Button variant="ghost" onClick={onClose}>Cancel</Button>}
      </div>
    </div>
  );
}
