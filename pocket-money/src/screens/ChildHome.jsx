import { LoadingScreen, Centered, Card, Logo, Button } from "../components/ui";
import { CurrencyProvider } from "../hooks/useCurrency";
import { useChildren } from "../hooks/useChildren";
import { useChores, useRefreshChoreSchedules } from "../hooks/useChores";
import { usePendingClaims, useWeekClaims, useClaimsRealtime } from "../hooks/useClaims";
import { useChildBalances } from "../hooks/useBalances";
import { useChildrenBills } from "../hooks/useBills";
import { useFamilyById, useTouchChildDevice, useChildSignOut } from "../hooks/useChildDevice";
import { useMessagesRealtime } from "../hooks/useMessages";
import { useScreenTimeTracker } from "../hooks/useUsage";
import { isSubscriptionActive } from "../lib/subscription";
import { ChildView } from "./ChildView";
import { InstallPrompt } from "./InstallPrompt";

// A child's own device: everything a parent can see about *this* child,
// nothing about anyone else, and no admin controls. Row-level security
// enforces that server-side; this just loads it.
export function ChildHome({ device }) {
  const { data: family, isLoading: familyLoading } = useFamilyById(device.family_id);
  const { data: children = [], isLoading: kidsLoading } = useChildren();
  const { data: chores = [] } = useChores();
  const { data: pending = [] } = usePendingClaims();
  const { data: weekClaims = [] } = useWeekClaims();
  const kid = children.find((k) => k.id === device.child_id);
  const balances = useChildBalances(kid ? [kid] : []);
  const bills = useChildrenBills(kid ? [kid] : []);
  const signOut = useChildSignOut();
  useClaimsRealtime(device.family_id);
  useMessagesRealtime(device.family_id);
  useTouchChildDevice(!!kid);
  useRefreshChoreSchedules(!!kid);
  useScreenTimeTracker(!!kid);

  if (familyLoading || kidsLoading) return <LoadingScreen />;

  if (!kid || !family) {
    return (
      <Centered>
        <Card className="max-w-sm p-7 text-center">
          <Logo size={48} />
          <p className="mt-4 text-[15px] font-semibold text-ink">This device isn't signed in any more.</p>
          <p className="text-[13px] text-ink-muted mt-1">Ask a grown-up to check your username and PIN, then sign in again.</p>
          <Button className="mt-4 w-full" onClick={() => signOut.mutate()}>Sign in again</Button>
        </Card>
      </Centered>
    );
  }

  if (!isSubscriptionActive(family)) {
    return (
      <Centered>
        <Card className="max-w-sm p-7 text-center">
          <Logo size={48} />
          <p className="mt-4 text-[15px] font-semibold text-ink">Pocket Money is taking a little break.</p>
          <p className="text-[13px] text-ink-muted mt-1">Ask a grown-up to open the app on their phone — your jars are safe.</p>
        </Card>
      </Centered>
    );
  }

  return (
    <CurrencyProvider currency={family.currency}>
      <ChildView
        kid={kid}
        family={family}
        chores={chores.filter((c) => c.child_id === kid.id || c.child_id == null)}
        pending={pending}
        weekClaims={weekClaims.filter((c) => c.child_id === kid.id)}
        balance={balances[kid.id]}
        bills={bills[kid.id] || []}
        ownDevice
        onSignOut={() => signOut.mutate()}
      />
      <InstallPrompt forChild />
    </CurrencyProvider>
  );
}
