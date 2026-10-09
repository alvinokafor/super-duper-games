import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { BackIcon } from "@/components/icons";
import {
  BottomBar,
  backButtonClass,
  Button,
  ErrorText,
  errorMessage,
  GroupBadge,
  Muted,
  rowClass,
  Screen,
  SectionLabel,
} from "@/components/ui";
import { ArtTile, lagosArt } from "@/features/games/art";
import { groupsQuery } from "@/features/groups/api";
import { gamesQuery, useCreateRoom } from "@/features/rooms/api";

export const Route = createFileRoute("/_authenticated/games/$gameId")({
  component: GamePage,
});

function GamePage() {
  const { gameId } = Route.useParams();
  const navigate = useNavigate();
  const router = useRouter();
  const games = useQuery(gamesQuery);
  const groups = useQuery(groupsQuery);
  const createRoom = useCreateRoom();
  const game = games.data?.games.find((g) => g.id === gameId);

  async function start(groupId?: string) {
    const room = await createRoom.mutateAsync({ gameId, ...(groupId && { groupId }) });
    await navigate({ to: "/rooms/$roomId", params: { roomId: room.id } });
  }

  return (
    <Screen>
      <div className="flex items-center gap-3 px-4 pb-3">
        <button type="button" onClick={() => router.history.back()} className={backButtonClass} aria-label="Back">
          <BackIcon />
        </button>
        <h1 className="text-section leading-title font-black tracking-[-0.02em] text-ink">New room</h1>
      </div>

      {games.data && !game ? (
        <div className="flex flex-col gap-3 px-4">
          <Muted>This game isn't available.</Muted>
          <Link to="/games" className="text-body leading-[18px] font-black text-lagoon">
            Back to games
          </Link>
        </div>
      ) : (
        <>
          <section className="mx-4 flex items-center gap-[14px] rounded-card bg-white p-3">
            <div className="flex size-[72px] shrink-0 items-center justify-center overflow-hidden rounded-[12px] bg-paper">
              <ArtTile src={lagosArt.featured} className="h-[52px] w-16" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
              <p className="text-[11px] leading-[14px] font-bold tracking-wide text-ink-soft uppercase">Start a room</p>
              <p className="text-[22px] leading-[26px] font-black tracking-tight text-ink">{game?.name ?? "…"}</p>
              {game && (
                <p className="text-label leading-caption font-medium text-ink-soft">
                  {game.minPlayers}–{game.maxPlayers} players
                </p>
              )}
            </div>
          </section>

          {groups.data && groups.data.groups.length > 0 && (
            <section className="flex flex-col gap-[6px] px-4 pt-4">
              <SectionLabel>Start in a group</SectionLabel>
              <Muted className="px-1 pb-1">The group chat gets a card everyone can tap to join.</Muted>
              {groups.data.groups.map((g) => (
                <div key={g.id} className={rowClass}>
                  <GroupBadge group={g} size={44} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="truncate text-body leading-5 font-black text-ink">{g.name}</p>
                    <p className="text-caption leading-caption text-ink-soft">
                      {g.memberCount} member{g.memberCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <Button size="sm" variant="danfo" disabled={createRoom.isPending} onClick={() => start(g.id)}>
                    Start
                  </Button>
                </div>
              ))}
            </section>
          )}

          <BottomBar>
            <ErrorText>{errorMessage(createRoom.error)}</ErrorText>
            <Button variant="outline" disabled={createRoom.isPending || !game} onClick={() => start()}>
              {createRoom.isPending ? "Starting…" : "Start with a link only"}
            </Button>
          </BottomBar>
        </>
      )}
    </Screen>
  );
}
