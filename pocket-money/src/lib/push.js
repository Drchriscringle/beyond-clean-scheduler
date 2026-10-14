const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;

// 'ok' | 'ios-install' (iPhone needs Add to Home Screen first) | 'unsupported'
export function pushSupport() {
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (supported) return "ok";
  return isIOS() && !isStandalone() ? "ios-install" : "unsupported";
}

function urlBase64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((ch) => ch.charCodeAt(0)));
}

export async function currentPushSubscription() {
  if (pushSupport() !== "ok") return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export async function subscribeToPush(publicKey) {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notifications weren't allowed — you can change that in your phone's settings.");
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const sub = existing || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
  return sub.toJSON(); // { endpoint, keys: { p256dh, auth } }
}

export async function unsubscribeFromPush() {
  const sub = await currentPushSubscription();
  if (sub) await sub.unsubscribe();
  return sub?.endpoint || null;
}
