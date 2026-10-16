import { useState } from "react";
import { Plus, CalendarDays, Check } from "lucide-react";
import { useMoney } from "../../hooks/useCurrency";
import { planningDays, dueOn, dateKey } from "../../lib/schedule";
import { themeColor } from "../../lib/theme";
import { ChoreIcon } from "../../lib/choreIcons";
import { Card, IconCircle, Pill, Button } from "../ui";
import { ChildAvatar } from "../children/ChildAvatar";
import { ChoreComposer } from "./ChoreComposer";

// Today plus the next seven days. Pick a day to see what each child has on,
// and add a chore straight onto that day.
export function DayPlanner({ familyId, kids, chores, weekClaims = [] }) {
  const money = useMoney();
  const days = planningDays();
  const [selected, setSelected] = useState(days[0].key);
  const [adding, setAdding] = useState(false);
  const today = dateKey();
  const day = days.find((d) => d.key === selected) || days[0];

  const onDay = (key) => chores.filter((c) => dueOn(c, key));
  const doneOn = (chore, key) => weekClaims.some((cl) => cl.chore_id === chore.id && cl.for_day === key && cl.status !== "declined");
  const anyDay = chores.filter((c) => c.schedule === "weekly" || !c.schedule);

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-brand-600"><CalendarDays size={18} /></span>
        <h2 className="text-[15px] font-semibold text-ink">Plan the week</h2>
      </div>
      <div className="grid grid-cols-8 gap-1">
        {days.map((d) => {
          const on = d.key === selected;
          const count = onDay(d.key).length;
          return (
            <button
              key={d.key}
              onClick={() => { setSelected(d.key); setAdding(false); }}
              aria-pressed={on}
              className={`relative flex flex-col items-center rounded-xl py-1.5 transition ${on ? "bg-brand-600 text-white" : d.key === today ? "bg-brand-50 text-ink" : "bg-surface text-ink hover:bg-brand-50"}`}
            >
              <span className={`text-[9.5px] font-semibold uppercase tracking-wide ${on ? "text-white/80" : "text-ink-muted"}`}>{d.label.slice(0, 3)}</span>
              <span className="text-[15px] font-bold leading-tight">{d.dayNum}</span>
              <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${count ? (on ? "bg-white" : "bg-brand-500") : "bg-transparent"}`} />
            </button>
          );
        })}
      </div>

      <div className="mt-3 text-[13px] font-semibold text-ink">{day.label === "Today" || day.label === "Tomorrow" ? day.label : `${day.label} ${day.dayNum} ${day.month}`}</div>

      <div className="mt-2 space-y-2">
        {kids.map((kid) => {
          const list = onDay(day.key).filter((c) => c.child_id === kid.id);
          const flexible = anyDay.filter((c) => c.child_id === kid.id);
          const color = themeColor(kid.theme, kid.name);
          return (
            <div key={kid.id} className="rounded-xl bg-surface p-2.5">
              <div className="flex items-center gap-2 mb-1.5">
                <ChildAvatar kid={kid} size={26} />
                <span className="text-[13px] font-semibold text-ink">{kid.name}</span>
                <span className="text-[11.5px] text-ink-muted ml-auto">{list.length} {list.length === 1 ? "chore" : "chores"}{flexible.length ? ` · ${flexible.length} any day` : ""}</span>
              </div>
              {list.map((c) => {
                const done = doneOn(c, day.key);
                return (
                  <div key={c.id} className="flex items-center gap-2.5 py-1.5 border-t border-line/70 first:border-0">
                    <IconCircle tone={done ? "green" : "amber"} size={30}><ChoreIcon icon={c.icon} size={15} /></IconCircle>
                    <span className={`flex-1 text-[13px] font-medium ${done ? "text-ink-muted line-through" : "text-ink"}`}>{c.name}</span>
                    {done ? <Pill tone="green"><Check size={11} /> done</Pill> : <Pill tone="grey">{c.schedule === "daily" ? "daily" : money(c.value_pence)}</Pill>}
                  </div>
                );
              })}
              {list.length === 0 && (
                <p className="text-[12px] text-ink-muted py-1">
                  {flexible.length ? `Nothing fixed — ${kid.name} can pick from ${flexible.length} any-day ${flexible.length === 1 ? "chore" : "chores"}.` : "Nothing planned."}
                </p>
              )}
              <span className="sr-only" style={{ color: color.main }} />
            </div>
          );
        })}
      </div>

      {adding ? (
        <div className="mt-3">
          <ChoreComposer key={day.key} familyId={familyId} kids={kids} chores={chores} initialDates={[day.key]} onClose={() => setAdding(false)} />
        </div>
      ) : (
        <Button variant="secondary" className="w-full mt-3" onClick={() => setAdding(true)} disabled={kids.length === 0}>
          <Plus size={16} /> Add a chore for {day.label === "Today" || day.label === "Tomorrow" ? day.label.toLowerCase() : day.label}
        </Button>
      )}
    </Card>
  );
}
