// Daily money lessons for the child's screen, banded by age (see ageMode).
// `body` and `tryIt` may be functions of the family's money formatter so
// examples show the right currency. Icons are lucide names, resolved in
// LessonCard.

const little = [
  { term: "Coins", icon: "Coins", body: "Coins are little pieces of money. Some are worth more than others, even if they're smaller!", tryIt: "Can you find a coin at home and look at the number on it?" },
  { term: "Saving", icon: "PiggyBank", body: "Saving means keeping your money safe instead of spending it straight away, so it grows into a bigger pile.", tryIt: "Look at your Save jar. Is it bigger than last week?" },
  { term: "Spending", icon: "ShoppingBag", body: "Spending is when you swap your money for something you want, like a toy or a treat.", tryIt: "What would you buy with your Spend jar?" },
  { term: "Earning", icon: "Sparkles", body: "Earning means getting money for doing a job. Your chores are how you earn!", tryIt: "Which chore do you like earning from most?" },
  { term: "Giving", icon: "HandHeart", body: "Giving is using some of your money to help other people. It feels good!", tryIt: "Think of someone you could help with your Give jar." },
  { term: "Need", icon: "Apple", body: "A need is something you can't do without, like food, a warm bed and clothes.", tryIt: "Name three things you need every day." },
  { term: "Want", icon: "Gift", body: "A want is something nice to have but you'd be fine without it, like sweets or a new toy.", tryIt: "Name one thing you want but don't need." },
  { term: "Waiting", icon: "Clock", body: "Sometimes you have to wait and save up before you can buy something big. Waiting is hard, but it works!", tryIt: "What's something big you'd like to save for?" },
  { term: "Price", icon: "Tag", body: "The price is how much money something costs. Bigger numbers mean it costs more.", tryIt: "Next time you're in a shop, find the price of your favourite snack." },
  { term: "Change", icon: "ArrowLeftRight", body: "If you pay with more money than the price, the shop gives some back. That's called change.", tryIt: "If a toy costs 3 coins and you give 5, how many coins come back?" },
  { term: "Jar", icon: "PiggyBank", body: "Your three jars are Save, Spend and Give. When you earn money, a little goes into each one.", tryIt: "Which jar has the most money today?" },
  { term: "Bank", icon: "Landmark", body: "A bank is a safe place where grown-ups keep their money so it doesn't get lost.", tryIt: "Have you seen a bank or a cash machine in town?" },
  { term: "Card", icon: "CreditCard", body: "A bank card is a special card that lets grown-ups pay without using coins. The money still comes from somewhere!", tryIt: "Watch a grown-up pay with a card and ask where the money goes." },
  { term: "Pocket money", icon: "Wallet", body: "Pocket money is money that's yours to look after. You decide whether to save it, spend it or give it.", tryIt: "Tell a grown-up your plan for this week's pocket money." },
  { term: "Job", icon: "ClipboardCheck", body: "A job is work you do to earn money. Grown-ups have jobs too — that's how they earn their money.", tryIt: "What job would you like when you're big?" },
  { term: "Counting", icon: "Calculator", body: "Counting your money tells you how much you've got. Always count carefully!", tryIt: "Count how many pennies are in your Save jar." },
  { term: "Sharing", icon: "Users", body: "Sometimes families share money to pay for things everyone uses, like the house and food.", tryIt: "What's something your whole family shares?" },
  { term: "Choosing", icon: "Scale", body: "You can't buy everything, so you choose. Choosing well means picking what matters most.", tryIt: "If you could only pick one treat, which would it be?" },
  { term: "Goal", icon: "Target", body: "A goal is something you're saving for. Having a goal makes saving fun!", tryIt: "Pick a goal and tell a grown-up." },
  { term: "Pay day", icon: "Banknote", body: "Pay day is when money comes in. For grown-ups it's from work; for you, it's when your chores are approved!", tryIt: "How many chores did you finish this week?" },
  { term: "Lost money", icon: "Search", body: "Money can get lost if you don't keep it somewhere safe. A jar, a purse or a bank keeps it safe.", tryIt: "Where's a safe place for your coins at home?" },
  { term: "Thank you", icon: "Smile", body: "When someone gives you money or a gift, saying thank you shows you're grateful.", tryIt: "Who could you say thank you to today?" },
  { term: "Big and small", icon: "Coins", body: "Lots of small coins can add up to the same as one big coin. Small amounts matter!", tryIt: "How many 1p coins make 10p?" },
  { term: "Swap", icon: "ArrowLeftRight", body: "Buying something is a swap: you give money and get the thing. You can't have both!", tryIt: "What did you last swap your money for?" },
];

