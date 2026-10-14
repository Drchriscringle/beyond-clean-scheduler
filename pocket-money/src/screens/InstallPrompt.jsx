import { useEffect, useState } from "react";
import { X, Share } from "lucide-react";
import { Button, Logo } from "../components/ui";

const DISMISSED_KEY = "pm_install_prompt_dismissed_v1";

const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);
const isMobile = () => /android|iphone|ipad|ipod/i.test(window.navigator.userAgent);

// Shown once, the first time a signed-in parent reaches the dashboard on a
// mobile browser that hasn't installed the app. iOS has no install API, so
// it gets manual instructions; Android/Chrome gets the real one-tap prompt.
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
    <div className="fixed inset-x-0 bottom-0 z-40 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="max-w-sm mx-auto bg-white rounded-2xl border border-line shadow-[0_16px_40px_-16px_rgba(27,27,47,0.35)] p-4 relative">
        <button onClick={dismiss} aria-label="Dismiss" className="absolute top-3 right-3 h-7 w-7 rounded-full flex items-center justify-center text-ink-muted hover:bg-surface">
          <X size={15} />
        </button>
        <div className="flex items-center gap-3 pr-6">
          <Logo size={40} />
          <div>
            <div className="text-[14px] font-semibold text-ink">Add to your Home Screen</div>
            <div className="text-[12.5px] text-ink-muted">So the kids can just tap an icon.</div>
          </div>
        </div>
        {deferredPrompt ? (
          <Button size="sm" className="w-full mt-3" onClick={install}>Install</Button>
        ) : (
          <p className="text-[12.5px] text-ink-muted mt-3 leading-relaxed">
            Tap the <Share size={13} className="inline -mt-0.5" /> <strong className="text-ink">Share</strong> icon in Safari, then <strong className="text-ink">"Add to Home Screen"</strong>.
          </p>
        )}
      </div>
    </div>
  );
}
