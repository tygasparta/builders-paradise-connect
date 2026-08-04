import { useEffect, useState, type ReactNode } from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BranchRow } from "@/lib/database.types";
import { branchDefaults, branchSchema, type BranchFormValues } from "./schema";
import { useCreateBranch, useUpdateBranch } from "./hooks";

function Field({
  label,
  htmlFor,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean | undefined;
  error?: string | undefined;
  hint?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function BranchFormDialog({
  open,
  onOpenChange,
  branch,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Omit to create. */
  branch?: BranchRow | null;
}) {
  const isEdit = Boolean(branch);
  const createBranch = useCreateBranch();
  const updateBranch = useUpdateBranch();
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const form = useForm<BranchFormValues>({
    resolver: zodResolver(branchSchema),
    defaultValues: branchDefaults,
  });

  useEffect(() => {
    if (!open) return;
    form.reset(
      branch
        ? {
            code: branch.code,
            name: branch.name,
            is_head_office: branch.is_head_office,
            address_line1: branch.address_line1 ?? "",
            address_line2: branch.address_line2 ?? "",
            city: branch.city ?? "",
            country: branch.country,
            phone: branch.phone ?? "",
            email: branch.email ?? "",
            tax_number: branch.tax_number ?? "",
            currency_code: branch.currency_code,
            status: branch.status,
            notes: branch.notes ?? "",
          }
        : branchDefaults,
    );
  }, [open, branch, form]);

  const submitting = createBranch.isPending || updateBranch.isPending;

  const onSubmit = form.handleSubmit(async (values) => {
    if (isEdit && branch) {
      await updateBranch.mutateAsync({ id: branch.id, values });
    } else {
      await createBranch.mutateAsync(values);
    }
    onOpenChange(false);
  });

  /** Warn before throwing away edits. */
  const requestClose = (next: boolean) => {
    if (!next && form.formState.isDirty && !submitting) {
      setConfirmDiscard(true);
      return;
    }
    onOpenChange(next);
  };

  const errors = form.formState.errors;

  return (
    <>
      <Dialog open={open} onOpenChange={requestClose}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isEdit ? `Edit ${branch?.name}` : "New branch"}</DialogTitle>
            <DialogDescription>
              Branches scope every transaction in the system. The code cannot be reused.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Code" htmlFor="code" required error={errors.code?.message} hint="e.g. HQ, BYO">
                <Input
                  id="code"
                  autoFocus={!isEdit}
                  className="uppercase"
                  aria-invalid={Boolean(errors.code)}
                  {...form.register("code")}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Branch name" htmlFor="name" required error={errors.name?.message}>
                  <Input id="name" aria-invalid={Boolean(errors.name)} {...form.register("name")} />
                </Field>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Address line 1" htmlFor="address_line1" error={errors.address_line1?.message}>
                <Input id="address_line1" {...form.register("address_line1")} />
              </Field>
              <Field label="Address line 2" htmlFor="address_line2" error={errors.address_line2?.message}>
                <Input id="address_line2" {...form.register("address_line2")} />
              </Field>
              <Field label="City" htmlFor="city" error={errors.city?.message}>
                <Input id="city" {...form.register("city")} />
              </Field>
              <Field label="Country" htmlFor="country" required error={errors.country?.message}>
                <Input id="country" {...form.register("country")} />
              </Field>
              <Field label="Phone" htmlFor="phone" error={errors.phone?.message}>
                <Input id="phone" type="tel" {...form.register("phone")} />
              </Field>
              <Field label="Email" htmlFor="email" error={errors.email?.message}>
                <Input id="email" type="email" {...form.register("email")} />
              </Field>
              <Field label="Tax number" htmlFor="tax_number" error={errors.tax_number?.message}>
                <Input id="tax_number" {...form.register("tax_number")} />
              </Field>
              <Field
                label="Currency"
                htmlFor="currency_code"
                required
                error={errors.currency_code?.message}
                hint="3-letter ISO code"
              >
                <Input
                  id="currency_code"
                  maxLength={3}
                  className="uppercase"
                  {...form.register("currency_code")}
                />
              </Field>
            </div>

            <Field label="Notes" htmlFor="notes" error={errors.notes?.message}>
              <Textarea id="notes" rows={2} {...form.register("notes")} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="pr-3">
                  <p className="text-sm font-medium">Head office</p>
                  <p className="text-xs text-muted-foreground">Only one branch can be head office.</p>
                </div>
                <Switch
                  checked={form.watch("is_head_office")}
                  onCheckedChange={(checked) =>
                    form.setValue("is_head_office", checked, { shouldDirty: true })
                  }
                  aria-label="Head office"
                />
              </div>

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

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => requestClose(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
                {isEdit ? "Save changes" : "Create branch"}
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
              You have unsaved changes to this branch. Closing now will lose them.
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
