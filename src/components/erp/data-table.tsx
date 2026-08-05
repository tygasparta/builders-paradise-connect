import { useState, type ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { EmptyState, ErrorState, TableSkeleton } from "./states";

/**
 * The standard record table: search, sort, pagination, and the three
 * non-happy states every screen owes the user.
 *
 * Filtering and paging are client-side here because Phase 1 datasets
 * (branches, warehouses, users) are small and bounded. Transactional
 * modules will pass server-paged data in through `data` instead.
 */
export function DataTable<TData>({
  columns,
  data,
  isLoading,
  error,
  onRetry,
  searchPlaceholder = "Search…",
  searchable = true,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  emptyAction,
  pageSize = 15,
  toolbar,
  getRowId,
}: {
  columns: ColumnDef<TData, unknown>[];
  data: TData[] | undefined;
  isLoading?: boolean | undefined;
  error?: unknown;
  onRetry?: (() => void) | undefined;
  searchPlaceholder?: string | undefined;
  searchable?: boolean | undefined;
  emptyTitle?: string | undefined;
  emptyDescription?: string | undefined;
  emptyAction?: ReactNode | undefined;
  pageSize?: number | undefined;
  toolbar?: ReactNode | undefined;
  getRowId?: ((row: TData, index: number) => string) | undefined;
}) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data: data ?? [],
    columns,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
    ...(getRowId ? { getRowId } : {}),
  });

  const rows = table.getRowModel().rows;
  const showToolbar = searchable || toolbar;

  return (
    <div className="card-surface flex flex-col overflow-hidden">
      {showToolbar && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3">
          {searchable ? (
            <div className="relative min-w-0 flex-1 sm:max-w-xs">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={globalFilter}
                onChange={(event) => setGlobalFilter(event.target.value)}
                placeholder={searchPlaceholder}
                className="h-9 pl-8"
                aria-label={searchPlaceholder}
              />
            </div>
          ) : (
            <span />
          )}
          {toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}
        </div>
      )}

      {error ? (
        <ErrorState error={error} {...(onRetry ? { onRetry } : {})} />
      ) : isLoading ? (
        <TableSkeleton columns={columns.length} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={data && data.length > 0 ? "No matches" : emptyTitle}
          description={
            data && data.length > 0
              ? "No records match your search. Try a different term."
              : emptyDescription
          }
          action={data && data.length > 0 ? undefined : emptyAction}
        />
      ) : (
        <div className="table-scroll">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent">
                  {headerGroup.headers.map((header) => {
                    const sortable = header.column.getCanSort();
                    const sorted = header.column.getIsSorted();
                    return (
                      <TableHead
                        key={header.id}
                        className="h-10 whitespace-nowrap text-helper font-semibold uppercase tracking-wider text-muted-foreground"
                        aria-sort={
                          sorted === "asc"
                            ? "ascending"
                            : sorted === "desc"
                              ? "descending"
                              : sortable
                                ? "none"
                                : undefined
                        }
                      >
                        {header.isPlaceholder ? null : sortable ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className="-mx-1 inline-flex items-center gap-1 rounded-sm px-1 py-0.5 transition-colors hover:text-foreground"
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {sorted === "asc" ? (
                              <ArrowUp className="size-3" />
                            ) : sorted === "desc" ? (
                              <ArrowDown className="size-3" />
                            ) : (
                              <ChevronsUpDown className="size-3 opacity-40" />
                            )}
                          </button>
                        ) : (
                          flexRender(header.column.columnDef.header, header.getContext())
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} className="border-border">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-2.5 text-td">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {!error && !isLoading && table.getPageCount() > 1 && (
        <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-2.5">
          <p className="text-helper text-muted-foreground">
            Page <span className="num">{table.getState().pagination.pageIndex + 1}</span> of{" "}
            <span className="num">{table.getPageCount()}</span> ·{" "}
            <span className="num">{table.getFilteredRowModel().rows.length}</span> records
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Consistent status chip used across every module table. */
export function StatusBadge({ status }: { status: string }) {
  const tone: Record<string, string> = {
    active: "bg-success/12 text-success",
    inactive: "bg-muted text-muted-foreground",
    invited: "bg-info/12 text-info",
    suspended: "bg-warning/20 text-warning-foreground",
    locked: "bg-destructive/12 text-destructive",
  };
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-helper font-semibold",
        tone[status] ?? "bg-muted text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}
