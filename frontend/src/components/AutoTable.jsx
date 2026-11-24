import { formatMetric, humanize } from "../utils/format.js";
import DataTable from "./DataTable.jsx";

/** Table for API objects whose shape is not fully known (e.g. summary.sources). */
export default function AutoTable({ rows, emptyTitle = "No rows to display" }) {
  const list = Array.isArray(rows) ? rows : [];
  const keys = [
    ...new Set(
      list.flatMap((row) => (row && typeof row === "object" ? Object.keys(row) : [])),
    ),
  ];

  const columns = keys.map((key) => ({
    key,
    header: humanize(key),
    render: (row) => (
      <span className="block max-w-xs truncate" title={formatMetric(key, row[key])}>
        {formatMetric(key, row[key])}
      </span>
    ),
  }));

  if (!columns.length && list.length) {
    columns.push({
      header: "Value",
      render: (row) => String(row ?? "—"),
    });
  }

  return <DataTable columns={columns} rows={list} emptyTitle={emptyTitle} />;
}
