import { z } from "zod";

/**
 * Mirrors the database CHECK constraints so the user is told what is wrong
 * in the form, not by a Postgres error after they press Save.
 */
export const branchSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Code must be at least 2 characters")
    .max(16, "Code must be 16 characters or fewer")
    .regex(
      /^[A-Z0-9][A-Z0-9_-]*$/,
      "Use capital letters, digits, hyphen or underscore — starting with a letter or digit",
    ),
  name: z.string().trim().min(2, "Name is required").max(120, "Name is too long"),
  is_head_office: z.boolean(),
  address_line1: z.string().trim().max(160).optional().or(z.literal("")),
  address_line2: z.string().trim().max(160).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  country: z.string().trim().min(2, "Country is required").max(80),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().email("Enter a valid email address").optional().or(z.literal("")),
  tax_number: z.string().trim().max(60).optional().or(z.literal("")),
  currency_code: z
    .string()
    .trim()
    .length(3, "Use a 3-letter currency code")
    .regex(/^[A-Z]{3}$/, "Use a 3-letter currency code, e.g. USD"),
  status: z.enum(["active", "inactive"]),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export type BranchFormValues = z.infer<typeof branchSchema>;

export const branchDefaults: BranchFormValues = {
  code: "",
  name: "",
  is_head_office: false,
  address_line1: "",
  address_line2: "",
  city: "",
  country: "Zimbabwe",
  phone: "",
  email: "",
  tax_number: "",
  currency_code: "USD",
  status: "active",
  notes: "",
};

/** Empty strings are meaningful in a form but should be NULL in the database. */
export function toBranchPayload(values: BranchFormValues) {
  const blankToNull = (value: string | undefined) =>
    value === undefined || value.trim() === "" ? null : value.trim();

  return {
    code: values.code.trim().toUpperCase(),
    name: values.name.trim(),
    is_head_office: values.is_head_office,
    address_line1: blankToNull(values.address_line1),
    address_line2: blankToNull(values.address_line2),
    city: blankToNull(values.city),
    country: values.country.trim(),
    phone: blankToNull(values.phone),
    email: blankToNull(values.email),
    tax_number: blankToNull(values.tax_number),
    currency_code: values.currency_code.trim().toUpperCase(),
    status: values.status,
    notes: blankToNull(values.notes),
  };
}
