import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { BoardCanvas } from "@/features/match/board/board-canvas";
import { useGameSessionStore } from "@/features/match/stores/game-session.store";
import { resetMatchStores } from "@/features/match/stores/reset-match-stores";

export const Route = createFileRoute("/_authenticated/matches/$matchId")({
  component: MatchPage,
});

function MatchPage() {
  const { matchId } = Route.useParams();
  const round = useGameSessionStore((s) => s.gameState?.round);

  useEffect(() => resetMatchStores, [matchId]);

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center justify-between p-3 text-sm font-semibold">
        <span>Lagos Property</span>
        <span className="text-ink-soft">{round ? `Round ${round}` : "Loading…"}</span>
      </header>
      <BoardCanvas />
    </main>
  );
}
