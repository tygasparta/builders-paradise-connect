import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { queryKeys } from "@/lib/query-keys";
import type { UserStatus } from "@/lib/database.types";
import {
  assignRole,
  inviteUser,
  listPermissions,
  listRolePermissionIds,
  listRoles,
  listUsers,
  revokeRole,
  setUserStatus,
  updateUserProfile,
} from "./api";

export function useUsers() {
  return useQuery({ queryKey: queryKeys.users.list, queryFn: listUsers, staleTime: 30_000 });
}

export function useRoles() {
  return useQuery({
    queryKey: queryKeys.roles.list,
    queryFn: listRoles,
    // Roles change rarely; they are seeded by migration.
    staleTime: 5 * 60_000,
  });
}

export function usePermissionCatalogue() {
  return useQuery({
    queryKey: queryKeys.permissions.catalogue,
    queryFn: listPermissions,
    staleTime: 30 * 60_000,
  });
}

export function useRolePermissions(roleId: string | null) {
  return useQuery({
    queryKey: queryKeys.roles.permissions(roleId ?? ""),
    queryFn: () => listRolePermissionIds(roleId as string),
    enabled: Boolean(roleId),
  });
}

export function useUpdateUserProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: Parameters<typeof updateUserProfile>[1] }) =>
      updateUserProfile(id, values),
    onSuccess: (profile) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      toast.success(`${profile.full_name} updated`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useSetUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: UserStatus }) => setUserStatus(id, status),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      toast.success(
        variables.status === "active" ? "Account activated" : `Account ${variables.status}`,
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useAssignRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      roleId,
      branchId,
    }: {
      userId: string;
      roleId: string;
      branchId: string | null;
    }) => assignRole(userId, roleId, branchId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      toast.success("Role assigned");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useRevokeRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assignmentId: string) => revokeRole(assignmentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      toast.success("Role revoked");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useInviteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: inviteUser,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      toast.success("Invitation sent");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
