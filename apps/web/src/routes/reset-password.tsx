import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { Button, buttonClass, ErrorText, TextField } from "@/components/ui";
import { AuthShell, authErrorMessage } from "@/features/auth/auth-shell";
import { getSession } from "@/features/auth/session";
import { supabase } from "@/lib/supabase";

// The email link signs the user in with a short-lived recovery session, which
// supabase-js reads from the URL before this loader runs.
export const Route = createFileRoute("/reset-password")({
  loader: async () => ({ hasSession: Boolean(await getSession()) }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { hasSession } = Route.useLoaderData();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password"));
    if (password !== String(form.get("confirm"))) return setError("The passwords don't match.");
    setPending(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setPending(false);
    if (error) return setError(authErrorMessage(error));
    await navigate({ to: "/" });
  }

  if (!hasSession) {
    return (
      <AuthShell title="Link expired" subtitle="This reset link is no longer valid. Request a new one.">
        <Link to="/forgot-password" className={buttonClass("lagoon", "lg")}>
          Send a new link
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <TextField
          label="New password"
          name="password"
          type="password"
          required
          minLength={8}
          placeholder="8 or more characters"
          autoComplete="new-password"
        />
        <TextField label="Repeat new password" name="confirm" type="password" required minLength={8} autoComplete="new-password" />
        <ErrorText>{error}</ErrorText>
        <Button type="submit" variant="lagoon" disabled={pending}>
          {pending ? "Saving…" : "Save password"}
        </Button>
      </form>
    </AuthShell>
  );
}
