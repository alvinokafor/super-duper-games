import { createFileRoute } from "@tanstack/react-router";
import { Page } from "@/components/page";

export const Route = createFileRoute("/_authenticated/games/$gameId")({
  component: GamePage,
});

function GamePage() {
  const { gameId } = Route.useParams();
  return <Page title={gameId} />;
}
