// Mirrors decide_chore_claim()'s split in schema.sql exactly: save and
// spend are rounded shares of the chore's value, and give takes whatever's
// left over, so the three always sum to the full value_pence with no
// rounding drift. Keep this in sync with the SQL if that logic ever changes.
export function splitChoreValue(valuePence, { jar_save, jar_spend, jar_give: _jar_give }) {
  const save = Math.round((valuePence * jar_save) / 100);
  const spend = Math.round((valuePence * jar_spend) / 100);
  const give = valuePence - save - spend;
  return { save, spend, give };
}
