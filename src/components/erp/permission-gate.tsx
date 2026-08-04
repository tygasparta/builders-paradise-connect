import type { ReactNode } from "react";

import { usePermissions } from "@/lib/auth/use-permission";
import type { PermissionCode } from "@/lib/permissions/catalog";
import { NoAccessState } from "./states";

/**
 * Renders children only when the user holds the required permission.
 *
 * Use `fallback` for inline controls (hide the button) and `<RequirePermission>`
 * for whole screens (show a clear explanation instead of a blank page).
 */
export function PermissionGate({
  require,
  children,
  fallback = null,
}: {
  require: PermissionCode | readonly PermissionCode[];
  children: ReactNode;
  fallback?: ReactNode | undefined;
}) {
  const { satisfies } = usePermissions();
  return satisfies(require) ? <>{children}</> : <>{fallback}</>;
}

export function RequirePermission({
  require,
  what,
  children,
}: {
  require: PermissionCode | readonly PermissionCode[];
  what?: string | undefined;
  children: ReactNode;
}) {
  const { satisfies } = usePermissions();
  if (!satisfies(require)) {
    return <NoAccessState what={what} />;
  }
  return <>{children}</>;
}