const middle = [
  { term: "Budget", icon: "Calculator", body: "A budget is a plan for your money: how much comes in, and what you'll do with it before you spend any.", tryIt: "Plan this week's pocket money: how much to save, spend and give?" },
  { term: "Interest", icon: "TrendingUp", body: (m) => `Interest is extra money a bank gives you for keeping your savings there. Save ${m(1000)} and you might get a few pence extra over a year — for doing nothing!`, tryIt: "Ask a grown-up if their savings earn interest." },
  { term: "Needs vs wants", icon: "Scale", body: "Needs are things you must have (food, a home). Wants are nice extras. Sorting them out is the first step to spending wisely.", tryIt: "Write down two needs and two wants from this week." },
  { term: "Saving goal", icon: "Target", body: (m) => `Big things take time. If something costs ${m(2000)} and you save ${m(200)} a week, it takes 10 weeks. Knowing the number makes it feel possible.`, tryIt: "Pick a goal and work out how many weeks it'll take." },
  { term: "Earning", icon: "Sparkles", body: "Money usually comes from work. The more useful your work is to someone, the more they'll pay for it.", tryIt: "Which of your chores do you think is worth the most, and why?" },
  { term: "Charity", icon: "HandHeart", body: "Charities use money people give to help others — people who are ill, hungry, or in trouble. Your Give jar can do real good.", tryIt: "Find out about one charity and what it does." },
  { term: "Price tag", icon: "Tag", body: "Prices aren't fixed by magic. Things cost more when they're hard to make, rare, or lots of people want them.", tryIt: "Compare the price of two drinks. Why might one cost more?" },
  { term: "Bargain", icon: "BadgePercent", body: "A bargain is paying less than usual. But a cheap thing you don't need isn't a bargain at all!", tryIt: "Spot a 'sale' sign and ask: would I want this at full price?" },
  { term: "Borrowing", icon: "Handshake", body: "Borrowing means using someone else's money now and paying it back later. You usually have to pay back a bit extra.", tryIt: "If you borrowed 50p from a friend, when would you pay it back?" },
  { term: "Debit card", icon: "CreditCard", body: "A debit card spends money that's already in your bank account. No money in the account, no spending!", tryIt: "Ask a grown-up how they check how much is in their account." },
  { term: "Receipt", icon: "Receipt", body: "A receipt is proof of what you paid. Keep it, and you can take things back if something's wrong.", tryIt: "Look at a receipt and find the total." },
  { term: "Tax", icon: "Landmark", body: "Tax is money everyone pays to the government. It pays for schools, hospitals, roads and parks.", tryIt: "Name three things in your town that tax pays for." },
  { term: "Wages", icon: "Banknote", body: "Wages are what a person is paid for their work, often by the hour or the week.", tryIt: "Ask a grown-up what jobs they've had." },
  { term: "Bills", icon: "Receipt", body: "Bills are regular costs for things you use — electricity, water, internet. They come whether you like it or not!", tryIt: "List three bills your family pays." },
  { term: "Pocket money plan", icon: "Wallet", body: "Splitting money into Save, Spend and Give before you touch it means you never 'accidentally' spend the lot.", tryIt: "What split would you choose: 50/40/10? 40/40/20?" },
  { term: "Opportunity cost", icon: "ArrowLeftRight", body: (m) => `Every time you spend, you give up something else. Spend ${m(300)} on sweets and that's ${m(300)} not going towards your goal. That's the real cost.`, tryIt: "Before your next buy, ask: what am I giving up?" },
  { term: "Impulse buy", icon: "Zap", body: "An impulse buy is grabbing something without thinking. A good trick: wait a day. If you still want it, buy it.", tryIt: "Try the 'wait one day' rule this week." },
  { term: "Value", icon: "Gem", body: "Value isn't just price. A toy you play with every day for a year is better value than a cheap one that breaks tomorrow.", tryIt: "What's the best-value thing you own?" },
  { term: "Savings account", icon: "PiggyBank", body: "A savings account is a bank account just for saving. It's harder to spend from, which helps!", tryIt: "Ask whether you could have a savings account." },
  { term: "Advert", icon: "Megaphone", body: "Adverts are made to make you want things. Knowing that makes them a lot less powerful.", tryIt: "Spot an advert today and say what it's trying to make you feel." },
  { term: "Emergency money", icon: "ShieldCheck", body: "Grown-ups keep some money aside for surprises — a broken washing machine, a flat tyre. Your Save jar is your emergency money.", tryIt: "What surprise might you need money for?" },
  { term: "Profit", icon: "TrendingUp", body: (m) => `Profit is what's left after costs. Make lemonade for ${m(100)} and sell it for ${m(300)}: ${m(200)} profit.`, tryIt: "Think of something you could make and sell." },
  { term: "Donation", icon: "Gift", body: "A donation is money you give away to help. Even small donations add up when lots of people give.", tryIt: "Decide what your Give jar will go to this month." },
  { term: "Saving streak", icon: "Flame", body: "Saving a little every week is more powerful than saving a lot once. Habits beat one-offs.", tryIt: "How many weeks in a row have you added to your Save jar?" },
  { term: "Fair price", icon: "Scale", body: "Comparing prices in a few places before you buy is how you find out what's fair.", tryIt: "Pick one item and compare its price in two shops or websites." },
];

