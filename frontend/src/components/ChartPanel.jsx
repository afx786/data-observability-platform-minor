import { ResponsiveContainer } from "recharts";

import SectionCard from "./SectionCard.jsx";
import { AsyncContent } from "./StateViews.jsx";

export default function ChartPanel({
  title,
  description,
  actions,
  loading,
  error,
  isEmpty = false,
  emptyTitle = "No data for this chart",
  emptyDescription,
  onRetry,
  height = 260,
  children,
}) {
  return (
    <SectionCard title={title} description={description} actions={actions}>
      <AsyncContent
        loading={loading}
        error={error}
        isEmpty={isEmpty}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        onRetry={onRetry}
      >
        <div className="w-full" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        </div>
      </AsyncContent>
    </SectionCard>
  );
}
