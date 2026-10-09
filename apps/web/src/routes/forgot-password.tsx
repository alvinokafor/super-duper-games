import { createFileRoute, Link } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { Button, ErrorText, TextField } from "@/components/ui";
import { AuthShell, authErrorMessage, authLinkClass } from "@/features/auth/auth-shell";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email")).trim();
    setPending(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setPending(false);
    if (error) return setError(authErrorMessage(error));
    setSentTo(email);
  }

  const footer = (
    <Link to="/login" className={authLinkClass}>
      Back to sign in
    </Link>
  );

  if (sentTo) {
    return (
      <AuthShell
        title="Check your email"
        subtitle={`If ${sentTo} has an account, we sent a link to reset the password.`}
        footer={footer}
      >
        <Button variant="outline" onClick={() => setSentTo(null)}>
          Use a different email
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Forgot password" subtitle="We'll email you a link to choose a new one." footer={footer}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <TextField label="Email" name="email" type="email" required autoComplete="email" />
        <ErrorText>{error}</ErrorText>
        <Button type="submit" variant="lagoon" disabled={pending}>
          {pending ? "Sending…" : "Send reset link"}
        </Button>
      </form>
    </AuthShell>
  );
}
