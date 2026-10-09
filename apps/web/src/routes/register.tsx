import { displayNameSchema } from "@bankroll/contracts";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { Button, ErrorText, Muted, TextField } from "@/components/ui";
import { AuthShell, authErrorMessage, authLinkClass } from "@/features/auth/auth-shell";
import { getSession } from "@/features/auth/session";
import { UsernameField, useUsernameStatus } from "@/features/auth/username-field";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/register")({
  beforeLoad: async () => {
    if (await getSession()) throw redirect({ to: "/" });
  },
  component: RegisterPage,
});

function RegisterPage() {
  const [username, setUsername] = useState("");
  const usernameStatus = useUsernameStatus(username);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const displayName = displayNameSchema.safeParse(form.get("displayName"));
    if (!displayName.success) return setError(displayName.error.issues[0]?.message ?? "Enter a name");
    if (usernameStatus.status !== "available") {
      return setError(usernameStatus.status === "taken" ? "That username is taken" : "Choose a valid username");
    }

    const email = String(form.get("email")).trim();
    setPending(true);
    setError(null);
    const { error } = await supabase.auth.signUp({
      email,
      password: String(form.get("password")),
      options: {
        data: { display_name: displayName.data, username: username.trim() },
        emailRedirectTo: `${window.location.origin}/`,
      },
    });
    setPending(false);
    if (error) return setError(authErrorMessage(error));
    setSentTo(email);
  }

  async function resend() {
    if (!sentTo) return;
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: sentTo,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    setNotice(error ? authErrorMessage(error) : "We sent another link.");
  }

  const footer = (
    <>
      Have an account?{" "}
      <Link to="/login" className={authLinkClass}>
        Sign in
      </Link>
    </>
  );

  if (sentTo) {
    return (
      <AuthShell title="Check your email" subtitle={`We sent a confirmation link to ${sentTo}. Open it to start playing.`} footer={footer}>
        <Button variant="outline" onClick={resend}>
          Resend link
        </Button>
        {notice && <Muted className="text-center">{notice}</Muted>}
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create account" subtitle="Friends find you by your username." footer={footer}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <TextField label="Your name" name="displayName" required maxLength={40} autoComplete="nickname" />
        <UsernameField value={username} onChange={setUsername} status={usernameStatus} />
        <TextField label="Email" name="email" type="email" required autoComplete="email" />
        <TextField
          label="Password"
          name="password"
          type="password"
          required
          minLength={8}
          placeholder="8 or more characters"
          autoComplete="new-password"
        />
        <ErrorText>{error}</ErrorText>
        <Button type="submit" variant="lagoon" disabled={pending}>
          {pending ? "Creating…" : "Create account"}
        </Button>
      </form>
    </AuthShell>
  );
}
