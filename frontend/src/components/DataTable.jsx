import { formatValue } from "../utils/format.js";
import { EmptyState } from "./StateViews.jsx";

export default function DataTable({
  columns,
  rows = [],
  rowKey,
  onRowClick,
  emptyTitle = "No records found",
  emptyDescription,
  className = "",
}) {
  const list = Array.isArray(rows) ? rows : [];

  if (!list.length) return <EmptyState title={emptyTitle} description={emptyDescription} />;

  return (
    <div className={`overflow-x-auto rounded-lg border border-[#E2E8F0] bg-white shadow-[0_1px_3px_0_rgba(15,23,42,0.03)] ${className}`}>
      <table className="stitch-table min-w-[640px] text-sm">
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th key={column.key ?? column.header ?? index} scope="col">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {list.map((row, index) => {
            const key = rowKey ? rowKey(row, index) : row?.id ?? index;
            return (
              <tr
                key={key}
                style={{ "--stitch-index": Math.min(index, 14) }}
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
                className={onRowClick ? "cursor-pointer" : undefined}
              >
                {columns.map((column, columnIndex) => (
                  <td
                    key={column.key ?? column.header ?? columnIndex}
                    className={column.className ?? ""}
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
