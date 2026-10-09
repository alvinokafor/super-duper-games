import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { z } from "zod";
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
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    setPending(false);
    if (error) return setError(error.message);
    await navigate({ to: redirectTo?.startsWith("/") ? redirectTo : "/" });
  }

  return (
    <main className="flex flex-1 flex-col justify-center gap-6 p-6">
      <h1 className="text-3xl font-extrabold tracking-tight">Sign in</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input name="email" type="email" required placeholder="Email" autoComplete="email"
          className="rounded-xl border border-line bg-white px-4 py-3" />
        <input name="password" type="password" required placeholder="Password" autoComplete="current-password"
          className="rounded-xl border border-line bg-white px-4 py-3" />
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button disabled={pending} className="rounded-xl bg-ink px-4 py-3 font-semibold text-white disabled:opacity-60">
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="text-sm text-ink-soft">
        New here? <Link to="/register" className="font-semibold text-lagoon">Create an account</Link>
      </p>
    </main>
  );
}
