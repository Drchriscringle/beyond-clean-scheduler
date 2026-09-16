import { addDays, compareDays, daysBetween, relativeDay } from './lib/dates.js'

/**
 * Plans and objectives — the part of the dashboard that is about where you are
 * going rather than what is landing today.
 *
 * The design belief here: a list of goals you never revisit is worse than no
 * list, because it quietly converts ambition into guilt. So an objective is
 * only ever shown with the one next action attached to it, and an objective
 * that has not moved says so out loud. "Stalled" is information, not a
 * reproach — it is usually the signal that a goal needs re-scoping or
 * dropping, and either is a fine outcome.
 */

export const HORIZONS = { now: 'Now', quarter: 'This quarter', year: 'This year', someday: 'Someday' }
export const OBJECTIVE_STATES = { active: 'Active', done: 'Done', parked: 'Parked', dropped: 'Dropped' }

/** With no movement in this long, an active objective is stalled. */
const STALLED_AFTER_DAYS = 14

export function createObjective(input = {}) {
  return {
    title: input.title ?? 'Untitled objective',
    detail: input.detail ?? '',
    horizon: Object.hasOwn(HORIZONS, input.horizon) ? input.horizon : 'quarter',
    state: Object.hasOwn(OBJECTIVE_STATES, input.state) ? input.state : 'active',
    dueOn: input.dueOn ?? null,
    targetIds: input.targetIds ?? [],
    steps: (input.steps ?? []).map(normalizeStep),
    // A measurable objective can carry a number; both ends are optional.
    metric: input.metric
      ? { name: input.metric.name ?? '', start: num(input.metric.start), current: num(input.metric.current), goal: num(input.metric.goal), unit: input.metric.unit ?? '' }
      : null,
    lastMovedAt: input.lastMovedAt ?? new Date().toISOString(),
  }
}

function normalizeStep(step, index) {
  return {
    id: step.id ?? `step-${index + 1}`,
    title: step.title ?? '',
    done: Boolean(step.done),
    dueOn: step.dueOn ?? null,
    doneAt: step.doneAt ?? null,
  }
}

function num(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Progress, by whichever measure the objective actually has.
 *
 * A metric beats counting steps: "12 of 20 clients" says more than "3 of 5
 * tasks ticked", and tasks are a proxy people game without meaning to.
 */
export function progressOf(objective) {
  const metric = objective.metric
  if (metric && metric.goal !== null && metric.current !== null) {
    const start = metric.start ?? 0
    const span = metric.goal - start
    if (span !== 0) {
      const fraction = (metric.current - start) / span
      return { kind: 'metric', fraction: clamp(fraction), label: `${format(metric.current)}${metric.unit} of ${format(metric.goal)}${metric.unit}` }
    }
  }

  const steps = objective.steps ?? []
  if (steps.length > 0) {
    const done = steps.filter((step) => step.done).length
    return { kind: 'steps', fraction: clamp(done / steps.length), label: `${done} of ${steps.length} steps` }
  }
  return { kind: 'none', fraction: objective.state === 'done' ? 1 : 0, label: null }
}

const clamp = (value) => Math.max(0, Math.min(1, value))
const format = (value) => (Number.isInteger(value) ? String(value) : value.toFixed(1))

/** The next thing to actually do: the first unfinished step, soonest due first. */
export function nextStep(objective) {
  const open = (objective.steps ?? []).filter((step) => !step.done)
  if (open.length === 0) return null
  const dated = open.filter((step) => step.dueOn).sort((a, b) => compareDays(a.dueOn, b.dueOn))
  return dated[0] ?? open[0]
}

export function daysSinceMoved(objective, today) {
  if (!objective.lastMovedAt) return null
  const movedOn = String(objective.lastMovedAt).slice(0, 10)
  return daysBetween(movedOn, today)
}

/**
 * Reviews every objective and says what state it is really in — which is the
 * bit a plain list never tells you.
 */
export function review(objectives, today, { stalledAfterDays = STALLED_AFTER_DAYS } = {}) {
  const entries = objectives.map((objective) => {
    const progress = progressOf(objective)
    const step = nextStep(objective)
    const idle = daysSinceMoved(objective, today)
    const active = objective.state === 'active'

    const overdue = active && objective.dueOn && objective.dueOn < today
    const dueSoon = active && objective.dueOn && !overdue && objective.dueOn <= addDays(today, 14)
    const stalled = active && !overdue && idle !== null && idle >= stalledAfterDays

    return {
      ...objective,
      progress,
      nextStep: step,
      idleDays: idle,
      overdue: Boolean(overdue),
      dueSoon: Boolean(dueSoon),
      stalled: Boolean(stalled),
      dueLabel: objective.dueOn ? relativeDay(objective.dueOn, today) : null,
      // A step due today or overdue is the objective's claim on today.
      stepDueNow: Boolean(step?.dueOn && step.dueOn <= today),
    }
  })

  return {
    all: entries,
    active: entries.filter((entry) => entry.state === 'active'),
    overdue: entries.filter((entry) => entry.overdue),
    dueSoon: entries.filter((entry) => entry.dueSoon),
    stalled: entries.filter((entry) => entry.stalled),
    onToday: entries.filter((entry) => entry.stepDueNow && entry.state === 'active'),
    done: entries.filter((entry) => entry.state === 'done'),
  }
}

/**
 * Records that an objective moved. Called whenever a step is ticked or a
 * metric updated, so "stalled" reflects real movement rather than edits.
 */
export function touch(objective, at = new Date()) {
  return { ...objective, lastMovedAt: at.toISOString() }
}

/** Ticks a step and stamps the objective as moved. */
export function completeStep(objective, stepId, done = true, at = new Date()) {
  const steps = (objective.steps ?? []).map((step) =>
    step.id === stepId ? { ...step, done, doneAt: done ? at.toISOString() : null } : step,
  )
  const changed = steps.some((step, index) => step.done !== (objective.steps ?? [])[index]?.done)
  const updated = { ...objective, steps }
  return changed ? touch(updated, at) : updated
}
