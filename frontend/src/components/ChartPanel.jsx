import { Children, cloneElement, isValidElement } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ComposedChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
} from "recharts";

import SectionCard from "./SectionCard.jsx";
import { AsyncContent } from "./StateViews.jsx";

const ANIMATED_TYPES = new Set([
  AreaChart,
  BarChart,
  ComposedChart,
  LineChart,
  PieChart,
  RadarChart,
  ScatterChart,
  Area,
  Bar,
  Line,
  Pie,
  Radar,
  Scatter,
]);

function withStitchAnimation(node, duration) {
  if (!isValidElement(node)) return node;

  const nextProps = {};
  if (ANIMATED_TYPES.has(node.type)) {
    const defaults = {
      isAnimationActive: true,
      animationDuration: duration,
      animationEasing: "ease-out",
    };
    for (const [key, value] of Object.entries(defaults)) {
      if (node.props?.[key] === undefined) nextProps[key] = value;
    }
  }

  if (node.props?.children != null) {
    nextProps.children = Children.map(node.props.children, (child) =>
      withStitchAnimation(child, duration),
    );
  }

  return Object.keys(nextProps).length ? cloneElement(node, nextProps) : node;
}

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
  animationDuration = 900,
  children,
}) {
  const animatedChildren =
    Children.count(children) === 1
      ? withStitchAnimation(Children.toArray(children)[0], animationDuration)
      : Children.map(children, (child) => withStitchAnimation(child, animationDuration));

  return (
    <SectionCard title={title} description={description} actions={actions} className="stitch-glow">
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
            {animatedChildren}
          </ResponsiveContainer>
        </div>
      </AsyncContent>
    </SectionCard>
  );
}
