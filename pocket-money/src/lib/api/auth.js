import { supabase } from "../supabaseClient";

// The confirmation email's link comes back to wherever the app is running
// (this must also be in Supabase → Authentication → URL Configuration →
// Redirect URLs, or Supabase falls back to its Site URL).
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${window.location.origin}/parent` },
  });
  if (error) throw error;
  return data;
}

export async function sendPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/parent` });
  if (error) throw error;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function sendMagicLink(email) {
  const { error } = await supabase.auth.signInWithOtp({ email });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// callback(session, event) — event is e.g. 'SIGNED_IN', 'SIGNED_OUT', 'PASSWORD_RECOVERY'.
export function onAuthChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => callback(session, event));
  return data.subscription; // caller should .unsubscribe() on unmount
}

// After a password-reset link has signed the parent in.
export async function updatePassword(password) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

/* ---------------- child devices ---------------- */

function deviceLabel() {
  const ua = navigator.userAgent || "";
  if (/iphone/i.test(ua)) return "iPhone";
  if (/ipad/i.test(ua)) return "iPad";
  if (/android/i.test(ua)) return /mobile/i.test(ua) ? "Android phone" : "Android tablet";
  if (/mac/i.test(ua)) return "Mac";
  if (/windows/i.test(ua)) return "Windows PC";
  return "Device";
}

// A child signs in with the username + PIN their parent set. Under the hood
// this device becomes an anonymous Supabase user that link_child_device()
// ties to the child (with a 5-strike lockout). A failed PIN keeps the
// anonymous session around so the next try reuses it.
export async function signInAsChild(username, pin) {
  const { data: current } = await supabase.auth.getSession();
  if (current.session && !current.session.user?.is_anonymous) await supabase.auth.signOut();
  if (!current.session || !current.session.user?.is_anonymous) {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
  }
  const { data, error } = await supabase.rpc("link_child_device", {
    login_username: username.trim().toLowerCase(),
    candidate_pin: pin,
    device_label: deviceLabel(),
  });
  if (error) throw error;
  return data; // { child_id, family_id, name }
}

// The child this anonymous device is signed in as, or null.
export async function getMyChildDevice() {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return null;
  const { data, error } = await supabase
    .from("child_devices")
    .select("id, child_id, family_id, label")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function touchChildDevice() {
  await supabase.rpc("touch_child_device");
}

// Child signs out of this device: the device is revoked server-side, then the
// anonymous session is dropped.
export async function signOutChildDevice() {
  try {
    await supabase.rpc("unlink_this_device");
  } finally {
    await supabase.auth.signOut();
  }
}
