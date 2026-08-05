import { z } from "zod";

export const CUSTOMER_TYPES = [
  { value: "retail", label: "Retail / walk-in" },
  { value: "trade", label: "Trade account" },
  { value: "contractor", label: "Contractor" },
  { value: "government", label: "Government / parastatal" },
  { value: "internal", label: "Internal" },
] as const;

export const customerSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Code must be at least 2 characters")
    .max(16, "Code must be 16 characters or fewer")
    .regex(/^[A-Z0-9][A-Z0-9_-]*$/, "Capitals, digits, hyphen or underscore"),
  name: z.string().trim().min(2, "Customer name is required").max(160),
  trading_name: z.string().trim().max(160).optional().or(z.literal("")),
  customer_type: z.enum(["retail", "trade", "contractor", "government", "internal"]),

  contact_person: z.string().trim().max(120).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().email("Enter a valid email address").optional().or(z.literal("")),

  address_line1: z.string().trim().max(160).optional().or(z.literal("")),
  address_line2: z.string().trim().max(160).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  country: z.string().trim().min(2, "Country is required").max(80),

  tax_number: z.string().trim().max(60).optional().or(z.literal("")),
  registration_number: z.string().trim().max(60).optional().or(z.literal("")),

  currency_code: z
    .string()
    .trim()
    .length(3)
    .regex(/^[A-Z]{3}$/, "3-letter code, e.g. USD"),
  payment_terms_days: z.coerce.number().int().min(0).max(365),
  credit_limit: z.coerce.number().min(0, "Cannot be negative").nullable(),
  opening_balance: z.coerce.number(),

  salesperson_id: z.string().uuid().nullable(),
  status: z.enum(["active", "inactive", "on_hold"]),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type CustomerFormValues = z.infer<typeof customerSchema>;

export const customerDefaults: CustomerFormValues = {
  code: "",
  name: "",
  trading_name: "",
  customer_type: "retail",
  contact_person: "",
  phone: "",
  email: "",
  address_line1: "",
  address_line2: "",
  city: "",
  country: "Zimbabwe",
  tax_number: "",
  registration_number: "",
  currency_code: "USD",
  payment_terms_days: 0,
  credit_limit: null,
  opening_balance: 0,
  salesperson_id: null,
  status: "active",
  notes: "",
};

const blankToNull = (v: string | undefined | null) =>
  v === undefined || v === null || v.trim() === "" ? null : v.trim();

export function toCustomerPayload(values: CustomerFormValues) {
  return {
    code: values.code.trim().toUpperCase(),
    name: values.name.trim(),
    trading_name: blankToNull(values.trading_name),
    customer_type: values.customer_type,
    contact_person: blankToNull(values.contact_person),
    phone: blankToNull(values.phone),
    email: blankToNull(values.email),
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
    salesperson_id: values.salesperson_id,
    status: values.status,
    notes: blankToNull(values.notes),
  };
}

/** How much more this customer may take on account. */
export function creditHeadroom(
  creditLimit: number | null,
  balance: number,
): { limited: boolean; headroom: number; overLimit: boolean } {
  if (creditLimit === null) return { limited: false, headroom: Infinity, overLimit: false };
  const headroom = creditLimit - balance;
  return { limited: true, headroom, overLimit: headroom < 0 };
}
