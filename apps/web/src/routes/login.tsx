import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { z } from "zod";
import { Button, ErrorText, Notice, TextField } from "@/components/ui";
import { AuthShell, authErrorMessage, authLinkClass } from "@/features/auth/auth-shell";
import { getSession } from "@/features/auth/session";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/login")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  beforeLoad: async () => {
    if (await getSession()) throw redirect({ to: "/" });
  },
  component: LoginPage,
});

function LoginPage() {
  const { redirect: redirectTo } = Route.useSearch();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email")).trim();
    setPending(true);
    setError(null);
    setNotice(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password: String(form.get("password")) });
    setPending(false);
    if (error) {
      setUnconfirmedEmail(error.code === "email_not_confirmed" ? email : null);
      return setError(authErrorMessage(error));
    }
    await navigate({ to: redirectTo?.startsWith("/") ? redirectTo : "/" });
  }

  async function resendConfirmation() {
    if (!unconfirmedEmail) return;
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: unconfirmedEmail,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    if (error) return setError(authErrorMessage(error));
    setError(null);
    setNotice("We sent a new confirmation link.");
  }

  return (
    <AuthShell
      title="Sign in"
      footer={
        <>
          New here?{" "}
          <Link to="/register" className={authLinkClass}>
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <TextField label="Email" name="email" type="email" required autoComplete="email" />
        <TextField label="Password" name="password" type="password" required autoComplete="current-password" />
        <Link to="/forgot-password" className="self-end text-label leading-caption font-bold text-ink-soft">
          Forgot password?
        </Link>
        <ErrorText>{error}</ErrorText>
        {unconfirmedEmail && (
          <button type="button" onClick={resendConfirmation} className="self-start text-label leading-caption font-black text-lagoon">
            Resend confirmation email
          </button>
        )}
        <Notice>{notice}</Notice>
        <Button type="submit" variant="lagoon" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthShell>
  );
}
