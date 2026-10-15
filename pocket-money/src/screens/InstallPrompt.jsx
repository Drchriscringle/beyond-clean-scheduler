import { useEffect, useState } from "react";
import { X, Share, MoreVertical } from "lucide-react";
import { Button, Logo } from "../components/ui";
import { getInstallPrompt, onInstallPromptChange, isIOS, isMobile, isStandalone } from "../lib/install";

const DISMISSED_KEY = "pm_install_prompt_dismissed_v1";

// Shown once, the first time someone reaches their home screen on a mobile
// browser that hasn't installed the app (parents after signing up, children
// after signing in). iOS has no install API so it gets manual instructions;
// Android/Chrome gets the real one-tap prompt captured at startup.
export function InstallPrompt({ forChild = false }) {
  const [deferredPrompt, setDeferredPrompt] = useState(getInstallPrompt);
  const [visible, setVisible] = useState(() => {
    try {
      return !isStandalone() && isMobile() && !localStorage.getItem(DISMISSED_KEY);
    } catch {
      return false;
    }
  });

  useEffect(() => onInstallPromptChange(setDeferredPrompt), []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // ignore
    }
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
            <div className="text-[12.5px] text-ink-muted">
              {forChild ? "So it's just a tap away, like a real app." : "So the kids can just tap an icon — and alerts work."}
            </div>
          </div>
        </div>
        {deferredPrompt ? (
          <Button size="sm" className="w-full mt-3" onClick={install}>Install</Button>
        ) : isIOS() ? (
          <p className="text-[12.5px] text-ink-muted mt-3 leading-relaxed">
            Tap the <Share size={13} className="inline -mt-0.5" /> <strong className="text-ink">Share</strong> icon in Safari, then <strong className="text-ink">"Add to Home Screen"</strong>.
          </p>
        ) : (
          <p className="text-[12.5px] text-ink-muted mt-3 leading-relaxed">
            Tap the <MoreVertical size={13} className="inline -mt-0.5" /> menu in your browser, then <strong className="text-ink">"Add to Home screen"</strong> or <strong className="text-ink">"Install app"</strong>.
          </p>
        )}
      </div>
    </div>
  );
}
