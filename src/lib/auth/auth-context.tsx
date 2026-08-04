import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { db, humaniseError } from "@/lib/supabase";
import type { ProfileRow } from "@/lib/database.types";
import {
  createPermissionSet,
  EMPTY_PERMISSIONS,
  type PermissionSet,
} from "@/lib/permissions/check";

export type SignedInRole = { code: string; name: string; rank: number };

type AuthState = {
  /** Undefined until the first session check resolves. */
  status: "loading" | "signed-in" | "signed-out";
  session: Session | null;
  profile: ProfileRow | null;
  roles: SignedInRole[];
  permissions: PermissionSet;
  /** Set when the account exists but may not use the system. */
  accessError: string | null;
};

type AuthContextValue = AuthState & {
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
  activeBranchId: string | null;
  setActiveBranchId: (id: string | null) => void;
  activeWarehouseId: string | null;
  setActiveWarehouseId: (id: string | null) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const BRANCH_KEY = "bp.activeBranchId";
const WAREHOUSE_KEY = "bp.activeWarehouseId";

function readStored(key: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key);
}

function writeStored(key: string, value: string | null) {
  if (typeof window === "undefined") return;
  if (value === null) window.localStorage.removeItem(key);
  else window.localStorage.setItem(key, value);
}

const SIGNED_OUT: AuthState = {
  status: "signed-out",
  session: null,
  profile: null,
  roles: [],
  permissions: EMPTY_PERMISSIONS,
  accessError: null,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ ...SIGNED_OUT, status: "loading" });
  const [activeBranchId, setActiveBranchIdState] = useState<string | null>(null);
  const [activeWarehouseId, setActiveWarehouseIdState] = useState<string | null>(null);

  /**
   * Loads the profile, roles and permission set for a session.
   *
   * A suspended or locked account is signed out here rather than merely
   * hidden — RLS would refuse its queries anyway, and a half-working shell
   * is worse than a clear message.
   */
  const loadIdentity = useCallback(async (session: Session): Promise<AuthState> => {
    const [profileResult, rolesResult, permissionsResult] = await Promise.all([
      db.from("profiles").select("*").eq("id", session.user.id).maybeSingle(),
      db.rpc("my_roles"),
      db.rpc("my_permissions"),
    ]);

    if (profileResult.error) {
      return {
        ...SIGNED_OUT,
        accessError: humaniseError(profileResult.error.message, profileResult.error.code),
      };
    }

    const profile = profileResult.data as ProfileRow | null;
    if (!profile) {
      return {
        ...SIGNED_OUT,
        accessError:
          "Your sign-in worked, but you have no user profile yet. Ask an administrator to finish setting up your account.",
      };
    }

    if (profile.status !== "active") {
      const reason =
        profile.status === "invited"
          ? "Your account has not been activated yet."
          : profile.status === "locked"
            ? "Your account is locked. Contact an administrator."
            : "Your account has been suspended.";
      return { ...SIGNED_OUT, accessError: reason };
    }

    const roles = (rolesResult.data ?? []) as SignedInRole[];
    const permissionCodes = ((permissionsResult.data ?? []) as { code: string }[]).map(
      (r) => r.code,
    );

    if (permissionCodes.length === 0) {
      return {
        ...SIGNED_OUT,
        accessError:
          "Your account has no role assigned, so there is nothing you can open yet. Ask an administrator to assign your role.",
      };
    }

    return {
      status: "signed-in",
      session,
      profile,
      roles,
      permissions: createPermissionSet(permissionCodes),
      accessError: null,
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function applySession(session: Session | null) {
      if (!session) {
        if (!cancelled) setState((prev) => ({ ...SIGNED_OUT, accessError: prev.accessError }));
        return;
      }
      const next = await loadIdentity(session);
      if (cancelled) return;
      if (next.status !== "signed-in") {
        // Identity check failed: drop the session so the app cannot sit in a
        // signed-in-but-unusable state.
        await db.auth.signOut();
      }
      setState(next);
    }

    db.auth.getSession().then(({ data }) => {
      void applySession(data.session);
    });

    const { data: subscription } = db.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setState({ ...SIGNED_OUT });
        return;
      }
      // TOKEN_REFRESHED fires often; only the session object changed.
      if (event === "TOKEN_REFRESHED") {
        setState((prev) => (prev.status === "signed-in" ? { ...prev, session } : prev));
        return;
      }
      void applySession(session);
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, [loadIdentity]);

  // Default the branch and warehouse pickers to the user's own defaults.
  useEffect(() => {
    if (state.status !== "signed-in" || !state.profile) return;
    setActiveBranchIdState(readStored(BRANCH_KEY) ?? state.profile.default_branch_id);
    setActiveWarehouseIdState(readStored(WAREHOUSE_KEY) ?? state.profile.default_warehouse_id);
  }, [state.status, state.profile]);

  const setActiveBranchId = useCallback((id: string | null) => {
    setActiveBranchIdState(id);
    writeStored(BRANCH_KEY, id);
    // Warehouses belong to a branch; a stale selection would be misleading.
    setActiveWarehouseIdState(null);
    writeStored(WAREHOUSE_KEY, null);
  }, []);

  const setActiveWarehouseId = useCallback((id: string | null) => {
    setActiveWarehouseIdState(id);
    writeStored(WAREHOUSE_KEY, id);
  }, []);

  const signIn = useCallback<AuthContextValue["signIn"]>(
    async (email, password) => {
      setState((prev) => ({ ...prev, accessError: null }));

      const { data, error } = await db.auth.signInWithPassword({ email, password });

      // Recorded for both outcomes: failed attempts feed the lockout counter
      // and the audit trail, and this runs before a session exists.
      await db.rpc("record_login_attempt", { p_email: email, p_succeeded: !error }).then(
        () => undefined,
        () => undefined, // never let audit failure block a legitimate sign-in
      );

      if (error) {
        return {
          error:
            error.message === "Invalid login credentials"
              ? "That email and password do not match an account."
              : humaniseError(error.message),
        };
      }
      if (!data.session) {
        return { error: "Sign-in did not return a session. Try again." };
      }

      const next = await loadIdentity(data.session);
      if (next.status !== "signed-in") {
        await db.auth.signOut();
        setState(next);
        return { error: next.accessError };
      }
      setState(next);
      return { error: null };
    },
    [loadIdentity],
  );

  const signOut = useCallback(async () => {
    await db.auth.signOut();
    setState({ ...SIGNED_OUT });
  }, []);

  const requestPasswordReset = useCallback<AuthContextValue["requestPasswordReset"]>(
    async (email) => {
      const options =
        typeof window === "undefined"
          ? {}
          : { redirectTo: `${window.location.origin}/reset-password` };
      const { error } = await db.auth.resetPasswordForEmail(email, options);
      return { error: error ? humaniseError(error.message) : null };
    },
    [],
  );

  const updatePassword = useCallback<AuthContextValue["updatePassword"]>(async (password) => {
    const { error } = await db.auth.updateUser({ password });
    return { error: error ? humaniseError(error.message) : null };
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!state.session) return;
    const next = await loadIdentity(state.session);
    setState(next);
  }, [state.session, loadIdentity]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      signIn,
      signOut,
      requestPasswordReset,
      updatePassword,
      refreshProfile,
      activeBranchId,
      setActiveBranchId,
      activeWarehouseId,
      setActiveWarehouseId,
    }),
    [
      state,
      signIn,
      signOut,
      requestPasswordReset,
      updatePassword,
      refreshProfile,
      activeBranchId,
      setActiveBranchId,
      activeWarehouseId,
      setActiveWarehouseId,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>.");
  }
  return context;
}
