import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ShieldAlert } from "lucide-react";

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
import { useUsers } from "@/features/users/hooks";
import { usePermissions } from "@/lib/auth/use-permission";
import { PERMISSIONS } from "@/lib/permissions/catalog";
import type { CustomerRow } from "@/lib/database.types";
import {
  CUSTOMER_TYPES,
  customerDefaults,
  customerSchema,
  type CustomerFormValues,
} from "./schema";
import { useCreateCustomer, useUpdateCustomer } from "./hooks";

export function CustomerFormDialog({
  open,
  onOpenChange,
  customer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer?: CustomerRow | null | undefined;
}) {
  const isEdit = Boolean(customer);
  const { can } = usePermissions();
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const { data: users } = useUsers();
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Credit terms are a separate authority from editing a name or phone.
  const canSetCredit = can(PERMISSIONS.CUSTOMERS_CREDIT_LIMIT_MANAGE);

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: customerDefaults,
  });

  useEffect(() => {
    if (!open) return;
    form.reset(
      customer
        ? {
            code: customer.code,
            name: customer.name,
            trading_name: customer.trading_name ?? "",
            customer_type: customer.customer_type,
            contact_person: customer.contact_person ?? "",
            phone: customer.phone ?? "",
            email: customer.email ?? "",
            address_line1: customer.address_line1 ?? "",
            address_line2: customer.address_line2 ?? "",
            city: customer.city ?? "",
            country: customer.country,
            tax_number: customer.tax_number ?? "",
            registration_number: customer.registration_number ?? "",
            currency_code: customer.currency_code,
            payment_terms_days: customer.payment_terms_days,
            credit_limit: customer.credit_limit === null ? null : Number(customer.credit_limit),
            opening_balance: Number(customer.opening_balance),
            salesperson_id: customer.salesperson_id,
            status: customer.status,
            notes: customer.notes ?? "",
          }
        : customerDefaults,
    );
  }, [open, customer, form]);

  const submitting = createCustomer.isPending || updateCustomer.isPending;
  const errors = form.formState.errors;
  const creditLimit = form.watch("credit_limit");

  const onSubmit = form.handleSubmit(async (values) => {
    if (isEdit && customer) {
      await updateCustomer.mutateAsync({ id: customer.id, values });
    } else {
      await createCustomer.mutateAsync(values);
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
            <DialogTitle>{isEdit ? `Edit ${customer?.name}` : "New customer"}</DialogTitle>
            <DialogDescription>
              Invoices, receipts and credit notes all reference this record.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} noValidate>
            <Tabs defaultValue="details">
              <TabsList>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="credit">Credit &amp; terms</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="mt-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field
                    label="Code"
                    htmlFor="code"
                    required
                    error={errors.code?.message}
                    hint="e.g. ACME"
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
                      label="Customer name"
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
                  <Field label="Type" htmlFor="customer_type" required>
                    <Select
                      value={form.watch("customer_type")}
                      onValueChange={(v) =>
                        form.setValue("customer_type", v as CustomerFormValues["customer_type"], {
                          shouldDirty: true,
                        })
                      }
                    >
                      <SelectTrigger id="customer_type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CUSTOMER_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                  <Field label="Status" htmlFor="status" required>
                    <Select
                      value={form.watch("status")}
                      onValueChange={(v) =>
                        form.setValue("status", v as CustomerFormValues["status"], {
                          shouldDirty: true,
                        })
                      }
                    >
                      <SelectTrigger id="status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="on_hold">On hold — no new credit</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
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

              <TabsContent value="credit" className="mt-4 space-y-4">
                {!canSetCredit && (
                  <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 px-3 py-3 text-td">
                    <ShieldAlert
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <p className="text-helper text-muted-foreground">
                      Credit limit and payment terms need the &ldquo;Manage credit limits&rdquo;
                      permission. The database refuses the change as well, so these are disabled
                      rather than silently discarded.
                    </p>
                  </div>
                )}

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
                    label="Payment terms (days)"
                    htmlFor="payment_terms_days"
                    required
                    error={errors.payment_terms_days?.message}
                    hint="0 means payment on delivery."
                  >
                    <Input
                      id="payment_terms_days"
                      type="number"
                      min="0"
                      max="365"
                      className="num"
                      disabled={!canSetCredit}
                      {...form.register("payment_terms_days")}
                    />
                  </Field>

                  <Field
                    label="Credit limit"
                    htmlFor="credit_limit"
                    error={errors.credit_limit?.message}
                    hint={
                      creditLimit === null
                        ? "Blank means cash only — no credit sales."
                        : "A sale beyond this needs approval."
                    }
                  >
                    <Input
                      id="credit_limit"
                      type="number"
                      step="0.01"
                      min="0"
                      className="num"
                      disabled={!canSetCredit}
                      value={creditLimit ?? ""}
                      onChange={(e) =>
                        form.setValue(
                          "credit_limit",
                          e.target.value === "" ? null : Number(e.target.value),
                          { shouldDirty: true },
                        )
                      }
                    />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
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
                  <Field
                    label="Opening balance"
                    htmlFor="opening_balance"
                    error={errors.opening_balance?.message}
                    hint="What was already owed when loaded onto the system."
                  >
                    <Input
                      id="opening_balance"
                      type="number"
                      step="0.01"
                      className="num"
                      {...form.register("opening_balance")}
                    />
                  </Field>
                </div>

                <Field label="Assigned salesperson" htmlFor="salesperson_id">
                  <Select
                    value={form.watch("salesperson_id") ?? "none"}
                    onValueChange={(v) =>
                      form.setValue("salesperson_id", v === "none" ? null : v, {
                        shouldDirty: true,
                      })
                    }
                  >
                    <SelectTrigger id="salesperson_id">
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
              </TabsContent>
            </Tabs>

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => requestClose(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
                {isEdit ? "Save changes" : "Create customer"}
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
              You have unsaved changes to this customer. Closing now will lose them.
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
