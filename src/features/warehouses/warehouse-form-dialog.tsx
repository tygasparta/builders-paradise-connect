import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/erp/form-field";
import { useBranches } from "@/features/branches/hooks";
import { useUsers } from "@/features/users/hooks";
import { usePermissions } from "@/lib/auth/use-permission";
import { PERMISSIONS } from "@/lib/permissions/catalog";
import type { WarehouseRow } from "@/lib/database.types";
import {
  WAREHOUSE_TYPES,
  warehouseDefaults,
  warehouseSchema,
  type WarehouseFormValues,
} from "./schema";
import { useCreateWarehouse, useUpdateWarehouse } from "./hooks";

export function WarehouseFormDialog({
  open,
  onOpenChange,
  warehouse,
  defaultBranchId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouse?: WarehouseRow | null | undefined;
  defaultBranchId?: string | null | undefined;
}) {
  const isEdit = Boolean(warehouse);
  const createWarehouse = useCreateWarehouse();
  const updateWarehouse = useUpdateWarehouse();
  const { data: branches } = useBranches();
  const { data: users } = useUsers();
  const { can } = usePermissions();
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const form = useForm<WarehouseFormValues>({
    resolver: zodResolver(warehouseSchema),
    defaultValues: warehouseDefaults,
  });

  useEffect(() => {
    if (!open) return;
    form.reset(
      warehouse
        ? {
            code: warehouse.code,
            name: warehouse.name,
            branch_id: warehouse.branch_id,
            type: warehouse.type,
            manager_id: warehouse.manager_id,
            address: warehouse.address ?? "",
            status: warehouse.status,
            is_default: warehouse.is_default,
            allow_negative_stock: warehouse.allow_negative_stock,
            notes: warehouse.notes ?? "",
          }
        : { ...warehouseDefaults, branch_id: defaultBranchId ?? "" },
    );
  }, [open, warehouse, defaultBranchId, form]);

  const submitting = createWarehouse.isPending || updateWarehouse.isPending;
  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit(async (values) => {
    if (isEdit && warehouse) {
      await updateWarehouse.mutateAsync({ id: warehouse.id, values });
    } else {
      await createWarehouse.mutateAsync(values);
    }
    onOpenChange(false);
  });

  const requestClose = (next: boolean) => {
    if (!next && form.formState.isDirty && !submitting) {
      setConfirmDiscard(true);
      return;
    }
    onOpenChange(next);
  };

  const selectedType = form.watch("type");
  const typeHint = WAREHOUSE_TYPES.find((option) => option.value === selectedType)?.hint;

  return (
    <>
      <Dialog open={open} onOpenChange={requestClose}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isEdit ? `Edit ${warehouse?.name}` : "New warehouse"}</DialogTitle>
            <DialogDescription>
              Stock lives in a warehouse. Every movement records which one it came from and went to.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                label="Code"
                htmlFor="code"
                required
                error={errors.code?.message}
                hint="e.g. HQ-MAIN"
              >
                <Input
                  id="code"
                  autoFocus={!isEdit}
                  className="uppercase"
                  {...form.register("code")}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Warehouse name" htmlFor="name" required error={errors.name?.message}>
                  <Input id="name" {...form.register("name")} />
                </Field>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Branch" htmlFor="branch_id" required error={errors.branch_id?.message}>
                <Select
                  value={form.watch("branch_id")}
                  onValueChange={(value) =>
                    form.setValue("branch_id", value, { shouldDirty: true })
                  }
                >
                  <SelectTrigger id="branch_id">
                    <SelectValue placeholder="Choose a branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches?.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field
                label="Type"
                htmlFor="type"
                required
                error={errors.type?.message}
                hint={typeHint}
              >
                <Select
                  value={selectedType}
                  onValueChange={(value) =>
                    form.setValue("type", value as WarehouseFormValues["type"], {
                      shouldDirty: true,
                    })
                  }
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WAREHOUSE_TYPES.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Manager" htmlFor="manager_id" error={errors.manager_id?.message}>
                <Select
                  value={form.watch("manager_id") ?? "none"}
                  onValueChange={(value) =>
                    form.setValue("manager_id", value === "none" ? null : value, {
                      shouldDirty: true,
                    })
                  }
                >
                  <SelectTrigger id="manager_id">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {users?.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Status" htmlFor="status" required>
                <Select
                  value={form.watch("status")}
                  onValueChange={(value) =>
                    form.setValue("status", value as "active" | "inactive", { shouldDirty: true })
                  }
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field label="Address" htmlFor="address" error={errors.address?.message}>
              <Input id="address" {...form.register("address")} />
            </Field>

            <Field label="Notes" htmlFor="notes" error={errors.notes?.message}>
              <Textarea id="notes" rows={2} {...form.register("notes")} />
            </Field>

            <div className="space-y-3 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Default for this branch</p>
                  <p className="text-xs text-muted-foreground">
                    Pre-selected on receipts, sales and transfers. One per branch.
                  </p>
                </div>
                <Switch
                  checked={form.watch("is_default")}
                  onCheckedChange={(checked) =>
                    form.setValue("is_default", checked, { shouldDirty: true })
                  }
                  aria-label="Default for this branch"
                />
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                <div>
                  <p className="text-sm font-medium">Allow negative stock</p>
                  <p className="text-xs text-muted-foreground">
                    Off by default. Even when on, the acting user still needs the &ldquo;Allow
                    negative stock&rdquo; permission.
                  </p>
                </div>
                <Switch
                  checked={form.watch("allow_negative_stock")}
                  disabled={!can(PERMISSIONS.INVENTORY_NEGATIVE_STOCK_ALLOW)}
                  onCheckedChange={(checked) =>
                    form.setValue("allow_negative_stock", checked, { shouldDirty: true })
                  }
                  aria-label="Allow negative stock"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => requestClose(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
                {isEdit ? "Save changes" : "Create warehouse"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard your changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes to this warehouse. Closing now will lose them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDiscard(false);
                onOpenChange(false);
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
