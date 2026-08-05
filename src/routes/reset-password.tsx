import { useEffect, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, Loader2 } from "lucide-react";

import { AuthShell } from "@/components/erp/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth/auth-context";
import { db } from "@/lib/supabase";

const schema = z
  .object({
    password: z
      .string()
      .min(10, "Use at least 10 characters")
      .regex(/[a-z]/, "Include a lower-case letter")
      .regex(/[A-Z]/, "Include a capital letter")
      .regex(/[0-9]/, "Include a number"),
    confirm: z.string(),
  })
  .refine((values) => values.password === values.confirm, {
    message: "The two passwords do not match",
    path: ["confirm"],
  });

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const { updatePassword } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const [linkValid, setLinkValid] = useState<boolean | null>(null);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirm: "" },
  });

  /**
   * Supabase turns the emailed link into a short-lived recovery session.
   * Without one, there is nothing to update — say so rather than failing
   * on submit.
   */
  useEffect(() => {
    let cancelled = false;
    db.auth.getSession().then(({ data }) => {
      if (!cancelled) setLinkValid(Boolean(data.session));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    const { error } = await updatePassword(values.password);
    if (error) {
      setFormError(error);
      return;
    }
    // Force a fresh sign-in with the new password.
    await db.auth.signOut();
    void navigate({ to: "/login", replace: true });
  });

  return (
    <AuthShell
      title="Set a new password"
      description="Choose a password you have not used on this system before."
      footer={
        <p>
          <Link to="/login" className="font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      }
    >
      {linkValid === false ? (
        <div
          role="alert"
          className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-3 text-td text-warning-foreground"
        >
          <p className="font-medium">This reset link is no longer valid</p>
          <p className="mt-1">
            Reset links expire after one hour and can be used once.{" "}
            <Link to="/forgot-password" className="font-medium underline">
              Request a new one
            </Link>
            .
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {formError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/8 px-3 py-2.5 text-td text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{formError}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="password">
              New password <span className="text-destructive">*</span>
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              autoFocus
              aria-invalid={Boolean(form.formState.errors.password)}
              {...form.register("password")}
            />
            {form.formState.errors.password ? (
              <p className="text-helper text-destructive">
                {form.formState.errors.password.message}
              </p>
            ) : (
              <p className="text-helper text-muted-foreground">
                At least 10 characters, with a capital, a lower-case letter and a number.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm">
              Confirm new password <span className="text-destructive">*</span>
            </Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              aria-invalid={Boolean(form.formState.errors.confirm)}
              {...form.register("confirm")}
            />
            {form.formState.errors.confirm && (
              <p className="text-helper text-destructive">
                {form.formState.errors.confirm.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={form.formState.isSubmitting || linkValid === null}
          >
            {form.formState.isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Update password
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
