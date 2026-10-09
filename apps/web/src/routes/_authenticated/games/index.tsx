import { createFileRoute, Link } from "@tanstack/react-router";
import { GAME_ID } from "@bankroll/lagos-rules";
import { Page } from "@/components/page";

export const Route = createFileRoute("/_authenticated/games/")({
  component: GamesPage,
});

function GamesPage() {
  return (
    <Page title="Games">
      <Link
        to="/games/$gameId"
        params={{ gameId: GAME_ID }}
        className="rounded-2xl border border-line bg-white p-4 font-semibold"
      >
        Lagos Property
      </Link>
    </Page>
  );
}
