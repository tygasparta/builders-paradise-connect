import { z } from "zod";

export const WAREHOUSE_TYPES = [
  { value: "main", label: "Main store", hint: "Primary stockholding for a branch" },
  { value: "shop_floor", label: "Shop floor", hint: "Stock available to walk-in customers" },
  { value: "branch", label: "Branch store", hint: "Stockholding at a satellite branch" },
  {
    value: "virtual_employee",
    label: "Employee (virtual)",
    hint: "Stock issued to staff on requisition",
  },
  { value: "damaged", label: "Damaged goods", hint: "Quarantined stock pending write-off" },
  { value: "returns", label: "Returns", hint: "Customer returns awaiting inspection" },
  { value: "in_transit", label: "Goods in transit", hint: "Stock moving between locations" },
] as const;

export const LOCATION_TYPES = [
  { value: "storage", label: "Storage" },
  { value: "picking", label: "Picking" },
  { value: "receiving", label: "Receiving" },
  { value: "dispatch", label: "Dispatch" },
  { value: "quarantine", label: "Quarantine" },
] as const;

export const warehouseSchema = z.object({
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
  branch_id: z.string().uuid("Choose a branch"),
  type: z.enum([
    "main",
    "shop_floor",
    "branch",
    "virtual_employee",
    "damaged",
    "returns",
    "in_transit",
  ]),
  manager_id: z.string().uuid().nullable(),
  address: z.string().trim().max(200).optional().or(z.literal("")),
  status: z.enum(["active", "inactive"]),
  is_default: z.boolean(),
  allow_negative_stock: z.boolean(),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export type WarehouseFormValues = z.infer<typeof warehouseSchema>;

export const warehouseDefaults: WarehouseFormValues = {
  code: "",
  name: "",
  branch_id: "",
  type: "main",
  manager_id: null,
  address: "",
  status: "active",
  is_default: false,
  allow_negative_stock: false,
  notes: "",
};

export function toWarehousePayload(values: WarehouseFormValues) {
  const blankToNull = (value: string | undefined | null) =>
    value === undefined || value === null || value.trim() === "" ? null : value.trim();

  return {
    code: values.code.trim().toUpperCase(),
    name: values.name.trim(),
    branch_id: values.branch_id,
    type: values.type,
    manager_id: values.manager_id ?? null,
    address: blankToNull(values.address),
    status: values.status,
    is_default: values.is_default,
    allow_negative_stock: values.allow_negative_stock,
    notes: blankToNull(values.notes),
  };
}

export const warehouseLocationSchema = z.object({
  warehouse_id: z.string().uuid(),
  code: z.string().trim().min(1, "Code is required").max(16, "Code is too long"),
  name: z.string().trim().min(2, "Name is required").max(120),
  type: z.enum(["storage", "picking", "receiving", "dispatch", "quarantine"]),
  status: z.enum(["active", "inactive"]),
});

export type WarehouseLocationFormValues = z.infer<typeof warehouseLocationSchema>;
