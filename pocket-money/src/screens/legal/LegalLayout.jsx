import { ArrowLeft } from "lucide-react";
import { Page, Card, Logo } from "../../components/ui";

export function LegalLayout({ title, updated, children }) {
  return (
    <Page>
      <header className="flex items-center justify-between pt-5 pb-4">
        <a href="/" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-muted hover:text-ink transition">
          <ArrowLeft size={16} /> Back to Pocket Money
        </a>
        <Logo size={32} />
      </header>
      <Card className="p-6">
        <h1 className="text-[22px] font-bold tracking-tight text-ink">{title}</h1>
        <p className="text-[12px] text-ink-muted mt-1 mb-5">Last updated {updated}</p>
        <div className="space-y-4 text-[14px] leading-relaxed text-ink-muted [&_strong]:text-ink [&_h2]:font-semibold [&_h2]:text-ink [&_h2]:text-[15px] [&_h2]:mt-6 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
          {children}
        </div>
      </Card>
    </Page>
  );
}
