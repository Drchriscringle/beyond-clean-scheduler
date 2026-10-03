# Ayr websites: outreach playbook

**Offer:** a professional website, live in 48 hours. **£249 one-off + £25/month** (hosting, edits, updates).
Their own domain (about £10/year) is paid by them.

**Golden rule:** show them their site *before* you ask for money. People say no to an idea but yes to a finished thing with their name on it.

**UK law (PECR):** don't cold-email sole traders or partnerships. Phone them, text them, message them on Facebook, or walk in. Cold-emailing limited companies is fine.

---

## Your daily routine (60–90 min)

1. Open `tracker.csv` and pick today's leads (status `new`).
2. Send each one their message below (Facebook message, text, or walk in with your phone showing the site).
3. Follow up anyone from 2 days ago who hasn't replied (follow-up script below).
4. Update the `status` column: `new` → `sent` → `replied` → `paid` / `no`.
5. If someone says yes: send the payment link, then tell Claude "X said yes". Claude finishes their site.

---

## Message 1: first contact (Facebook message or text)

> Hi {owner or "there"}, I'm {your name}, I'm local to Ayr and I build websites for local businesses.
> I noticed {business} doesn't have its own website yet, so I made you one to show you what it could look like:
> 👉 {demo link}
> It's built for phones, has your number as a tap-to-call button and comes with a quote form.
> If you like it, I can have it live on your own web address this week for £249, plus £25 a month for hosting and any changes you want. If not, no worries at all, and thanks for looking!

## Message 2: walking into a shop (barber, cafe)

> "Hiya, sorry to bother you. I'm {name}, I'm local and I build websites for Ayr businesses. I made one for you, have a quick look (show phone). If you want it, it's £249 to go live, and I'll leave you my number either way."

Then leave a small note with the link and your number. Go at a quiet time (barber: mid-morning on a weekday; cafe: 2:30–4pm).

## Message 3: follow-up (2 days later, once only)

> Hi {owner}, just checking you saw the website I made for {business}: {demo link}. Happy to change anything (photos, prices, wording). Shall I put it live for you?

## Objections, and what to say

| They say | You say |
|---|---|
| "I get enough work from Facebook" | "Brilliant. This just catches the people searching Google who aren't on Facebook, and it sends them to your phone." |
| "Too expensive" | "I can split it: £125 now and £124 when it's live." (Never go below £199.) |
| "I'll think about it" | "No problem. I'll keep it up until Friday so you can show whoever you need to." |
| "Can you add photos / prices?" | "Yes, send me them on here and I'll update it today." (Then tell Claude.) |
| "Is this a scam?" | "Fair question! You don't pay anything until you've seen it and you're happy. Here's my Facebook so you can see I'm local." |

## When someone says YES

1. Send them a payment link (set up free at stripe.com → Payment Links, or PayPal.me) for £249, or £125 deposit.
2. Ask them for: their logo (if any), 3–6 photos of their work, their prices, and the web address they'd like.
3. Tell Claude: "{business} paid, here are their photos/details". Claude finishes the site, removes the preview banner, and connects the domain.
4. Set up their £25/month as a Stripe subscription starting next month.
5. Ask: "Do you know anyone else who needs a website? I'll give you £25 off next month for every referral."
