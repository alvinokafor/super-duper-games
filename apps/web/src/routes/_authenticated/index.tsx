import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Page } from "@/components/page";
import { meQuery } from "@/features/auth/queries/me";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/_authenticated/")({
  component: HomePage,
});

function HomePage() {
  const me = useQuery(meQuery);

  return (
    <Page title="Home">
      <p className="text-sm text-ink-soft">
        {me.isPending ? "Checking the API…" : me.isError ? `API error: ${me.error.message}` : `Signed in as ${me.data.userId}`}
      </p>
      <button
        onClick={() => void supabase.auth.signOut()}
        className="self-start rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold"
      >
        Sign out
      </button>
    </Page>
  );
}
