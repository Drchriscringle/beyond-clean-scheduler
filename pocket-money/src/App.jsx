import { ErrorBoundary } from "./components/ErrorBoundary";
import { LoadingScreen } from "./components/ui";
import { CurrencyProvider } from "./hooks/useCurrency";
import { useAuthSession } from "./hooks/useAuthSession";
import { useFamily } from "./hooks/useFamily";
import { isSubscriptionActive } from "./lib/subscription";
import { AuthGate } from "./screens/AuthGate";
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

function AuthedApp() {
  const session = useAuthSession();
  const { data: family, isLoading: familyLoading } = useFamily(!!session);

  if (session === undefined) return <LoadingScreen />;
  if (!session) return <AuthGate />;
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
