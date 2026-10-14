import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { BigButton, primaryBtn } from "../components/common";

const DISMISSED_KEY = "pm_install_prompt_dismissed_v1";

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true
  );
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isMobile() {
  return /android|iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

// Shown once, the first time a signed-in parent reaches the dashboard on a
// mobile browser that hasn't already installed the app. iOS has no install
// API, so it gets manual instructions; Android/Chrome gets the real one-tap
// install prompt via the captured `beforeinstallprompt` event.
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone() || !isMobile() || localStorage.getItem(DISMISSED_KEY)) return;

    const onBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    // iOS never fires beforeinstallprompt — show the manual-instructions
    // version right away instead.
    if (isIOS()) setVisible(true);

    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  };

  const install = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    }
    dismiss();
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4 pb-6">
      <div className="max-w-sm mx-auto bg-white rounded-3xl shadow-2xl border border-slate-100 p-5 relative">
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 text-slate-300 hover:text-slate-500 transition"
        >
          <X size={16} />
        </button>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">🐷</span>
          <div>
            <div className="font-display font-bold text-slate-800 text-sm">Add Pocket Money to your Home Screen</div>
            <div className="text-xs text-slate-500">So the kids can just tap an icon.</div>
          </div>
        </div>
        {deferredPrompt ? (
          <BigButton onClick={install} className={`${primaryBtn} text-sm py-2.5`}>
            Install
          </BigButton>
        ) : (
          <p className="text-xs text-slate-600 leading-relaxed">
            Tap the <strong>Share</strong> icon in Safari, then <strong>"Add to Home Screen"</strong>.
          </p>
        )}
      </div>
    </div>
  );
}
