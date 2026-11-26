export function LoadingState({ label = "Loading data…" }) {
  return (
    <div className="py-6" role="status" aria-live="polite">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#E2E8F0] border-t-[#2563EB]" />
        <span className="stitch-mono text-[11px] uppercase tracking-[0.08em] text-[#64748B]">{label}</span>
      </div>
      <div className="space-y-2.5">
        <div className="stitch-skeleton h-3 w-2/5" />
        <div className="stitch-skeleton h-8 w-full" style={{ animationDelay: "120ms" }} />
        <div className="stitch-skeleton h-8 w-11/12" style={{ animationDelay: "240ms" }} />
        <div className="stitch-skeleton h-8 w-4/5" style={{ animationDelay: "360ms" }} />
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-gradient-to-br from-white to-rose-50/50 px-5 py-4 shadow-[0_1px_3px_rgba(15,23,42,0.03)]">
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined mt-0.5 text-[20px] text-rose-600" aria-hidden="true">
          error_outline
        </span>
        <div className="min-w-0">
          <p className="stitch-eyebrow !text-rose-700">Load failure</p>
          <p className="mt-1 font-stitch-headline text-[17px] font-semibold text-[#0F172A]">
            Could not load this data
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-[#475569]">
            {message || "An unexpected error occurred."}
          </p>
          {onRetry && (
            <button type="button" onClick={onRetry} className="stitch-btn-secondary mt-3 !text-xs">
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ title = "Nothing to show", description }) {
  return (
    <div className="stitch-empty">
      <div className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-md border border-[#E2E8F0] bg-white text-[#94A3B8] shadow-sm">
        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">inventory_2</span>
      </div>
      <p className="stitch-eyebrow">No records</p>
      <p className="mt-1.5 font-stitch-headline text-[16px] font-semibold text-[#1E293B]">{title}</p>
      {description && (
        <p className="mx-auto mt-1.5 max-w-md text-[12px] leading-relaxed text-[#64748B]">
          {description}
        </p>
      )}
    </div>
  );
}

export function AsyncContent({
  loading,
  error,
  isEmpty = false,
  emptyTitle,
  emptyDescription,
  onRetry,
  children,
}) {
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (isEmpty) return <EmptyState title={emptyTitle} description={emptyDescription} />;
  return children;
}
