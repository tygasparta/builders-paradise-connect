import { useCallback } from "react";

import { useAuth } from "./auth-context";
import type { PermissionCode } from "@/lib/permissions/catalog";
import { can, canAll, canAny, satisfies } from "@/lib/permissions/check";

/**
 * Permission checks for the current user.
 *
 * These drive what the UI offers. They are not the security boundary — RLS
 * is. A user who forges a check still cannot read or write a row the
 * database will not give them.
 */
export function usePermissions() {
  const { permissions } = useAuth();

  return {
    permissions,
    can: useCallback((code: PermissionCode) => can(permissions, code), [permissions]),
    canAny: useCallback(
      (codes: readonly PermissionCode[]) => canAny(permissions, codes),
      [permissions],
    ),
    canAll: useCallback(
      (codes: readonly PermissionCode[]) => canAll(permissions, codes),
      [permissions],
    ),
    satisfies: useCallback(
      (required: PermissionCode | readonly PermissionCode[] | undefined) =>
        satisfies(permissions, required),
      [permissions],
    ),
  };
}

/** Convenience for the common single-permission case. */
export function useCan(code: PermissionCode): boolean {
  const { permissions } = useAuth();
  return can(permissions, code);
}
