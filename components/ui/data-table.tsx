'use client';

import { useState, useMemo, useCallback } from 'react';
import { Search, ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { LoadingState } from './loading-state';
import { EmptyState } from './empty-state';
import type { LucideIcon } from 'lucide-react';

/* ============================================================
   TYPES
   ============================================================ */

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T, index: number) => React.ReactNode;
  sortable?: boolean;
  width?: string;
  hideOnMobile?: boolean;
  align?: 'left' | 'center' | 'right';
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  keyField?: string;
  emptyIcon?: LucideIcon;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: { label: string; onClick: () => void };
  onRowClick?: (row: T) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  pageSize?: number;
  sortable?: boolean;
  className?: string;
  headerActions?: React.ReactNode;
}

type SortDirection = 'asc' | 'desc' | null;

/* ============================================================
   COMPONENT
   ============================================================ */

/**
 * DataTable — Progressive disclosure INDEX layer.
 * 
 * Shows compact rows. Click row → opens detail (handled by parent via onRowClick).
 * Skeleton loading during fetch. EmptyState when 0 records.
 * Responsive: card layout on mobile (<768px).
 * 
 * Usage:
 *   <DataTable
 *     columns={[
 *       { key: 'uhid', header: 'UHID', sortable: true },
 *       { key: 'name', header: 'Patient Name', sortable: true },
 *       { key: 'age', header: 'Age', render: (r) => `${r.age}y/${r.gender}` },
 *       { key: 'phone', header: 'Phone', hideOnMobile: true },
 *     ]}
 *     data={patients}
 *     loading={isLoading}
 *     onRowClick={(p) => router.push(`/patients/${p.id}`)}
 *     searchable
 *     emptyTitle="No patients registered yet"
 *     emptyAction={{ label: "Register Patient", onClick: () => router.push('/patients/register') }}
 *   />
 */
export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  keyField = 'id',
  emptyIcon,
  emptyTitle = 'No records found',
  emptyDescription,
  emptyAction,
  onRowClick,
  searchable = false,
  searchPlaceholder = 'Search...',
  pageSize = 25,
  sortable = true,
  className = '',
  headerActions,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);
  const [page, setPage] = useState(1);

  // ---- SEARCH ----
  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter((row) =>
      columns.some((col) => {
        const val = row[col.key];
        return val != null && String(val).toLowerCase().includes(q);
      })
    );
  }, [data, search, columns]);

  // ---- SORT ----
  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return filtered;
    return [...filtered].sort((a, b) => {
      const aVal = a[sortKey] ?? '';
      const bVal = b[sortKey] ?? '';
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  // ---- PAGINATION ----
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);
  const showingFrom = sorted.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const showingTo = Math.min(safePage * pageSize, sorted.length);

  const handleSort = useCallback((key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc'));
      if (sortDir === 'desc') setSortKey(null);
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  }, [sortKey, sortDir]);

  // ---- LOADING ----
  if (loading) {
    return (
      <div className={`h1-card p-h1-md ${className}`}>
        {searchable && (
          <div className="mb-h1-md">
            <div className="h1-skeleton h-10 w-full max-w-sm rounded-h1" />
          </div>
        )}
        <LoadingState variant="table" rows={pageSize > 10 ? 10 : pageSize} delay={0} />
      </div>
    );
  }

  // ---- EMPTY ----
  if (data.length === 0 && !search) {
    return (
      <div className={`h1-card ${className}`}>
        <EmptyState
          icon={emptyIcon}
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      </div>
    );
  }

  return (
    <div className={`h1-card overflow-hidden ${className}`}>
      {/* Toolbar: Search + Header Actions */}
      {(searchable || headerActions) && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-h1-border">
          {searchable && (
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-h1-text-muted" aria-hidden="true" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder={searchPlaceholder}
                className="
                  w-full pl-9 pr-3 py-2 rounded-h1 border border-h1-border text-h1-body
                  placeholder:text-h1-text-muted bg-white
                  focus:outline-none focus:ring-2 focus:ring-h1-teal/30 focus:border-transparent
                  transition-colors duration-h1-fast
                "
              />
            </div>
          )}
          {headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
        </div>
      )}

      {/* Search returned 0 results */}
      {filtered.length === 0 && search && (
        <EmptyState
          title={`No results for "${search}"`}
          description="Try a different search term."
        />
      )}

      {/* TABLE — Desktop (≥768px) */}
      {filtered.length > 0 && (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-h1-border bg-gray-50/60">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={`
                        px-4 py-3 text-h1-small font-medium text-h1-text-secondary text-left
                        ${col.hideOnMobile ? 'hidden lg:table-cell' : ''}
                        ${col.sortable && sortable ? 'cursor-pointer select-none hover:text-h1-text transition-colors' : ''}
                        ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''}
                      `}
                      style={col.width ? { width: col.width } : undefined}
                      onClick={() => col.sortable && sortable && handleSort(col.key)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.header}
                        {col.sortable && sortable && (
                          <SortIndicator active={sortKey === col.key} direction={sortKey === col.key ? sortDir : null} />
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map((row, i) => (
                  <tr
                    key={row[keyField] ?? i}
                    className={`
                      border-b border-h1-border last:border-b-0
                      ${onRowClick ? 'cursor-pointer hover:bg-h1-navy-light transition-colors duration-h1-fast' : ''}
                    `}
                    onClick={() => onRowClick?.(row)}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`
                          px-4 py-3 text-h1-body
                          ${col.hideOnMobile ? 'hidden lg:table-cell' : ''}
                          ${col.align === 'right' ? 'text-right tabular-nums' : col.align === 'center' ? 'text-center' : ''}
                        `}
                      >
                        {col.render ? col.render(row, i) : row[col.key] ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* CARD LAYOUT — Mobile (<768px) */}
          <div className="md:hidden divide-y divide-h1-border">
            {paged.map((row, i) => (
              <div
                key={row[keyField] ?? i}
                className={`
                  px-4 py-3 space-y-1.5
                  ${onRowClick ? 'cursor-pointer hover:bg-h1-navy-light transition-colors duration-h1-fast' : ''}
                `}
                onClick={() => onRowClick?.(row)}
              >
                {columns.filter((c) => !c.hideOnMobile).map((col) => (
                  <div key={col.key} className="flex justify-between items-baseline gap-2">
                    <span className="text-h1-small text-h1-text-secondary flex-shrink-0">{col.header}</span>
                    <span className="text-h1-body text-h1-text text-right">
                      {col.render ? col.render(row, i) : row[col.key] ?? '—'}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Pagination Footer */}
          {sorted.length > pageSize && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-h1-border bg-gray-50/60 text-h1-small text-h1-text-secondary">
              <span>
                Showing {showingFrom}–{showingTo} of {sorted.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="p-1.5 rounded-h1-sm hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 tabular-nums">
                  {safePage} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="p-1.5 rounded-h1-sm hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ============================================================
   SORT INDICATOR
   ============================================================ */

function SortIndicator({ active, direction }: { active: boolean; direction: SortDirection }) {
  if (!active || !direction) {
    return <ChevronsUpDown className="w-3.5 h-3.5 opacity-30" />;
  }
  return direction === 'asc'
    ? <ChevronUp className="w-3.5 h-3.5 text-h1-teal" />
    : <ChevronDown className="w-3.5 h-3.5 text-h1-teal" />;
}
