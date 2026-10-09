import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { getSession } from "@/features/auth/session";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/register")({
  beforeLoad: async () => {
    if (await getSession()) throw redirect({ to: "/" });
  },
  component: RegisterPage,
});

function RegisterPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    const { error } = await supabase.auth.signUp({
      email: String(form.get("email")),
      password: String(form.get("password")),
      options: { data: { display_name: String(form.get("displayName")) } },
    });
    setPending(false);
    if (error) return setError(error.message);
    setMessage("Check your email to confirm your account.");
  }

  return (
    <main className="flex flex-1 flex-col justify-center gap-6 p-6">
      <h1 className="text-3xl font-extrabold tracking-tight">Create account</h1>
      {message ? (
        <p className="text-ink-soft">{message}</p>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <input name="displayName" required placeholder="Display name" autoComplete="nickname"
            className="rounded-xl border border-line bg-white px-4 py-3" />
          <input name="email" type="email" required placeholder="Email" autoComplete="email"
            className="rounded-xl border border-line bg-white px-4 py-3" />
          <input name="password" type="password" required minLength={8} placeholder="Password" autoComplete="new-password"
            className="rounded-xl border border-line bg-white px-4 py-3" />
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button disabled={pending} className="rounded-xl bg-ink px-4 py-3 font-semibold text-white disabled:opacity-60">
            {pending ? "Creating…" : "Create account"}
          </button>
        </form>
      )}
      <p className="text-sm text-ink-soft">
        Have an account? <Link to="/login" className="font-semibold text-lagoon">Sign in</Link>
      </p>
    </main>
  );
}
