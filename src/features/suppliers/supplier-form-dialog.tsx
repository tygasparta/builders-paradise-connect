import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Landmark, Loader2, ShieldAlert } from "lucide-react";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/erp/form-field";
import { usePermissions } from "@/lib/auth/use-permission";
import { PERMISSIONS } from "@/lib/permissions/catalog";
import type { SupplierRow } from "@/lib/database.types";
import { PAYMENT_TERMS, supplierDefaults, supplierSchema, type SupplierFormValues } from "./schema";
import { useCreateSupplier, useUpdateSupplier } from "./hooks";

export function SupplierFormDialog({
  open,
  onOpenChange,
  supplier,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier?: SupplierRow | null | undefined;
}) {
  const isEdit = Boolean(supplier);
  const { canAny } = usePermissions();
  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Bank details are what a payment is made against, so they follow the
  // payment permissions rather than plain supplier editing.
  const canSeeBank = canAny([
    PERMISSIONS.SUPPLIER_PAYMENTS_CREATE,
    PERMISSIONS.SUPPLIER_PAYMENTS_APPROVE,
  ]);

  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: supplierDefaults,
  });

  useEffect(() => {
    if (!open) return;
    form.reset(
      supplier
        ? {
            code: supplier.code,
            name: supplier.name,
            trading_name: supplier.trading_name ?? "",
            contact_person: supplier.contact_person ?? "",
            phone: supplier.phone ?? "",
            email: supplier.email ?? "",
            website: supplier.website ?? "",
            address_line1: supplier.address_line1 ?? "",
            address_line2: supplier.address_line2 ?? "",
            city: supplier.city ?? "",
            country: supplier.country,
            tax_number: supplier.tax_number ?? "",
            registration_number: supplier.registration_number ?? "",
            currency_code: supplier.currency_code,
            payment_terms_days: supplier.payment_terms_days,
            credit_limit: supplier.credit_limit === null ? null : Number(supplier.credit_limit),
            opening_balance: Number(supplier.opening_balance),
            bank_name: supplier.bank_name ?? "",
            bank_account_name: supplier.bank_account_name ?? "",
            bank_account_number: supplier.bank_account_number ?? "",
            bank_branch: supplier.bank_branch ?? "",
            swift_code: supplier.swift_code ?? "",
            status: supplier.status,
            notes: supplier.notes ?? "",
          }
        : supplierDefaults,
    );
  }, [open, supplier, form]);

  const submitting = createSupplier.isPending || updateSupplier.isPending;
  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit(async (values) => {
    if (isEdit && supplier) {
      await updateSupplier.mutateAsync({ id: supplier.id, values });
    } else {
      await createSupplier.mutateAsync(values);
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

  return (
    <>
      <Dialog open={open} onOpenChange={requestClose}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{isEdit ? `Edit ${supplier?.name}` : "New supplier"}</DialogTitle>
            <DialogDescription>
              Purchase orders, goods receipts, invoices and payments all reference this record.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} noValidate>
            <Tabs defaultValue="details">
              <TabsList>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="terms">Trading terms</TabsTrigger>
                <TabsTrigger value="banking">Banking</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="mt-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field
                    label="Code"
                    htmlFor="code"
                    required
                    error={errors.code?.message}
                    hint="e.g. LAFARGE"
                  >
                    <Input
                      id="code"
                      className="uppercase"
                      autoFocus={!isEdit}
                      {...form.register("code")}
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field
                      label="Registered name"
                      htmlFor="name"
                      required
                      error={errors.name?.message}
                    >
                      <Input id="name" {...form.register("name")} />
                    </Field>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Trading name"
                    htmlFor="trading_name"
                    error={errors.trading_name?.message}
                  >
                    <Input id="trading_name" {...form.register("trading_name")} />
                  </Field>
                  <Field
                    label="Contact person"
                    htmlFor="contact_person"
                    error={errors.contact_person?.message}
                  >
                    <Input id="contact_person" {...form.register("contact_person")} />
                  </Field>
                  <Field label="Phone" htmlFor="phone" error={errors.phone?.message}>
                    <Input id="phone" type="tel" {...form.register("phone")} />
                  </Field>
                  <Field label="Email" htmlFor="email" error={errors.email?.message}>
                    <Input id="email" type="email" {...form.register("email")} />
                  </Field>
                  <Field label="Website" htmlFor="website" error={errors.website?.message}>
                    <Input id="website" placeholder="https://" {...form.register("website")} />
                  </Field>
                  <Field label="Status" htmlFor="status" required>
                    <Select
                      value={form.watch("status")}
                      onValueChange={(value) =>
                        form.setValue("status", value as SupplierFormValues["status"], {
                          shouldDirty: true,
                        })
                      }
                    >
                      <SelectTrigger id="status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="blocked">Blocked — no new orders</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Address line 1"
                    htmlFor="address_line1"
                    error={errors.address_line1?.message}
                  >
                    <Input id="address_line1" {...form.register("address_line1")} />
                  </Field>
                  <Field
                    label="Address line 2"
                    htmlFor="address_line2"
                    error={errors.address_line2?.message}
                  >
                    <Input id="address_line2" {...form.register("address_line2")} />
                  </Field>
                  <Field label="City" htmlFor="city" error={errors.city?.message}>
                    <Input id="city" {...form.register("city")} />
                  </Field>
                  <Field label="Country" htmlFor="country" required error={errors.country?.message}>
                    <Input id="country" {...form.register("country")} />
                  </Field>
                </div>

                <Field label="Notes" htmlFor="notes" error={errors.notes?.message}>
                  <Textarea id="notes" rows={2} {...form.register("notes")} />
                </Field>
              </TabsContent>

              <TabsContent value="terms" className="mt-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Tax number" htmlFor="tax_number" error={errors.tax_number?.message}>
                    <Input id="tax_number" {...form.register("tax_number")} />
                  </Field>
                  <Field
                    label="Registration number"
                    htmlFor="registration_number"
                    error={errors.registration_number?.message}
                  >
                    <Input id="registration_number" {...form.register("registration_number")} />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <Field
                    label="Currency"
                    htmlFor="currency_code"
                    required
                    error={errors.currency_code?.message}
                  >
                    <Input
                      id="currency_code"
                      maxLength={3}
                      className="uppercase"
                      {...form.register("currency_code")}
                    />
                  </Field>

                  <Field
                    label="Payment terms"
                    htmlFor="payment_terms_days"
                    required
                    error={errors.payment_terms_days?.message}
                    hint="Drives the invoice due date."
                  >
                    <Select
                      value={String(form.watch("payment_terms_days"))}
                      onValueChange={(value) =>
                        form.setValue("payment_terms_days", Number(value), { shouldDirty: true })
                      }
                    >
                      <SelectTrigger id="payment_terms_days">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_TERMS.map((term) => (
                          <SelectItem key={term.days} value={String(term.days)}>
                            {term.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field
                    label="Credit limit"
                    htmlFor="credit_limit"
                    error={errors.credit_limit?.message}
                    hint="Blank for no limit."
                  >
                    <Input
                      id="credit_limit"
                      type="number"
                      step="0.01"
                      min="0"
                      className="num"
                      value={form.watch("credit_limit") ?? ""}
                      onChange={(event) =>
                        form.setValue(
                          "credit_limit",
                          event.target.value === "" ? null : Number(event.target.value),
                          { shouldDirty: true },
                        )
                      }
                    />
                  </Field>
                </div>

                <Field
                  label="Opening balance"
                  htmlFor="opening_balance"
                  error={errors.opening_balance?.message}
                  hint="What was already owed when this supplier was loaded onto the system. The live balance is this plus posted invoices, less payments."
                >
                  <Input
                    id="opening_balance"
                    type="number"
                    step="0.01"
                    className="num"
                    {...form.register("opening_balance")}
                  />
                </Field>
              </TabsContent>

              <TabsContent value="banking" className="mt-4 space-y-4">
                {canSeeBank ? (
                  <>
                    <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-helper text-muted-foreground">
                      <Landmark className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                      <span>
                        Payments are prepared against these details. Changes are recorded in the
                        audit trail with the previous values.
                      </span>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field
                        label="Bank name"
                        htmlFor="bank_name"
                        error={errors.bank_name?.message}
                      >
                        <Input id="bank_name" {...form.register("bank_name")} />
                      </Field>
                      <Field
                        label="Account name"
                        htmlFor="bank_account_name"
                        error={errors.bank_account_name?.message}
                      >
                        <Input id="bank_account_name" {...form.register("bank_account_name")} />
                      </Field>
                      <Field
                        label="Account number"
                        htmlFor="bank_account_number"
                        error={errors.bank_account_number?.message}
                      >
                        <Input
                          id="bank_account_number"
                          className="num"
                          {...form.register("bank_account_number")}
                        />
                      </Field>
                      <Field
                        label="Branch"
                        htmlFor="bank_branch"
                        error={errors.bank_branch?.message}
                      >
                        <Input id="bank_branch" {...form.register("bank_branch")} />
                      </Field>
                      <Field
                        label="SWIFT / BIC"
                        htmlFor="swift_code"
                        error={errors.swift_code?.message}
                      >
                        <Input
                          id="swift_code"
                          className="uppercase"
                          {...form.register("swift_code")}
                        />
                      </Field>
                    </div>
                  </>
                ) : (
                  <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 px-3 py-4 text-td">
                    <ShieldAlert
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <div>
                      <p className="font-medium">Banking details are hidden for your role</p>
                      <p className="mt-1 text-helper text-muted-foreground">
                        They are visible to users who can create or approve supplier payments. The
                        database returns them as empty for everyone else, so they are not simply
                        hidden on screen.
                      </p>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => requestClose(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
                {isEdit ? "Save changes" : "Create supplier"}
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
              You have unsaved changes to this supplier. Closing now will lose them.
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
