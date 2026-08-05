import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CheckCircle2, KeyRound, Loader2, Save } from "lucide-react";

import { PageHeader } from "@/components/erp/page-header";
import { Field } from "@/components/erp/form-field";
import { SectionCard } from "@/components/erp/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth/auth-context";
import { useBranches } from "@/features/branches/hooks";
import { useWarehouses } from "@/features/warehouses/hooks";
import { db, humaniseError } from "@/lib/supabase";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/profile")({
  component: ProfilePage,
});

const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Your name is required").max(120),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  job_title: z.string().trim().max(80).optional().or(z.literal("")),
  default_branch_id: z.string(),
  default_warehouse_id: z.string(),
});

type ProfileValues = z.infer<typeof profileSchema>;

function ProfilePage() {
  const { profile, roles, refreshProfile } = useAuth();
  const { data: branches } = useBranches();
  const [saving, setSaving] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: "",
      phone: "",
      job_title: "",
      default_branch_id: "none",
      default_warehouse_id: "none",
    },
  });

  const branchId = form.watch("default_branch_id");
  const { data: warehouses } = useWarehouses(branchId === "none" ? null : branchId);

  useEffect(() => {
    if (!profile) return;
    form.reset({
      full_name: profile.full_name,
      phone: profile.phone ?? "",
      job_title: profile.job_title ?? "",
      default_branch_id: profile.default_branch_id ?? "none",
      default_warehouse_id: profile.default_warehouse_id ?? "none",
    });
  }, [profile, form]);

  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit(async (values) => {
    if (!profile) return;
    setSaving(true);
    // Status, employee code and lockout fields are deliberately absent —
    // the database blocks a user editing those on their own row anyway.
    const { error } = await db
      .from("profiles")
      .update({
        full_name: values.full_name.trim(),
        phone: values.phone?.trim() || null,
        job_title: values.job_title?.trim() || null,
        default_branch_id: values.default_branch_id === "none" ? null : values.default_branch_id,
        default_warehouse_id:
          values.default_warehouse_id === "none" ? null : values.default_warehouse_id,
      })
      .eq("id", profile.id);
    setSaving(false);

    if (error) {
      toast.error(humaniseError(error.message, error.code));
      return;
    }
    toast.success("Profile updated");
    form.reset(values);
    await refreshProfile();
  });

  const requestPasswordChange = async () => {
    if (!profile) return;
    const options =
      typeof window === "undefined"
        ? {}
        : { redirectTo: `${window.location.origin}/reset-password` };
    const { error } = await db.auth.resetPasswordForEmail(profile.email, options);
    if (error) {
      toast.error(humaniseError(error.message));
      return;
    }
    setResetSent(true);
    toast.success("Password reset link sent to your email");
  };

  return (
    <form onSubmit={onSubmit} noValidate>
      <PageHeader
        title="My profile"
        description="Your details and the branch you work from by default."
        breadcrumbs={[{ label: "My profile" }]}
        actions={
          <Button type="submit" disabled={saving || !form.formState.isDirty}>
            {saving ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Save className="size-4" aria-hidden />
            )}
            Save changes
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Your details" className="lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" htmlFor="full_name" required error={errors.full_name?.message}>
              <Input id="full_name" {...form.register("full_name")} />
            </Field>

            <Field
              label="Email"
              htmlFor="email"
              hint="Changing your sign-in email is not self-service."
            >
              <Input id="email" value={profile?.email ?? ""} disabled readOnly />
            </Field>

            <Field label="Phone" htmlFor="phone" error={errors.phone?.message}>
              <Input id="phone" type="tel" {...form.register("phone")} />
            </Field>

            <Field label="Job title" htmlFor="job_title" error={errors.job_title?.message}>
              <Input id="job_title" {...form.register("job_title")} />
            </Field>

            <Field
              label="Default branch"
              htmlFor="default_branch_id"
              hint="Pre-selected when you sign in."
            >
              <Select
                value={branchId}
                onValueChange={(value) => {
                  form.setValue("default_branch_id", value, { shouldDirty: true });
                  form.setValue("default_warehouse_id", "none", { shouldDirty: true });
                }}
              >
                <SelectTrigger id="default_branch_id">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No default</SelectItem>
                  {branches?.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Default warehouse" htmlFor="default_warehouse_id">
              <Select
                value={form.watch("default_warehouse_id")}
                onValueChange={(value) =>
                  form.setValue("default_warehouse_id", value, { shouldDirty: true })
                }
                disabled={branchId === "none"}
              >
                <SelectTrigger id="default_warehouse_id">
                  <SelectValue placeholder="Choose a branch first" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No default</SelectItem>
                  {warehouses?.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </SectionCard>

        <div className="space-y-4">
          <SectionCard title="Access" description="What your account can reach">
            <dl className="space-y-3 text-td">
              <div>
                <dt className="text-helper text-muted-foreground">Employee number</dt>
                <dd className="num mt-0.5">{profile?.employee_code ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-helper text-muted-foreground">Roles</dt>
                <dd className="mt-1 flex flex-wrap gap-1">
                  {roles.map((role) => (
                    <Badge key={role.code} variant="secondary" className="text-helper">
                      {role.name}
                    </Badge>
                  ))}
                </dd>
              </div>
              <div>
                <dt className="text-helper text-muted-foreground">Last sign-in</dt>
                <dd className="num mt-0.5 text-helper">
                  {profile?.last_login_at
                    ? format(new Date(profile.last_login_at), "dd MMM yyyy HH:mm")
                    : "—"}
                </dd>
              </div>
            </dl>
          </SectionCard>

          <SectionCard title="Password" description="Sent to your email as a secure link">
            {resetSent ? (
              <div className="flex items-start gap-2 text-td">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                <p className="text-muted-foreground">
                  A reset link is on its way to {profile?.email}. It expires in one hour.
                </p>
              </div>
            ) : (
              <Button type="button" variant="outline" onClick={requestPasswordChange}>
                <KeyRound className="size-4" />
                Change my password
              </Button>
            )}
          </SectionCard>
        </div>
      </div>
    </form>
  );
}
