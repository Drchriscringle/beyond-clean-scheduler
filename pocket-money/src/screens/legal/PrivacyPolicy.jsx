import { LegalLayout } from "./LegalLayout";

export function PrivacyPolicy() {
  return (
    <LegalLayout title="Privacy Policy" updated="[DATE — fill in before publishing]">
      <p>
        Pocket Money ("we", "us") is a family chores-and-pocket-money app. This page
        explains what information we collect, why, and what we don't do with it.
        <strong> This is a draft for the app owner to review before it goes live</strong> —
        replace the bracketed placeholders below with real details first.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>The parent's email address, used to sign in and for account/billing emails.</li>
        <li>A family name, and for each child: a name, a chosen emoji avatar, and a 4-digit PIN (a convenience lock for switching screens on a shared device — not a security credential).</li>
        <li>Chores, bills, and the resulting activity/transaction history you create in the app.</li>
        <li>Billing information if you subscribe — handled entirely by Stripe (see below); we do not receive or store your card details.</li>
      </ul>

      <h2>What we don't do</h2>
      <ul>
        <li>No advertising or ad networks — this app has none.</li>
        <li>No selling or sharing data with third parties for marketing.</li>
        <li>No behavioral tracking or profiling of children.</li>
        <li>Children never create their own account, email, or login — only a parent authenticates, and "child mode" is a view within that same account.</li>
      </ul>

      <h2>Who processes data on our behalf</h2>
      <ul>
        <li><strong>Supabase</strong> — hosts our database and handles sign-in. [Confirm hosting region, e.g. EU.]</li>
        <li><strong>Stripe</strong> — handles subscription payments if you subscribe. Stripe's own privacy policy covers payment data: https://stripe.com/privacy</li>
      </ul>

      <h2>Account deletion</h2>
      <p>
        You can permanently delete your family's data and your account at any time from
        Settings → Delete my account, inside the app. This removes the family, every
        child, chore, bill, and transaction record, and your sign-in account itself.
        This cannot be undone.
      </p>

      <h2>Children's privacy</h2>
      <p>
        This app is designed for use by a parent on behalf of their household. Children
        do not register their own accounts or provide information directly to us —
        everything about a child is entered by the parent into the parent's own account.
      </p>

      <h2>Contact</h2>
      <p>Questions about this policy: [your-support-email@example.com]</p>
    </LegalLayout>
  );
}
