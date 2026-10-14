// Mirrors rebalance_child_chores() in schema.sql so the parent's screen can
// preview values instantly. Keep in sync with the SQL.
export function splitBudget(budgetPence, chores) {
  const active = chores.filter((c) => c.active !== false);
  const customTotal = active.filter((c) => c.custom_value).reduce((s, c) => s + c.value_pence * c.times_per_week, 0);
  const autoSlots = active.filter((c) => !c.custom_value).reduce((s, c) => s + c.times_per_week, 0);
  const perAuto = autoSlots > 0 ? Math.max(Math.floor((budgetPence - customTotal) / autoSlots), 1) : 1;
  const planned = customTotal + perAuto * autoSlots;
  return {
    perAuto,
    customTotal,
    autoSlots,
    planned, // what the week would pay if every chore were completed
    overBudget: budgetPence > 0 && customTotal > budgetPence,
    unfunded: budgetPence === 0 && active.length > 0,
  };
}

export function weeklyValue(chore) {
  return chore.value_pence * chore.times_per_week;
}
