import type { PermissionCode } from "./catalog";

/**
 * A user's effective permissions, resolved once at sign-in from
 * `public.my_permissions()` and held in the auth context.
 *
 * There is no client-side wildcard: Super Administrator is granted every
 * permission row explicitly by the seed migration, so what the UI checks and
 * what RLS enforces are the same set of strings.
 */
export type PermissionSet = ReadonlySet<string>;

export function createPermissionSet(codes: readonly string[]): PermissionSet {
  return new Set(codes);
}

export const EMPTY_PERMISSIONS: PermissionSet = new Set<string>();

/** True when the user holds this exact permission. */
export function can(permissions: PermissionSet, code: PermissionCode): boolean {
  return permissions.has(code);
}

/** True when the user holds at least one of these permissions. */
export function canAny(permissions: PermissionSet, codes: readonly PermissionCode[]): boolean {
  return codes.some((code) => permissions.has(code));
}

/** True when the user holds every one of these permissions. */
export function canAll(permissions: PermissionSet, codes: readonly PermissionCode[]): boolean {
  return codes.every((code) => permissions.has(code));
}

/**
 * Resolves what a navigation entry or action needs.
 *
 * `undefined` means "no permission required" — visible to any signed-in,
 * active user. An empty array means the same; it is treated as no
 * requirement rather than silently denying, so a mis-typed config cannot
 * lock everyone out of a screen.
 */
export function satisfies(
  permissions: PermissionSet,
  required: PermissionCode | readonly PermissionCode[] | undefined,
): boolean {
  if (required === undefined) return true;
  if (typeof required === "string") return permissions.has(required);
  if (required.length === 0) return true;
  return canAny(permissions, required);
}
