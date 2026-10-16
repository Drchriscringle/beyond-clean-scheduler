// The child's screen adapts to their age: big pictures and a giant "I did
// it!" for little ones, more numbers and detail for older kids.
export function childAge(kid, now = new Date()) {
  if (!kid?.birth_year) return null;
  return now.getFullYear() - kid.birth_year;
}

export function ageMode(kid) {
  const age = childAge(kid);
  if (age === null) return "middle";
  if (age <= 6) return "little";
  if (age >= 10) return "big";
  return "middle";
}

export const AGE_OPTIONS = Array.from({ length: 14 }, (_, i) => i + 3); // 3 … 16
