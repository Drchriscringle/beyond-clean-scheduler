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
        One parent/guardian per household creates an account with an email and
        password. Children do not have their own login — a PIN inside the app is a
        convenience lock for switching between a parent's and a child's view on a
        shared device, not an account of its own.
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
