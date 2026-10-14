// Weeks start Monday 00:00 UTC — must match date_trunc('week', now()) in
// claim_chore() so the app and the database count the same completions.
export function weekStartUTC(now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay(); // 0 = Sunday
  d.setUTCDate(d.getUTCDate() - ((day + 6) % 7));
  return d;
}
