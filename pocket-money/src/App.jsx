import { ErrorBoundary } from "./components/ErrorBoundary";
import { BackgroundBlobs, LoadingScreen } from "./components/common";
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

  if (session === undefined) {
    return (
      <div className="relative min-h-screen overflow-hidden">
        <BackgroundBlobs />
        <LoadingScreen />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="relative min-h-screen overflow-hidden">
        <BackgroundBlobs />
        <AuthGate />
      </div>
    );
  }

  if (familyLoading) {
    return (
      <div className="relative min-h-screen overflow-hidden">
        <BackgroundBlobs />
        <LoadingScreen />
      </div>
    );
  }

  if (!family) {
    return (
      <div className="relative min-h-screen overflow-hidden">
        <BackgroundBlobs />
        <CreateOrJoinFamily />
      </div>
    );
  }

  return (
    <CurrencyProvider currency={family.currency}>
      <div className="relative min-h-screen overflow-hidden">
        <BackgroundBlobs />
        <div className="relative">
          {isSubscriptionActive(family) ? <FamilyDashboard family={family} /> : <Paywall family={family} />}
        </div>
        {isSubscriptionActive(family) && <InstallPrompt />}
      </div>
    </CurrencyProvider>
  );
}
