/**
 * Every query key in one place, so invalidation after a mutation is a
 * lookup rather than a guess.
 */
export const queryKeys = {
  branches: {
    all: ["branches"] as const,
    list: (includeInactive: boolean) => ["branches", "list", includeInactive] as const,
    detail: (id: string) => ["branches", "detail", id] as const,
  },
  warehouses: {
    all: ["warehouses"] as const,
    list: (branchId: string | null, includeInactive: boolean) =>
      ["warehouses", "list", branchId ?? "all", includeInactive] as const,
    detail: (id: string) => ["warehouses", "detail", id] as const,
    locations: (warehouseId: string) => ["warehouses", "locations", warehouseId] as const,
  },
  users: {
    all: ["users"] as const,
    list: ["users", "list"] as const,
    detail: (id: string) => ["users", "detail", id] as const,
    roles: (userId: string) => ["users", "roles", userId] as const,
  },
  roles: {
    all: ["roles"] as const,
    list: ["roles", "list"] as const,
    permissions: (roleId: string) => ["roles", "permissions", roleId] as const,
  },
  permissions: {
    catalogue: ["permissions", "catalogue"] as const,
  },
  settings: {
    company: ["settings", "company"] as const,
  },
  audit: {
    list: (filters: Record<string, unknown>) => ["audit", "list", filters] as const,
  },
  notifications: {
    unread: ["notifications", "unread"] as const,
  },
  dashboard: {
    organisation: ["dashboard", "organisation"] as const,
  },
} as const;
