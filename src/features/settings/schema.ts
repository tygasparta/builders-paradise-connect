import { z } from "zod";

export const companySettingsSchema = z.object({
  company_name: z.string().trim().min(2, "Company name is required").max(160),
  trading_name: z.string().trim().max(160).optional().or(z.literal("")),
  tax_number: z.string().trim().max(60).optional().or(z.literal("")),
  registration_number: z.string().trim().max(60).optional().or(z.literal("")),
  address_line1: z.string().trim().max(160).optional().or(z.literal("")),
  address_line2: z.string().trim().max(160).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  country: z.string().trim().min(2, "Country is required").max(80),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().email("Enter a valid email address").optional().or(z.literal("")),
  website: z
    .string()
    .trim()
    .url("Enter a full URL, e.g. https://example.com")
    .optional()
    .or(z.literal("")),
  logo_url: z.string().trim().url("Enter a full URL").optional().or(z.literal("")),
  base_currency: z
    .string()
    .trim()
    .length(3, "Use a 3-letter currency code")
    .regex(/^[A-Z]{3}$/, "Use a 3-letter currency code, e.g. USD"),
  fiscal_year_start_month: z.coerce.number().int().min(1).max(12),
  date_format: z.string().trim().min(3).max(30),
  // Statutory rates are configuration, never hard-coded in the app.
  default_tax_rate: z.coerce
    .number()
    .min(0, "Tax rate cannot be negative")
    .max(100, "Tax rate cannot exceed 100%"),
  invoice_prefix: z.string().trim().min(1).max(8),
  quotation_prefix: z.string().trim().min(1).max(8),
  receipt_prefix: z.string().trim().min(1).max(8),
  po_prefix: z.string().trim().min(1).max(8),
  grn_prefix: z.string().trim().min(1).max(8),
  adjustment_prefix: z.string().trim().min(1).max(8),
  requisition_prefix: z.string().trim().min(1).max(8),
  journal_prefix: z.string().trim().min(1).max(8),
});

export type CompanySettingsFormValues = z.infer<typeof companySettingsSchema>;

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export function toCompanyPayload(values: CompanySettingsFormValues) {
  const blankToNull = (value: string | undefined) =>
    value === undefined || value.trim() === "" ? null : value.trim();

  return {
    company_name: values.company_name.trim(),
    trading_name: blankToNull(values.trading_name),
    tax_number: blankToNull(values.tax_number),
    registration_number: blankToNull(values.registration_number),
    address_line1: blankToNull(values.address_line1),
    address_line2: blankToNull(values.address_line2),
    city: blankToNull(values.city),
    country: values.country.trim(),
    phone: blankToNull(values.phone),
    email: blankToNull(values.email),
    website: blankToNull(values.website),
    logo_url: blankToNull(values.logo_url),
    base_currency: values.base_currency.trim().toUpperCase(),
    fiscal_year_start_month: values.fiscal_year_start_month,
    date_format: values.date_format.trim(),
    default_tax_rate: values.default_tax_rate,
    invoice_prefix: values.invoice_prefix.trim().toUpperCase(),
    quotation_prefix: values.quotation_prefix.trim().toUpperCase(),
    receipt_prefix: values.receipt_prefix.trim().toUpperCase(),
    po_prefix: values.po_prefix.trim().toUpperCase(),
    grn_prefix: values.grn_prefix.trim().toUpperCase(),
    adjustment_prefix: values.adjustment_prefix.trim().toUpperCase(),
    requisition_prefix: values.requisition_prefix.trim().toUpperCase(),
    journal_prefix: values.journal_prefix.trim().toUpperCase(),
  };
}
