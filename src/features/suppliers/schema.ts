import { z } from "zod";

export const supplierSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Code must be at least 2 characters")
    .max(16, "Code must be 16 characters or fewer")
    .regex(
      /^[A-Z0-9][A-Z0-9_-]*$/,
      "Capitals, digits, hyphen or underscore — starting with a letter or digit",
    ),
  name: z.string().trim().min(2, "Supplier name is required").max(160),
  trading_name: z.string().trim().max(160).optional().or(z.literal("")),

  contact_person: z.string().trim().max(120).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().email("Enter a valid email address").optional().or(z.literal("")),
  website: z.string().trim().url("Enter a full URL").optional().or(z.literal("")),

  address_line1: z.string().trim().max(160).optional().or(z.literal("")),
  address_line2: z.string().trim().max(160).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  country: z.string().trim().min(2, "Country is required").max(80),

  tax_number: z.string().trim().max(60).optional().or(z.literal("")),
  registration_number: z.string().trim().max(60).optional().or(z.literal("")),

  currency_code: z
    .string()
    .trim()
    .length(3, "Use a 3-letter currency code")
    .regex(/^[A-Z]{3}$/, "Use a 3-letter currency code, e.g. USD"),
  payment_terms_days: z.coerce
    .number()
    .int("Whole days only")
    .min(0, "Cannot be negative")
    .max(365, "365 days maximum"),
  credit_limit: z.coerce.number().min(0, "Cannot be negative").nullable(),
  opening_balance: z.coerce.number(),

  bank_name: z.string().trim().max(120).optional().or(z.literal("")),
  bank_account_name: z.string().trim().max(120).optional().or(z.literal("")),
  bank_account_number: z.string().trim().max(60).optional().or(z.literal("")),
  bank_branch: z.string().trim().max(120).optional().or(z.literal("")),
  swift_code: z.string().trim().max(20).optional().or(z.literal("")),

  status: z.enum(["active", "inactive", "blocked"]),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type SupplierFormValues = z.infer<typeof supplierSchema>;

export const supplierDefaults: SupplierFormValues = {
  code: "",
  name: "",
  trading_name: "",
  contact_person: "",
  phone: "",
  email: "",
  website: "",
  address_line1: "",
  address_line2: "",
  city: "",
  country: "Zimbabwe",
  tax_number: "",
  registration_number: "",
  currency_code: "USD",
  payment_terms_days: 30,
  credit_limit: null,
  opening_balance: 0,
  bank_name: "",
  bank_account_name: "",
  bank_account_number: "",
  bank_branch: "",
  swift_code: "",
  status: "active",
  notes: "",
};

const blankToNull = (value: string | undefined | null) =>
  value === undefined || value === null || value.trim() === "" ? null : value.trim();

export function toSupplierPayload(values: SupplierFormValues) {
  return {
    code: values.code.trim().toUpperCase(),
    name: values.name.trim(),
    trading_name: blankToNull(values.trading_name),
    contact_person: blankToNull(values.contact_person),
    phone: blankToNull(values.phone),
    email: blankToNull(values.email),
    website: blankToNull(values.website),
    address_line1: blankToNull(values.address_line1),
    address_line2: blankToNull(values.address_line2),
    city: blankToNull(values.city),
    country: values.country.trim(),
    tax_number: blankToNull(values.tax_number),
    registration_number: blankToNull(values.registration_number),
    currency_code: values.currency_code.trim().toUpperCase(),
    payment_terms_days: values.payment_terms_days,
    credit_limit: values.credit_limit,
    opening_balance: values.opening_balance,
    bank_name: blankToNull(values.bank_name),
    bank_account_name: blankToNull(values.bank_account_name),
    bank_account_number: blankToNull(values.bank_account_number),
    bank_branch: blankToNull(values.bank_branch),
    swift_code: blankToNull(values.swift_code),
    status: values.status,
    notes: blankToNull(values.notes),
  };
}

/** Common terms, offered as shortcuts on the form. */
export const PAYMENT_TERMS = [
  { days: 0, label: "Cash on delivery" },
  { days: 7, label: "7 days" },
  { days: 14, label: "14 days" },
  { days: 30, label: "30 days" },
  { days: 45, label: "45 days" },
  { days: 60, label: "60 days" },
  { days: 90, label: "90 days" },
] as const;

export function paymentTermsLabel(days: number): string {
  return PAYMENT_TERMS.find((term) => term.days === days)?.label ?? `${days} days`;
}
