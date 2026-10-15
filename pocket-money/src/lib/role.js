// Remembers whether this device last signed in as a parent or a child, so
// a child's phone opens straight onto their sign-in screen.
const KEY = "pm_role";

export function rememberedRole() {
  try {
    return localStorage.getItem(KEY) === "child" ? "child" : "parent";
  } catch {
    return "parent";
  }
}

export function rememberRole(role) {
  try {
    localStorage.setItem(KEY, role);
  } catch {
    // ignore
  }
}
