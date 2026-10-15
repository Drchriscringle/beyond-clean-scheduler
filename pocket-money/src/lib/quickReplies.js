// One-tap messages. Little ones get fewer, simpler options; parents get
// the things they say most.

export const PARENT_QUICK_REPLIES = [
  "Well done! 🌟",
  "Please do your chores today",
  "Checked and approved ✅",
  "Nearly there — one more to go!",
  "Dinner's ready 🍽️",
  "Love you ❤️",
];

export const CHILD_QUICK_REPLIES = {
  little: ["I did it! ⭐", "Can I have a job?", "Thank you! ❤️", "Help please"],
  middle: ["All done! ✅", "Can I have another chore?", "Can you check my chores?", "Thank you! ❤️", "What's for dinner?"],
  big: ["All done — can you approve?", "Any extra chores this week?", "Can we talk about my pocket money?", "Thanks!", "On my way home"],
};

export function childQuickReplies(mode) {
  return CHILD_QUICK_REPLIES[mode] || CHILD_QUICK_REPLIES.middle;
}