const big = [
  { term: "Compound interest", icon: "TrendingUp", body: (m) => `Interest on your interest. Save ${m(10000)} at 5% and after a year you have ${m(10500)}. The next year you earn 5% on ${m(10500)} — and it snowballs. Starting young is the superpower.`, tryIt: "Double a penny every day for 30 days — guess the total, then work it out." },
  { term: "Inflation", icon: "ArrowUp", body: (m) => `Inflation means prices rise over time, so the same money buys less. ${m(100)} bought more ten years ago than it does today. That's why savings need to grow, not just sit.`, tryIt: "Ask a grown-up what a chocolate bar cost when they were your age." },
  { term: "Budget", icon: "Calculator", body: "A budget is income minus planned spending. Done properly it's not about saying no — it's deciding in advance what you'll say yes to.", tryIt: "Write a one-week budget for your pocket money with three categories." },
  { term: "Debit vs credit", icon: "CreditCard", body: "A debit card spends your own money. A credit card borrows the bank's money, which you must repay — with interest if you're late. Same shape, very different thing.", tryIt: "Ask a grown-up which they use and why." },
  { term: "Interest rate", icon: "Percent", body: "The interest rate is the percentage you earn on savings or pay on borrowing. Higher is better when you save, worse when you borrow.", tryIt: "Find the interest rate on a real savings account online." },
  { term: "Needs, wants, savings", icon: "Scale", body: "A common rule for adults: 50% needs, 30% wants, 20% savings. Your jars do a kid-sized version of exactly this.", tryIt: "Which of your jar percentages would you change, and why?" },
  { term: "Opportunity cost", icon: "ArrowLeftRight", body: "The true cost of anything is what you give up to get it. Spending on one thing means not spending — or saving — on another.", tryIt: "For your next purchase, name the thing you're giving up." },
  { term: "Income", icon: "Banknote", body: "Income is money coming in: wages, pocket money, selling things, interest. Most people's main income is their job.", tryIt: "List every source of income you have, however small." },
  { term: "Tax", icon: "Landmark", body: "Governments take a share of income and spending (tax) to pay for public services: schools, hospitals, roads, police. Most adults pay income tax on wages and VAT on things they buy.", tryIt: "Look at a receipt and find the VAT line." },
  { term: "Scam", icon: "ShieldAlert", body: "A scam is a trick to take your money or details. Red flags: pressure to act now, prizes you didn't enter, requests for passwords or codes. Real banks never ask for your PIN.", tryIt: "Name three signs a message might be a scam." },
  { term: "Subscription", icon: "RefreshCw", body: (m) => `A subscription charges you again and again — games, streaming, apps. ${m(500)} a month is ${m(6000)} a year. Small and regular adds up fast.`, tryIt: "Count the subscriptions your household pays for." },
  { term: "Emergency fund", icon: "ShieldCheck", body: "Money kept aside for surprises so you don't have to borrow. Adults aim for a few months of living costs. Yours could be a few weeks of pocket money.", tryIt: "How much would you want in your emergency fund?" },
  { term: "Debt", icon: "Scale", body: "Debt is money you owe. Some debt is sensible (a home), some is expensive (buy-now-pay-later, credit cards). The cost is always the interest.", tryIt: "What would you only ever borrow for?" },
  { term: "Profit margin", icon: "TrendingUp", body: (m) => `Profit is what's left after all costs. Sell something for ${m(1000)} that cost ${m(600)} to make: ${m(400)} profit — a 40% margin.`, tryIt: "Pick a product and guess its costs vs price." },
  { term: "Savings rate", icon: "PiggyBank", body: "Your savings rate is the share of income you keep. Even 10% saved consistently beats big one-off efforts.", tryIt: "What's your savings rate from this week's pocket money?" },
  { term: "Delayed gratification", icon: "Clock", body: "Choosing a bigger reward later over a smaller one now. Studies show people who can wait tend to do better with money — and it's a skill you can practise.", tryIt: "Pick one thing to wait a week for before buying." },
  { term: "Price comparison", icon: "Search", body: "The same thing can cost very different amounts in different places. Five minutes of comparing is often the best-paid work you'll ever do.", tryIt: "Compare one item across three sellers." },
  { term: "Advertising", icon: "Megaphone", body: "Adverts, influencers and 'limited time' deals exist to move your money. Noticing the technique takes away its power.", tryIt: "Spot a persuasion trick in an advert today." },
  { term: "Interest on debt", icon: "Percent", body: (m) => `Borrow ${m(10000)} at 20% and do nothing: a year later you owe ${m(12000)}. That's why card debt is dangerous — it compounds against you.`, tryIt: "Work out what 20% of your Spend jar would be." },
  { term: "Diversify", icon: "LayoutGrid", body: "Don't put all your eggs in one basket. Spreading savings or investments across different things lowers the risk of losing everything.", tryIt: "Name three different places money could be kept." },
  { term: "Investing", icon: "LineChart", body: "Investing means buying things (like shares in companies) hoping they grow in value. It can beat savings over years, but it can also go down. Time is what makes it work.", tryIt: "Ask a grown-up if they've ever invested, and in what." },
  { term: "Net vs gross", icon: "Receipt", body: "Gross pay is what you earn before tax and deductions; net pay is what actually arrives. Adults often get a shock the first time they see the difference.", tryIt: "If gross pay is 100 and tax is 20%, what's net?" },
  { term: "Credit score", icon: "BadgeCheck", body: "A credit score is a record of how reliably you repay. Paying on time builds it; missing payments hurts it. It affects whether banks will lend to you later.", tryIt: "Ask a grown-up if they know their credit score." },
  { term: "Wants in disguise", icon: "Gem", body: "Lots of 'needs' are wants in disguise: you need a phone, you want the newest one. Spotting the difference is where the money is.", tryIt: "Find one 'need' this week that's really a want." },
  { term: "Giving well", icon: "HandHeart", body: "Giving regularly, even small amounts, does more good than a big gift once a year — charities can plan with it. Your Give jar is a habit, not a gesture.", tryIt: "Choose a cause your Give jar supports for the next month." },
];

export const LESSONS = { little, middle, big };

export function lessonsFor(mode) {
  return LESSONS[mode] || LESSONS.middle;
}

function hash(seed = "") {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

// One lesson per day, stable for the day and different for each child.
export function lessonForDay(mode, seed = "", date = new Date()) {
  return dailyCard(mode, seed, date).lesson;
}

// Walks the deck in order, one card a day. The first time through each
// card is a lesson; the next time through it comes back as a quiz, then
// lesson again — so every term is taught, then tested, forever.
export function dailyCard(mode, seed = "", date = new Date()) {
  const list = lessonsFor(mode);
  const dayNumber = Math.floor(date.getTime() / 86400000) + hash(seed);
  const lesson = list[dayNumber % list.length];
  const pass = Math.floor(dayNumber / list.length) % 2;
  return { lesson, kind: pass === 0 ? "lesson" : "quiz" };
}

export function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}
