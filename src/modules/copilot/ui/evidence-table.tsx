"use client";
import { useMemo, useState } from "react";
import {
  columnLabel,
  formatCell,
  isNumericColumn,
  sortRows,
  type Cell,
} from "../domain/brief";

type Sort = { index: number; direction: 1 | -1 };

/**
 * Compact sortable table. The header stays visible while the body scrolls
 * (about eight rows fit); headers are buttons, so sorting works from the keyboard.
 */
export function EvidenceTable({
  title,
  columns,
  rows,
  visible,
}: {
  title: string;
  columns: string[];
  rows: Cell[][];
  /** Indexes of the columns to show; all when omitted. */
  visible?: number[];
}) {
  const [sort, setSort] = useState<Sort | null>(null);
  const indexes = visible ?? columns.map((_, index) => index);
  const sorted = useMemo(
    () => (sort ? sortRows(rows, sort.index, sort.direction) : rows),
    [rows, sort],
  );
  const numeric = useMemo(
    () => columns.map((_, index) => isNumericColumn(rows, index)),
    [columns, rows],
  );
  function toggle(index: number) {
    setSort((current) =>
      current?.index !== index
        ? { index, direction: 1 }
        : current.direction === 1
          ? { index, direction: -1 }
          : null,
    );
  }
  return (
    <div
      className="evidence-scroll"
      role="region"
      aria-label={`${title}, tabla con desplazamiento`}
      tabIndex={0}
    >
      <table className="evidence-table">
        <caption className="sr-only">{title}</caption>
        <thead>
          <tr>
            {indexes.map((index) => {
              const active = sort?.index === index;
              return (
                <th
                  key={index}
                  scope="col"
                  className={numeric[index] ? "is-numeric" : undefined}
                  aria-sort={
                    active
                      ? sort.direction === 1
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button type="button" onClick={() => toggle(index)}>
                    {columnLabel(columns[index])}
                    <span aria-hidden="true" className="sort-mark">
                      {active ? (sort.direction === 1 ? "↑" : "↓") : "↕"}
                    </span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {indexes.map((index) => {
                const text = formatCell(columns[index], row[index] ?? null);
                return (
                  <td
                    key={index}
                    className={
                      numeric[index]
                        ? "is-numeric"
                        : text.length > 24
                          ? "is-long"
                          : undefined
                    }
                  >
                    {text}
                  </td>
                );
              })}
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={Math.max(1, indexes.length)}>Sin filas.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
