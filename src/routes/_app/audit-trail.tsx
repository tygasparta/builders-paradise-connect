import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { ScrollText, Search } from "lucide-react";

import { PageHeader } from "@/components/erp/page-header";
import { RequirePermission } from "@/components/erp/permission-gate";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/erp/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuditLogs } from "@/features/audit/hooks";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { MODULE_LABELS, PERMISSIONS } from "@/lib/permissions/catalog";
import type { AuditLogRow } from "@/lib/database.types";

export const Route = createFileRoute("/_app/audit-trail")({
  component: AuditTrailPage,
});

const ACTIONS = [
  "insert", "update", "delete", "login", "login_failed", "logout",
  "approve", "reject", "post", "reverse", "export", "print",
] as const;

const PAGE_SIZE = 25;

function AuditTrailPage() {
  return (
    <RequirePermission require={PERMISSIONS.AUDIT_VIEW} what="the audit trail">
      <AuditTrailScreen />
    </RequirePermission>
  );
}

function AuditTrailScreen() {
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 300);
  const [moduleFilter, setModuleFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [inspecting, setInspecting] = useState<AuditLogRow | null>(null);

  // A new search term always starts back at the first page.
  useEffect(() => {
    setPage(0);
  }, [debounced]);

  const logs = useAuditLogs({
    page,
    pageSize: PAGE_SIZE,
    ...(debounced ? { search: debounced } : {}),
    ...(moduleFilter !== "all" ? { module: moduleFilter } : {}),
    ...(actionFilter !== "all" ? { action: actionFilter } : {}),
  });

  const total = logs.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Audit trail"
        description="Every change, who made it and what it was before. Append-only — nobody can edit or delete these records."
        breadcrumbs={[{ label: "Control" }, { label: "Audit trail" }]}
      />

      <div className="card-surface overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-3">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by user, table or record…"
              className="h-9 pl-8"
              aria-label="Search the audit trail"
            />
          </div>

          <Select
            value={moduleFilter}
            onValueChange={(value) => {
              setModuleFilter(value);
              setPage(0);
            }}
          >
            <SelectTrigger className="h-9 w-40" aria-label="Filter by module">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All modules</SelectItem>
              {Object.entries(MODULE_LABELS).map(([code, label]) => (
                <SelectItem key={code} value={code}>
                  {label}
                </SelectItem>
              ))}
              <SelectItem value="auth">Authentication</SelectItem>
              <SelectItem value="settings">Settings</SelectItem>
              <SelectItem value="users">Users</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={actionFilter}
            onValueChange={(value) => {
              setActionFilter(value);
              setPage(0);
            }}
          >
            <SelectTrigger className="h-9 w-36" aria-label="Filter by action">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {ACTIONS.map((action) => (
                <SelectItem key={action} value={action}>
                  {action.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {logs.isError ? (
          <ErrorState error={logs.error} onRetry={() => void logs.refetch()} />
        ) : logs.isLoading ? (
          <TableSkeleton columns={5} rows={8} />
        ) : (logs.data?.rows.length ?? 0) === 0 ? (
          <EmptyState
            icon={<ScrollText className="size-5" />}
            title="No matching activity"
            description="Nothing has been recorded for these filters yet."
          />
        ) : (
          <div className="table-scroll">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-10 text-[11px] uppercase tracking-wider">When</TableHead>
                  <TableHead className="h-10 text-[11px] uppercase tracking-wider">Who</TableHead>
                  <TableHead className="h-10 text-[11px] uppercase tracking-wider">Action</TableHead>
                  <TableHead className="h-10 text-[11px] uppercase tracking-wider">Module</TableHead>
                  <TableHead className="h-10 text-[11px] uppercase tracking-wider">Record</TableHead>
                  <TableHead className="h-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.data?.rows.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="num whitespace-nowrap py-2.5 text-xs text-muted-foreground">
                      {format(new Date(entry.created_at), "dd MMM yyyy HH:mm:ss")}
                    </TableCell>
                    <TableCell className="py-2.5 text-sm">
                      {entry.user_email ?? <span className="text-muted-foreground">System</span>}
                    </TableCell>
                    <TableCell className="py-2.5">
                      <ActionBadge action={entry.action} />
                    </TableCell>
                    <TableCell className="py-2.5 text-sm text-muted-foreground">
                      {MODULE_LABELS[entry.module] ?? entry.module}
                    </TableCell>
                    <TableCell className="py-2.5 text-sm">
                      {entry.table_name ? (
                        <span className="font-mono text-xs">{entry.table_name}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2.5 text-right">
                      {(entry.old_value || entry.new_value) && (
                        <Button variant="ghost" size="sm" onClick={() => setInspecting(entry)}>
                          View change
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {!logs.isLoading && !logs.isError && total > PAGE_SIZE && (
          <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-2.5">
            <p className="text-xs text-muted-foreground">
              Page <span className="num">{page + 1}</span> of{" "}
              <span className="num">{pageCount}</span> · <span className="num">{total}</span> events
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => Math.max(0, current - 1))}
                disabled={page === 0}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => current + 1)}
                disabled={page + 1 >= pageCount}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      <ChangeDialog entry={inspecting} onOpenChange={(open) => !open && setInspecting(null)} />
    </>
  );
}

function ActionBadge({ action }: { action: string }) {
  const tone: Record<string, string> = {
    insert: "bg-success/12 text-success",
    update: "bg-info/12 text-info",
    delete: "bg-destructive/12 text-destructive",
    login: "bg-muted text-muted-foreground",
    logout: "bg-muted text-muted-foreground",
    login_failed: "bg-destructive/12 text-destructive",
    approve: "bg-success/12 text-success",
    reject: "bg-destructive/12 text-destructive",
    post: "bg-primary/12 text-primary",
    reverse: "bg-warning/20 text-warning-foreground",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        tone[action] ?? "bg-muted text-muted-foreground"
      }`}
    >
      {action.replace(/_/g, " ")}
    </span>
  );
}

/** Shows only the fields that actually changed. */
function ChangeDialog({
  entry,
  onOpenChange,
}: {
  entry: AuditLogRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const oldValue = (entry?.old_value ?? {}) as Record<string, unknown>;
  const newValue = (entry?.new_value ?? {}) as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(oldValue), ...Object.keys(newValue)])]
    .filter((key) => JSON.stringify(oldValue[key]) !== JSON.stringify(newValue[key]))
    .sort();

  return (
    <Dialog open={Boolean(entry)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>What changed</DialogTitle>
          <DialogDescription>
            {entry?.user_email ?? "System"} · {entry?.table_name} ·{" "}
            {entry && format(new Date(entry.created_at), "dd MMM yyyy HH:mm:ss")}
          </DialogDescription>
        </DialogHeader>

        {keys.length === 0 ? (
          <p className="text-sm text-muted-foreground">No field-level differences recorded.</p>
        ) : (
          <div className="table-scroll">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-[11px] uppercase">Field</TableHead>
                  <TableHead className="text-[11px] uppercase">Before</TableHead>
                  <TableHead className="text-[11px] uppercase">After</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key}>
                    <TableCell className="py-2 font-mono text-xs">{key}</TableCell>
                    <TableCell className="py-2 text-xs text-muted-foreground">
                      {formatValue(oldValue[key])}
                    </TableCell>
                    <TableCell className="py-2 text-xs">
                      <Badge variant="secondary" className="font-mono text-[10px]">
                        {formatValue(newValue[key])}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
