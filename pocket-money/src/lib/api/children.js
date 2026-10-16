import { supabase } from "../supabaseClient";

// Note: the child's PIN is never selected back to the client (see
// check_child_pin() in schema.sql) — it's a UI convenience lock, not a
// security boundary, but there's no reason to ship its value to the browser.
const CHILD_COLUMNS =
  "id, family_id, name, avatar, avatar_url, theme, birth_year, weekly_budget_pence, jar_save, jar_spend, jar_give, allow_negative_balance, username, quiz_reward_mode, quiz_reward_pence, quiz_points_per_correct, created_at";

export async function listChildren() {
  const { data, error } = await supabase.from("children").select(CHILD_COLUMNS).order("created_at");
  if (error) throw error;
  return data;
}

export async function addChild({ name, avatar, pin, familyId, birthYear = null }) {
  const { data, error } = await supabase
    .from("children")
    .insert({ name, avatar, pin: pin || "0000", family_id: familyId, birth_year: birthYear })
    .select(CHILD_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

export async function updateChildJars(childId, { jar_save, jar_spend, jar_give }) {
  const { error } = await supabase
    .from("children")
    .update({ jar_save, jar_spend, jar_give })
    .eq("id", childId);
  if (error) throw error;
}

export async function updateChildBudget(childId, weeklyBudgetPence) {
  const { error } = await supabase.from("children").update({ weekly_budget_pence: weeklyBudgetPence }).eq("id", childId);
  if (error) throw error;
}

export async function updateChildBirthYear(childId, birthYear) {
  const { error } = await supabase.from("children").update({ birth_year: birthYear }).eq("id", childId);
  if (error) throw error;
}

export async function removeChild(childId) {
  const { error } = await supabase.from("children").delete().eq("id", childId);
  if (error) throw error;
}

// Verifies a PIN server-side so the real value never reaches the browser.
export async function checkChildPin(childId, pin) {
  const { data, error } = await supabase.rpc("check_child_pin", { target_child_id: childId, candidate_pin: pin });
  if (error) throw error;
  return data === true;
}

/* ---------------- sign-in details (parent-only) ---------------- */

export const USERNAME_RULE = /^[a-z0-9][a-z0-9_-]{2,19}$/;

// Lower-case letters, numbers, - and _; 3–20 characters.
export function normaliseUsername(raw) {
  return (raw || "").trim().toLowerCase().replace(/\s+/g, "-");
}

export async function renameChild(childId, name) {
  const { error } = await supabase.from("children").update({ name: name.trim() }).eq("id", childId);
  if (error) throw error;
}

export async function updateChildUsername(childId, username) {
  const value = username ? normaliseUsername(username) : null;
  if (value && !USERNAME_RULE.test(value)) {
    throw new Error("Usernames are 3–20 characters: lower-case letters, numbers, - or _.");
  }
  const { error } = await supabase.from("children").update({ username: value }).eq("id", childId);
  if (error) {
    if (error.code === "23505") throw new Error("That username is already taken — try another.");
    throw error;
  }
  return value;
}

export async function updateChildPin(childId, pin) {
  if (!/^\d{4}$/.test(pin)) throw new Error("PINs are exactly 4 digits.");
  const { error } = await supabase.from("children").update({ pin }).eq("id", childId);
  if (error) throw error;
}

// Parents can read a child's PIN back when it's forgotten.
export async function revealChildPin(childId) {
  const { data, error } = await supabase.rpc("reveal_child_pin", { target_child_id: childId });
  if (error) throw error;
  return data;
}

export async function listChildDevices() {
  const { data, error } = await supabase
    .from("child_devices")
    .select("id, child_id, label, created_at, last_seen_at, revoked_at")
    .is("revoked_at", null)
    .order("last_seen_at", { ascending: false });
  if (error) throw error;
  return data;
}

// Signs a child's device out remotely.
export async function revokeChildDevice(deviceId) {
  const { error } = await supabase.from("child_devices").update({ revoked_at: new Date().toISOString() }).eq("id", deviceId);
  if (error) throw error;
}

/* ---------------- personalisation ---------------- */

export async function updateChildTheme(childId, theme) {
  const { error } = await supabase.from("children").update({ theme }).eq("id", childId);
  if (error) throw error;
}

const AVATAR_BUCKET = "avatars";
const AVATAR_SIZE = 320;

// Square-crops and shrinks a photo on the device before upload, so a 12 MP
// selfie becomes a ~30 KB JPEG. Uses createImageBitmap when available so
// EXIF orientation from phone cameras is respected.
export async function resizeImage(file, size = AVATAR_SIZE, { square = true } = {}) {
  let source;
  let width;
  let height;
  if ("createImageBitmap" in window) {
    source = await createImageBitmap(file, { imageOrientation: "from-image" });
    width = source.width;
    height = source.height;
  } else {
    source = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
    width = source.naturalWidth;
    height = source.naturalHeight;
  }
  const canvas = document.createElement("canvas");
  if (square) {
    const side = Math.min(width, height);
    const sx = (width - side) / 2;
    const sy = (height - side) / 2;
    canvas.width = size;
    canvas.height = size;
    canvas.getContext("2d").drawImage(source, sx, sy, side, side, 0, 0, size, size);
  } else {
    // Keep the aspect ratio; `size` caps the longer edge.
    const scale = Math.min(1, size / Math.max(width, height));
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);
  }
  source.close?.();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not process the image"))), "image/jpeg", 0.85)
  );
}

// Uploads (or replaces) the child's photo at <family_id>/<child_id>.jpg and
// records that path on the child. The bucket is private; see
// getAvatarSignedUrl() for reading it back.
export async function uploadChildAvatar({ childId, familyId, file }) {
  const blob = await resizeImage(file);
  const path = `${familyId}/${childId}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, blob, { upsert: true, contentType: "image/jpeg", cacheControl: "3600" });
  if (uploadError) throw uploadError;
  const { error } = await supabase.from("children").update({ avatar_url: path }).eq("id", childId);
  if (error) throw error;
  return path;
}

export async function removeChildAvatar(childId) {
  const { error } = await supabase.from("children").update({ avatar_url: null }).eq("id", childId);
  if (error) throw error;
}

export async function getAvatarSignedUrl(path) {
  const { data, error } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}
