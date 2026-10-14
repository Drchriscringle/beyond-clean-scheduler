import { supabase } from "../supabaseClient";

// Note: the child's PIN is never selected back to the client (see
// check_child_pin() in schema.sql) — it's a UI convenience lock, not a
// security boundary, but there's no reason to ship its value to the browser.
const CHILD_COLUMNS =
  "id, family_id, name, avatar, avatar_url, theme, birth_year, weekly_budget_pence, jar_save, jar_spend, jar_give, allow_negative_balance, created_at";

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
async function resizeImage(file, size = AVATAR_SIZE) {
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
  const side = Math.min(width, height);
  const sx = (width - side) / 2;
  const sy = (height - side) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  canvas.getContext("2d").drawImage(source, sx, sy, side, side, 0, 0, size, size);
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
