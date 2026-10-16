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
        <li>A family name, and for each child: a first name, an age (stored as a birth year), a chosen colour, icon and wallpaper, and an optional photo the parent takes or uploads for their avatar. Photos are stored privately and only shown inside your family's app.</li>
        <li>For each child, a username and a 4-digit PIN chosen by the parent so the child can sign in on their own phone or tablet. No email address or other contact details are collected from children.</li>
        <li>When a child signs in on a device, a record of that device (a short label such as "iPhone" and when it was last used) so the parent can see and sign out devices.</li>
        <li>Chores, bills, planned days, and the resulting activity/transaction history you create in the app.</li>
        <li>Messages sent between the parents and each child inside the app. These are visible only to your family.</li>
        <li>If you turn on alerts, a push-notification subscription for that device so we can send chore and message alerts. You can turn this off at any time.</li>
        <li>Billing information if you subscribe — handled entirely by Stripe (see below); we do not receive or store your card details.</li>
      </ul>

      <h2>What we don't do</h2>
      <ul>
        <li>No advertising or ad networks — this app has none.</li>
        <li>No selling or sharing data with third parties for marketing.</li>
        <li>No behavioral tracking or profiling of children.</li>
        <li>Children never provide an email address or create an account themselves. A child's sign-in (username and PIN) is created and controlled by the parent, who can see the PIN and sign the child's devices out at any time.</li>
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
        child, chore, bill, message, device and transaction record, any child photos, and
        your sign-in account itself.
        This cannot be undone.
      </p>

      <h2>Children's privacy</h2>
      <p>
        This app is designed for use by a parent on behalf of their household. A parent
        sets up each child, including their sign-in details, and stays in control: the
        parent can see the child's PIN, see which devices the child is signed in on, sign
        those devices out, and delete the child's data. A child signed in on their own
        device can only see their own chores, jars and messages, change their colour,
        icon, photo and wallpaper, and message their parents — nothing else. The only
        information a child enters themselves is their messages and their avatar choices.
      </p>

      <h2>Contact</h2>
      <p>Questions about this policy: [your-support-email@example.com]</p>
    </LegalLayout>
  );
}
