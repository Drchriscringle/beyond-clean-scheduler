import { Card, Pill } from "./ui";

export { Centered, LoadingScreen, BrandHeader } from "./ui";

// A titled white card. `badge` renders a count pill next to the title.
export function Section({ title, icon, subtitle, badge, children, className = "" }) {
  return (
    <Card className={`p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        {icon && <span className="text-brand-600">{icon}</span>}
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {typeof badge === "number" && badge > 0 && <Pill tone="brand">{badge}</Pill>}
      </div>
      {subtitle && <p className="text-[12.5px] text-ink-muted -mt-2 mb-3 leading-relaxed">{subtitle}</p>}
      {children}
    </Card>
  );
}
