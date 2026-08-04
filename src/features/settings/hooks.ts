import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { db, unwrapMaybe, unwrap } from "@/lib/supabase";
import type { SystemSettingsRow } from "@/lib/database.types";
import { queryKeys } from "@/lib/query-keys";
import { toCompanyPayload, type CompanySettingsFormValues } from "./schema";

export async function getCompanySettings(): Promise<SystemSettingsRow | null> {
  return unwrapMaybe(
    await db.from("system_settings").select("*").eq("id", true).maybeSingle(),
  ) as SystemSettingsRow | null;
}

export function useCompanySettings() {
  return useQuery({
    queryKey: queryKeys.settings.company,
    queryFn: getCompanySettings,
    staleTime: 5 * 60_000,
  });
}

export function useUpdateCompanySettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: CompanySettingsFormValues) => {
      const rows = unwrap(
        await db
          .from("system_settings")
          .update(toCompanyPayload(values))
          .eq("id", true)
          .select("*"),
      ) as SystemSettingsRow[];
      const saved = rows[0];
      if (!saved) {
        throw new Error("Company settings could not be saved. You may not have permission.");
      }
      return saved;
    },
    onSuccess: (settings) => {
      queryClient.setQueryData(queryKeys.settings.company, settings);
      toast.success("Company settings saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
