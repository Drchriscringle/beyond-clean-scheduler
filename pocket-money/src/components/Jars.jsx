import { useMoney } from "../hooks/useCurrency";
import { Progress } from "./ui";

export const JARS = [
  { key: "save", label: "Save", color: "#15803d" },
  { key: "spend", label: "Spend", color: "#1d6fe8" },
  { key: "give", label: "Give", color: "#be185d" },
];

function pick(balance, key) {
  return balance?.[`${key}_pence`] ?? 0;
}

// Three stat tiles (Save / Spend / Give) with a bar showing each jar's
// share of the child's total. `compact` is the dense version for list cards.
export function JarStats({ balance, compact = false }) {
  const money = useMoney();
  const positive = JARS.reduce((s, j) => s + Math.max(0, pick(balance, j.key)), 0);

  return (
    <div className={`grid grid-cols-3 ${compact ? "gap-2" : "gap-3"}`}>
      {JARS.map((jar) => {
        const pence = pick(balance, jar.key);
        const share = positive > 0 ? (Math.max(0, pence) / positive) * 100 : 0;
        return (
          <div key={jar.key} className={compact ? "" : "rounded-xl bg-surface p-3"}>
            <div className="flex items-center justify-between mb-1">
              <span className={`${compact ? "text-[11px]" : "text-[12px]"} font-semibold text-ink-muted`}>{jar.label}</span>
            </div>
            <div className={`${compact ? "text-[13px]" : "text-[16px]"} font-bold tabular-nums text-ink mb-1.5`}>
              {money(pence)}
            </div>
            <Progress value={share} color={jar.color} />
          </div>
        );
      })}
    </div>
  );
}
