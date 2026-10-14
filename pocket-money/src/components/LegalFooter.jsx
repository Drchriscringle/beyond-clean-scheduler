export function LegalFooter() {
  return (
    <div className="flex justify-center gap-3 text-[11px] text-slate-400 pt-2">
      <a href="/privacy" className="hover:text-slate-600 transition">Privacy</a>
      <span>·</span>
      <a href="/terms" className="hover:text-slate-600 transition">Terms</a>
    </div>
  );
}
