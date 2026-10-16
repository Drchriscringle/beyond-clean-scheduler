import { supabase } from "../supabaseClient";

/* ---------------- settings (parent) ---------------- */

export const QUIZ_REWARD_MODES = [
  { key: "money", label: "Pocket money", hint: "Each right answer pays into their jars, like a chore." },
  { key: "points", label: "Points for rewards", hint: "Right answers earn points to trade for rewards you set up — a cuddle, a film night, a day out." },
  { key: "none", label: "Nothing", hint: "Just for fun." },
];
export const QUIZ_REWARD_PENCE = [1, 2, 5, 10, 20, 50];
export const QUIZ_REWARD_POINTS = [1, 2, 3, 5, 10];

export async function updateQuizReward(childId, { mode, pence, points }) {
  const patch = {};
  if (mode) patch.quiz_reward_mode = mode;
  if (pence !== undefined) patch.quiz_reward_pence = pence;
  if (points !== undefined) patch.quiz_points_per_correct = points;
  const { error } = await supabase.from("children").update(patch).eq("id", childId);
  if (error) throw error;
}

/* ---------------- rewards shop ---------------- */

export const REWARD_IDEAS = [
  { name: "A big cuddle", icon: "heart", cost_points: 1 },
  { name: "Choose tonight's dinner", icon: "utensils", cost_points: 5 },
  { name: "Extra bedtime story", icon: "book", cost_points: 5 },
  { name: "Stay up 30 minutes later", icon: "moon", cost_points: 10 },
  { name: "Family film night", icon: "popcorn", cost_points: 15 },
  { name: "Trip to the park", icon: "sun", cost_points: 15 },
  { name: "Bake together", icon: "cookie", cost_points: 20 },
  { name: "Trip to the cinema", icon: "clapperboard", cost_points: 40 },
  { name: "Day out", icon: "car", cost_points: 80 },
];

export async function listRewards() {
  const { data, error } = await supabase.from("rewards").select("*").eq("active", true).order("cost_points");
  if (error) throw error;
  return data;
}

export async function addReward({ familyId, childId = null, name, icon, costPoints }) {
  const { data, error } = await supabase
    .from("rewards")
    .insert({ family_id: familyId, child_id: childId, name: name.trim(), icon, cost_points: costPoints })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeReward(rewardId) {
  const { error } = await supabase.from("rewards").update({ active: false }).eq("id", rewardId);
  if (error) throw error;
}

/* ---------------- points & awards ---------------- */

export async function listChildPoints() {
  const { data, error } = await supabase.from("child_points").select("child_id, points");
  if (error) throw error;
  const out = {};
  for (const r of data) out[r.child_id] = r.points;
  return out;
}

export async function listPointsHistory(childId, limit = 20) {
  const { data, error } = await supabase
    .from("points_ledger")
    .select("id, delta, reason, created_at")
    .eq("child_id", childId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

// kind: 'quiz' | 'game:<key>'; dayKey: local 'YYYY-MM-DD'. Once per day per kind.
export async function awardLearning({ childId, kind, dayKey, correct }) {
  const { data, error } = await supabase.rpc("award_learning", { target_child_id: childId, kind, day_key: dayKey, correct });
  if (error) throw error;
  return data; // { mode, amount_pence, points, already }
}

export async function adjustPoints(childId, delta, why = "") {
  const { error } = await supabase.rpc("adjust_points", { target_child_id: childId, delta, why });
  if (error) throw error;
}

/* ---------------- requests ---------------- */

export async function listRewardRequests(status = null) {
  let q = supabase.from("reward_requests").select("*").order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function requestReward(rewardId) {
  const { data, error } = await supabase.rpc("request_reward", { target_reward_id: rewardId });
  if (error) throw error;
  return data;
}

export async function decideReward(requestId, grant) {
  const { error } = await supabase.rpc("decide_reward", { request_id: requestId, grant_it: grant });
  if (error) throw error;
}

export function subscribeToRewards(familyId, onChange) {
  const channel = supabase
    .channel(`rewards-${familyId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "reward_requests", filter: `family_id=eq.${familyId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "points_ledger", filter: `family_id=eq.${familyId}` }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
