// Chrome/Android fires `beforeinstallprompt` once, early in page load — long
// before a parent has finished signing up. Capture it at startup so the
// Add-to-Home-Screen card can still trigger the real install prompt later.
let deferred = null;
const listeners = new Set();

export function captureInstallPrompt() {
  if (typeof window === "undefined") return;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e;
    listeners.forEach((fn) => fn(e));
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    listeners.forEach((fn) => fn(null));
  });
}

export function getInstallPrompt() {
  return deferred;
}

// Subscribe to changes (the event arriving after mount, or the app installing).
export function onInstallPromptChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
export const isIOS = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);
export const isMobile = () => /android|iphone|ipad|ipod/i.test(window.navigator.userAgent);
