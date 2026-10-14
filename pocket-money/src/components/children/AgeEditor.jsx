import { useUpdateChildBirthYear } from "../../hooks/useChildren";
import { AGE_OPTIONS, childAge } from "../../lib/ageMode";

// Parent-side age control; stored as birth year so it stays right over time.
export function AgeEditor({ kid }) {
  const update = useUpdateChildBirthYear();
  const age = childAge(kid);

  return (
    <label className="text-right shrink-0">
      <span className="block text-[11px] font-semibold text-ink-muted mb-1">Age</span>
      <select
        value={age ?? ""}
        onChange={(e) => {
          const next = e.target.value ? new Date().getFullYear() - Number(e.target.value) : null;
          update.mutate({ childId: kid.id, birthYear: next });
        }}
        className="h-9 rounded-xl border border-line bg-white px-2.5 text-[14px] font-semibold text-ink outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
      >
        <option value="">Set…</option>
        {AGE_OPTIONS.map((a) => (
          <option key={a} value={a}>{a}</option>
        ))}
      </select>
    </label>
  );
}
