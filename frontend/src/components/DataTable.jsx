import { formatValue } from "../utils/format.js";
import { EmptyState } from "./StateViews.jsx";

export default function DataTable({
  columns,
  rows = [],
  rowKey,
  onRowClick,
  emptyTitle = "No records found",
  emptyDescription,
}) {
  const list = Array.isArray(rows) ? rows : [];

  if (!list.length) return <EmptyState title={emptyTitle} description={emptyDescription} />;

  return (
    <div className="overflow-x-auto rounded-md border border-slate-200">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {columns.map((column, index) => (
              <th key={column.key ?? column.header ?? index} className="px-3 py-2 font-medium">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {list.map((row, index) => {
            const key = rowKey ? rowKey(row, index) : row?.id ?? index;
            return (
              <tr
                key={key}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={
                  onRowClick
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
                tabIndex={onRowClick ? 0 : undefined}
                className={`${onRowClick ? "cursor-pointer hover:bg-slate-50 focus:bg-slate-50 focus:outline-none" : ""}`}
              >
                {columns.map((column, columnIndex) => (
                  <td
                    key={column.key ?? column.header ?? columnIndex}
                    className={`px-3 py-2 align-top text-slate-700 ${column.className ?? ""}`}
                  >
                    {column.render
                      ? column.render(row, index)
                      : formatValue(column.key ? row?.[column.key] : undefined)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
