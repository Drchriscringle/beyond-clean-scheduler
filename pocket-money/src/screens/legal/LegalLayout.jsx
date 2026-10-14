import { BackgroundBlobs } from "../../components/common";

export function LegalLayout({ title, updated, children }) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <BackgroundBlobs />
      <div className="relative max-w-2xl mx-auto p-4 py-10 space-y-6">
        <a href="/" className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition">
          ← Back to Pocket Money
        </a>
        <div className="bg-white/80 backdrop-blur rounded-3xl p-6 sm:p-8 shadow-sm border border-white space-y-4">
          <div>
            <h1 className="font-display text-2xl font-extrabold text-slate-800">{title}</h1>
            <p className="text-xs text-slate-400 mt-1">Last updated {updated}</p>
          </div>
          <div className="space-y-4 text-sm leading-relaxed text-slate-600 [&_h2]:font-display [&_h2]:font-bold [&_h2]:text-slate-800 [&_h2]:text-base [&_h2]:mt-6 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
