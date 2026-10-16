import { useState } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { LoadingScreen } from "./components/ui";
import { CurrencyProvider } from "./hooks/useCurrency";
import { useAuthSession, usePasswordRecovery } from "./hooks/useAuthSession";
import { useFamily } from "./hooks/useFamily";
import { useMyChildDevice } from "./hooks/useChildDevice";
import { isSubscriptionActive } from "./lib/subscription";
import { rememberedRole, rememberRole } from "./lib/role";
import { AuthGate } from "./screens/AuthGate";
import { ChildSignIn } from "./screens/ChildSignIn";
import { SetNewPassword } from "./screens/SetNewPassword";
import { ChildHome } from "./screens/ChildHome";
import { CreateOrJoinFamily } from "./screens/CreateOrJoinFamily";
import { FamilyDashboard } from "./screens/FamilyDashboard";
import { Paywall } from "./screens/Paywall";
import { InstallPrompt } from "./screens/InstallPrompt";
import { PrivacyPolicy } from "./screens/legal/PrivacyPolicy";
import { TermsOfService } from "./screens/legal/TermsOfService";

export default function App() {
  // /privacy and /terms are plain static pages, reachable whether or not
  // anyone is signed in (required for Stripe + app-store listings) —
  // served by the Netlify SPA fallback (public/_redirects), handled here.
  if (window.location.pathname === "/privacy") return <PrivacyPolicy />;
  if (window.location.pathname === "/terms") return <TermsOfService />;

  return (
    <ErrorBoundary>
      <AuthedApp />
    </ErrorBoundary>
  );
}

// Shareable links: /child opens straight onto the child sign-in, /parent onto
// the parent one. Either is remembered for next time, then the URL is tidied.
function roleFromUrl() {
  const path = window.location.pathname;
  if (path === "/child" || path === "/parent") {
    const role = path.slice(1);
    rememberRole(role);
    // Keep the hash: a password-reset or confirmation link carries its tokens there.
    window.history.replaceState(null, "", `/${window.location.hash}`);
    return role;
  }
  return rememberedRole();
}

// Two kinds of session: a parent (email + password, full control) and a
// child device (anonymous auth user tied to one child by username + PIN).
function AuthedApp() {
  const session = useAuthSession();
  const [recovering, finishRecovery] = usePasswordRecovery();
  const [role, setRole] = useState(roleFromUrl);
  const isChildSession = !!session?.user?.is_anonymous;
  const { data: family, isLoading: familyLoading } = useFamily(!!session && !isChildSession);
  const { data: device, isLoading: deviceLoading } = useMyChildDevice(isChildSession);

  const pickRole = (next) => {
    rememberRole(next);
    setRole(next);
  };

  if (session === undefined) return <LoadingScreen />;

  // Child sign-in is rendered at this same spot whether there's no session
  // yet or an anonymous one that isn't linked, so the form keeps its state
  // while the anonymous user is being created mid-sign-in.
  if ((!session && role === "child") || (isChildSession && !device)) {
    return <ChildSignIn onParent={() => pickRole("parent")} checking={isChildSession && deviceLoading} />;
  }
  if (!session) return <AuthGate onChild={() => pickRole("child")} />;
  if (isChildSession) return <ChildHome device={device} />;
  if (recovering) return <SetNewPassword onDone={finishRecovery} />;

  if (familyLoading) return <LoadingScreen />;
  if (!family) return <CreateOrJoinFamily />;

  const active = isSubscriptionActive(family);
  return (
    <CurrencyProvider currency={family.currency}>
      {active ? <FamilyDashboard family={family} parentEmail={session.user?.email} /> : <Paywall family={family} />}
      {active && <InstallPrompt />}
    </CurrencyProvider>
  );
}
