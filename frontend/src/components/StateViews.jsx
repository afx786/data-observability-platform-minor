export function LoadingState({ label = "Loading data…" }) {
  return (
    <div className="flex items-center gap-3 py-10 text-sm text-slate-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <p className="font-medium">Could not load this data</p>
      <p className="mt-1 text-xs">{message || "An unexpected error occurred."}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-md border border-red-300 bg-white px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title = "Nothing to show", description }) {
  return (
    <div className="rounded-md border border-dashed border-slate-300 bg-slate-50/60 px-4 py-10 text-center">
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">{description}</p>}
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
