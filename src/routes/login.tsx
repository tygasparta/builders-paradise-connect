import { useEffect, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";

import { AuthShell } from "@/components/erp/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth/auth-context";

const loginSchema = z.object({
  email: z.string().trim().min(1, "Enter your email address").email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

type LoginValues = z.infer<typeof loginSchema>;

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    typeof search["redirect"] === "string" ? { redirect: search["redirect"] } : {},
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const { signIn, status, accessError } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  // Already signed in (e.g. opened /login in a second tab) — go straight in.
  useEffect(() => {
    if (status === "signed-in") {
      void navigate({ to: redirect ?? "/", replace: true });
    }
  }, [status, navigate, redirect]);

  // Surfaces "your account is suspended" style refusals from the auth context.
  useEffect(() => {
    if (accessError) setFormError(accessError);
  }, [accessError]);

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    const { error } = await signIn(values.email, values.password);
    if (error) {
      setFormError(error);
      form.setValue("password", "");
      return;
    }
    void navigate({ to: redirect ?? "/", replace: true });
  });

  const submitting = form.formState.isSubmitting;

  return (
    <AuthShell
      title="Sign in"
      description="Use the account your administrator created for you."
      footer={
        <p>
          Trouble signing in?{" "}
          <Link to="/forgot-password" className="font-medium text-primary hover:underline">
            Reset your password
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/8 px-3 py-2.5 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{formError}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="email">
            Email address <span className="text-destructive">*</span>
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="you@buildersparadise.co.zw"
            aria-invalid={Boolean(form.formState.errors.email)}
            aria-describedby={form.formState.errors.email ? "email-error" : undefined}
            {...form.register("email")}
          />
          {form.formState.errors.email && (
            <p id="email-error" className="text-xs text-destructive">
              {form.formState.errors.email.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">
              Password <span className="text-destructive">*</span>
            </Label>
            <Link
              to="/forgot-password"
              className="text-xs text-muted-foreground hover:text-primary"
            >
              Forgot?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              className="pr-10"
              aria-invalid={Boolean(form.formState.errors.password)}
              aria-describedby={form.formState.errors.password ? "password-error" : undefined}
              {...form.register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {form.formState.errors.password && (
            <p id="password-error" className="text-xs text-destructive">
              {form.formState.errors.password.message}
            </p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {submitting ? "Signing in…" : "Sign in"}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Five failed attempts lock the account for 15 minutes.
        </p>
      </form>
    </AuthShell>
  );
}
