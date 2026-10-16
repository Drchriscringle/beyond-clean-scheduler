import { LegalLayout } from "./LegalLayout";

export function TermsOfService() {
  return (
    <LegalLayout title="Terms of Service" updated="[DATE — fill in before publishing]">
      <p>
        These terms cover your use of Pocket Money.
        <strong> This is a draft for the app owner to review before it goes live</strong> —
        replace the bracketed placeholders below with real details first.
      </p>

      <h2>What Pocket Money is</h2>
      <p>
        Pocket Money is a chores-and-allowance tracker for families. All balances,
        jars, and payments inside the app are <strong>virtual — play money for
        teaching purposes</strong>. No real currency is held, transmitted, or moved by
        this app at any point. Nothing in the app is a bank account, e-money product,
        or financial service.
      </p>

      <h2>Accounts</h2>
      <p>
        A parent or guardian creates the household account with an email and password,
        and may invite a co-parent. Children do not have an email login. A parent may
        give a child a username and 4-digit PIN so the child can sign in on their own
        device and see only their own chores, jars and messages. The parent remains
        responsible for the child's use of the app, can see the PIN, and can sign the
        child's devices out at any time.
      </p>

      <h2>Subscription &amp; billing</h2>
      <p>
        [Describe your actual plan here once set up — e.g.: "Pocket Money offers a
        14-day free trial. After the trial, continued use requires an active
        subscription, billed [monthly/annually] through Stripe. You can cancel at any
        time from Settings; access continues until the end of the current billing
        period."]
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>You're responsible for what you enter about your own household (names, chores, amounts).</li>
        <li>Don't use the app to impersonate another family or to store anything unrelated to its intended use.</li>
      </ul>

      <h2>Cancellation &amp; deletion</h2>
      <p>
        You can delete your family's data and account permanently at any time from
        Settings → Delete my account. This is irreversible.
      </p>

      <h2>Changes</h2>
      <p>We may update these terms as the app changes; continued use after an update means you accept the new terms.</p>

      <h2>Contact</h2>
      <p>Questions about these terms: [your-support-email@example.com]</p>
    </LegalLayout>
  );
}
