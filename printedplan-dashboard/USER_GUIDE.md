# User guide

Written for Chris. No technical knowledge needed.

## Logging in

1. Open the dashboard URL (you'll get it from Vercel, it ends in `.vercel.app`).
2. Enter your email and password. Leave **Remember me** ticked so you stay signed in on this device.
3. If you've turned on two-factor in Settings, type the 6-digit code from your authenticator app.
4. **Log out** is at the bottom of the left menu (or in the ☰ menu on your phone).

Forgot your password? It's changed in the Supabase dashboard under Authentication → Users → your user → Reset password, or from the app's Settings page if you're still logged in.

## The pages

The left-hand menu (☰ on mobile) has eight pages. Here's what each one is for and the two or three things you'll actually do there.

### 🏠 Dashboard (home)

Your daily standup. Open it every morning.

- **Today's critical actions** — the five most urgent things, in time order. Red = due today, dark red = overdue, yellow = later this week, green = on track. If a pin is due within two hours you'll see **⚠ POSTING IN X MINUTES**. Tick the box when it's done; it moves to "Completed today" and the list resets at midnight. **View** jumps to the right page.
  - Pins appear here when they're **Scheduled** for today (or still In Design / Needs Caption with today's date).
  - Instagram posts appear when they're **Ready** or **Scheduled** for today.
  - Products appear as "Upload to Etsy" when their status is **Ready** and their pipeline due date is today.
  - Production tasks appear when the pipeline due date is today and the product isn't fully ready.
- **Yesterday's performance** — the numbers you logged for yesterday on the Analytics page, plus your top product, pin and post.
- **This week's deadlines** — Monday to Sunday with counts per day.
- **Blockers / notes** — any pipeline notes on products due in the next 7 days.

### 🛍️ Etsy Tracker

One row per product.

- **+ Add new product** — name, price, status, Etsy link, 30-day views and sales. Revenue is worked out for you (sales × price).
- Change **Status** straight from the dropdown in the table. Flip **Images** / **Copy** toggles in place.
- Click a product name for a summary; **Edit** to change anything; **Delete** to remove it (this also removes its pins, pipeline row and copy).
- Filter by status, sort by clicking any column header. On a phone the table becomes cards; tap a card to expand.
- Summary cards at the top: live count, ready count, total 30-day revenue, best seller by revenue, best by conversion (sales ÷ views).

### 📌 Pinterest Tracker

- **+ New pin** — name, product, board, status, scheduled date and time, caption, and the 7-day stats once it's live.
- **Table** view: sort, filter, and see CTR (clicks ÷ impressions) for live pins. Anything under 15 % is flagged **Needs redesign**.
- **Timeline** view (desktop only): the next 14 days side by side with each day's pins. Click a pin to open it.
- **View** shows the caption with a copy button and a **Mark as live** button for when you've posted it.

### 📱 Instagram Tracker

Two lists.

- **Ready to post** — drafts, ready and scheduled posts. When you publish one on Instagram, click **Publish**, enter the date and (later) the likes/saves/comments/clicks/conversions. It moves to the archive.
- **Posted archive** — click any number to edit it in place; press Enter or click away to save. **View caption** opens the full caption with a **Copy** button.
- Summary: how many are queued, how many went out in the last 7 days, average engagement (likes + saves + comments), best post and best-performing pillar.
- **Copy library** button at the top takes you to the captions for each product.

### 🏗️ Content Pipeline

Every product gets a row here automatically. Six steps: Idea → Template built → Images done → Etsy copy → Pinterest copy → Instagram post.

- Click any ✓/✗ in the table to toggle it. **Fully ready** turns green when all six are ticked.
- Click a product name for the detail view: checkboxes, notes/blockers, and a "what's needed next" list.
- **Edit notes** and **Change due date** are on every row. Due dates go red when overdue, yellow when due this week.
- When a product is fully ready, a **Move to Live** button appears. Click it once it's uploaded.
- The summary shows counts by status, how many are overdue, and the current **bottleneck** (the step blocking the most products).

### 📝 Copy Library

One card per product with four collapsible sections: Etsy short description, Etsy full description, Pinterest captions, Instagram posts.

- **Edit** opens a large dark editor with live character and word counts.
- **Copy** puts the text on your clipboard and says "Copied!".
- Pinterest and Instagram sections take unlimited variants: **+ Add another variant**, **Delete** on each.
- If a variant's text is exactly what's on a pin or post, the card says "Used in …".
- Search box searches every piece of copy; the product dropdown narrows to one product.

### 📈 Performance Analytics

- Choose **Last 7 / 30 / 90 days** or a custom range, and Daily / Weekly / Monthly grouping.
- The metrics table shows totals, daily averages and the **trend** against the same-length period just before (green ↑ good, red ↓ down).
- Four charts: Etsy revenue, Pinterest CTR, revenue by product (top 10), engagement by Instagram post. Hover for exact values.
- **Top performers** and **Needs attention** (pins under 15 % CTR, live products under 50 views).
- **+ Log today's numbers** — this is where daily figures come from until the APIs are connected. One row per day; saving the same date again overwrites it. The daily log at the bottom lets you edit or delete a day.
- **Export as PDF** opens your browser's print dialog; choose "Save as PDF".

### ⚙️ Settings

- **Account:** change email (you confirm via a link sent to both addresses), change password, enable/disable two-factor.
- **Preferences:** timezone (UK or UTC — affects what "today" means) and the default status for new products.
- **Data management:** import a CSV into one table (headers must match the column names), export everything as a JSON backup, or delete all data (type DELETE to confirm; export first).
- **API keys:** placeholders for Phase 2 automatic syncing. Stored only in this browser.

## First-day checklist

1. Log in.
2. Etsy Tracker → add your products with prices, statuses and current 30-day views/sales.
3. Content Pipeline → tick what's done for each product and set due dates.
4. Copy Library → paste in the descriptions and captions you already have.
5. Pinterest Tracker → add the pins for the next two weeks with dates and times.
6. Instagram Tracker → add the next few posts with dates, mark them Ready.
7. Analytics → log yesterday's numbers.
8. Go back to the Dashboard: tomorrow morning it will tell you exactly what to do.

## Daily routine (5 minutes)

1. Open the Dashboard. Do the red things first, tick them off.
2. After posting a pin: Pinterest → View → **Mark as live**. After an Instagram post: **Publish**.
3. End of day: Analytics → **+ Log today's numbers** (Etsy stats, Pinterest, Instagram).
4. Weekly: update each product's 30-day views/sales and each live pin's 7-day stats; check "Needs attention".
