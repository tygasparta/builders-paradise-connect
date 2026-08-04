import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";

import { PageHeader } from "@/components/erp/page-header";
import { RequirePermission } from "@/components/erp/permission-gate";
import { CardsSkeleton, ErrorState } from "@/components/erp/states";
import { Field } from "@/components/erp/form-field";
import { SectionCard } from "@/components/erp/ui-kit";
import { BrandMark } from "@/components/erp/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCompanySettings, useUpdateCompanySettings } from "@/features/settings/hooks";
import {
  MONTHS,
  companySettingsSchema,
  type CompanySettingsFormValues,
} from "@/features/settings/schema";
import { PERMISSIONS } from "@/lib/permissions/catalog";

export const Route = createFileRoute("/_app/settings/company")({
  component: CompanySettingsPage,
});

function CompanySettingsPage() {
  return (
    <RequirePermission require={PERMISSIONS.SETTINGS_COMPANY_MANAGE} what="company settings">
      <CompanySettingsScreen />
    </RequirePermission>
  );
}

function CompanySettingsScreen() {
  const settings = useCompanySettings();
  const save = useUpdateCompanySettings();

  const form = useForm<CompanySettingsFormValues>({
    resolver: zodResolver(companySettingsSchema),
    defaultValues: {
      company_name: "",
      trading_name: "",
      tax_number: "",
      registration_number: "",
      address_line1: "",
      address_line2: "",
      city: "",
      country: "Zimbabwe",
      phone: "",
      email: "",
      website: "",
      logo_url: "",
      base_currency: "USD",
      fiscal_year_start_month: 1,
      date_format: "dd MMM yyyy",
      default_tax_rate: 0,
      invoice_prefix: "INV",
      quotation_prefix: "QTE",
      receipt_prefix: "RCT",
      po_prefix: "PO",
      grn_prefix: "GRN",
      adjustment_prefix: "ADJ",
      requisition_prefix: "REQ",
      journal_prefix: "JNL",
    },
  });

  useEffect(() => {
    const data = settings.data;
    if (!data) return;
    form.reset({
      company_name: data.company_name,
      trading_name: data.trading_name ?? "",
      tax_number: data.tax_number ?? "",
      registration_number: data.registration_number ?? "",
      address_line1: data.address_line1 ?? "",
      address_line2: data.address_line2 ?? "",
      city: data.city ?? "",
      country: data.country,
      phone: data.phone ?? "",
      email: data.email ?? "",
      website: data.website ?? "",
      logo_url: data.logo_url ?? "",
      base_currency: data.base_currency,
      fiscal_year_start_month: data.fiscal_year_start_month,
      date_format: data.date_format,
      default_tax_rate: Number(data.default_tax_rate),
      invoice_prefix: data.invoice_prefix,
      quotation_prefix: data.quotation_prefix,
      receipt_prefix: data.receipt_prefix,
      po_prefix: data.po_prefix,
      grn_prefix: data.grn_prefix,
      adjustment_prefix: data.adjustment_prefix,
      requisition_prefix: data.requisition_prefix,
      journal_prefix: data.journal_prefix,
    });
  }, [settings.data, form]);

  const errors = form.formState.errors;
  const onSubmit = form.handleSubmit(async (values) => {
    await save.mutateAsync(values);
    form.reset(values); // clears the dirty flag
  });

  if (settings.isLoading) return <CardsSkeleton count={3} />;
  if (settings.isError) {
    return (
      <div className="card-surface">
        <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <PageHeader
        title="Company settings"
        description="Company identity, financial defaults and document numbering used across every module."
        breadcrumbs={[{ label: "Settings" }, { label: "Company" }]}
        actions={
          <Button type="submit" disabled={save.isPending || !form.formState.isDirty}>
            {save.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Save className="size-4" aria-hidden />
            )}
            Save changes
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Identity" description="Appears on every document you issue">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <BrandMark logoUrl={form.watch("logo_url") || null} className="size-12" />
              <div className="min-w-0 flex-1">
                <Field
                  label="Logo URL"
                  htmlFor="logo_url"
                  error={errors.logo_url?.message}
                  hint="Upload to Supabase Storage and paste the public URL. Blank uses the placeholder mark."
                >
                  <Input id="logo_url" {...form.register("logo_url")} />
                </Field>
              </div>
            </div>

            <Field
              label="Registered name"
              htmlFor="company_name"
              required
              error={errors.company_name?.message}
            >
              <Input id="company_name" {...form.register("company_name")} />
            </Field>

            <Field label="Trading name" htmlFor="trading_name" error={errors.trading_name?.message}>
              <Input id="trading_name" {...form.register("trading_name")} />
            </Field>

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
          </div>
        </SectionCard>

        <SectionCard title="Contact" description="Where customers and suppliers reach you">
          <div className="space-y-4">
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
            <div className="grid gap-4 sm:grid-cols-2">
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
            </div>
            <Field label="Website" htmlFor="website" error={errors.website?.message}>
              <Input id="website" placeholder="https://" {...form.register("website")} />
            </Field>
          </div>
        </SectionCard>

        <SectionCard
          title="Financial defaults"
          description="Statutory and accounting settings — configurable, never hard-coded"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Base currency"
              htmlFor="base_currency"
              required
              error={errors.base_currency?.message}
            >
              <Input
                id="base_currency"
                maxLength={3}
                className="uppercase"
                {...form.register("base_currency")}
              />
            </Field>

            <Field
              label="Financial year starts"
              htmlFor="fiscal_year_start_month"
              required
              error={errors.fiscal_year_start_month?.message}
            >
              <Select
                value={String(form.watch("fiscal_year_start_month"))}
                onValueChange={(value) =>
                  form.setValue("fiscal_year_start_month", Number(value), { shouldDirty: true })
                }
              >
                <SelectTrigger id="fiscal_year_start_month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month, index) => (
                    <SelectItem key={month} value={String(index + 1)}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label="Default tax rate (%)"
              htmlFor="default_tax_rate"
              required
              error={errors.default_tax_rate?.message}
              hint="Applied to new lines; each product can override it."
            >
              <Input
                id="default_tax_rate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                className="num"
                {...form.register("default_tax_rate")}
              />
            </Field>

            <Field
              label="Date format"
              htmlFor="date_format"
              required
              error={errors.date_format?.message}
            >
              <Input id="date_format" {...form.register("date_format")} />
            </Field>
          </div>
        </SectionCard>

        <SectionCard
          title="Document numbering"
          description="Prefixes for the reference numbers each module generates"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["invoice_prefix", "Sales invoice"],
                ["quotation_prefix", "Quotation"],
                ["receipt_prefix", "Customer receipt"],
                ["po_prefix", "Purchase order"],
                ["grn_prefix", "Goods received note"],
                ["adjustment_prefix", "Stock adjustment"],
                ["requisition_prefix", "Requisition"],
                ["journal_prefix", "Journal"],
              ] as const
            ).map(([name, label]) => (
              <Field key={name} label={label} htmlFor={name} required error={errors[name]?.message}>
                <Input id={name} maxLength={8} className="uppercase" {...form.register(name)} />
              </Field>
            ))}
          </div>
        </SectionCard>
      </div>

      {form.formState.isDirty && (
        <div className="sticky bottom-4 mt-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-raised">
          <p className="text-sm text-muted-foreground">You have unsaved changes.</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => form.reset()}>
              Discard
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Save changes
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}
