// Mirrors Stripe's own subscription statuses, plus the app-only default
// 'trial' used before any Stripe customer exists (see schema.sql).
const ACTIVE_STATUSES = new Set(["trial", "trialing", "active"]);

export function isSubscriptionActive(family) {
  if (!family) return false;
  if (!ACTIVE_STATUSES.has(family.subscription_status)) return false;
  if (family.subscription_status === "trial") {
    if (!family.trial_ends_at) return true; // shouldn't happen, but don't lock someone out over it
    return new Date(family.trial_ends_at) > new Date();
  }
  return true;
}

export function trialDaysLeft(family) {
  if (!family?.trial_ends_at) return 0;
  const ms = new Date(family.trial_ends_at) - new Date();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}
