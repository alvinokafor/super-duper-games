import { ROOM_CHANGED_EVENT, type Room, roomChannelName } from "@bankroll/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { BackIcon } from "@/components/icons";
import { Avatar, backButtonClass, Button, buttonClass, ErrorText, errorMessage, Muted, Screen } from "@/components/ui";
import { ArtTile, lagosArt } from "@/features/games/art";
import { roomQuery, useJoinRoom, useLeaveRoom } from "@/features/rooms/api";
import { shortRoomCode } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import { useChannel } from "@/lib/realtime";
import { shareOrCopy } from "@/lib/share";

export const Route = createFileRoute("/_authenticated/rooms/$roomId")({
  component: RoomPage,
});

// Player token colours, in seat order.
const seatTokens = ["bg-lagoon", "bg-navy", "bg-rose", "bg-alert", "bg-violet", "bg-teal"] as const;
const tokenShadow = "shadow-[inset_0_2px_1px_#FFFFFF8C,inset_0_-2px_2px_#00000047,0_1px_1px_#00000047]";

function RoomPage() {
  const { roomId } = Route.useParams();
  const { userId } = Route.useRouteContext();
  const router = useRouter();
  const queryClient = useQueryClient();
  const join = useJoinRoom(roomId);
  const leave = useLeaveRoom(roomId);
  const [copied, setCopied] = useState(false);

  // Only seated players and members of the room's group get live updates;
  // anyone else viewing a shared link checks every few seconds.
  const canListenTo = (data: Room | undefined) =>
    Boolean(data && (data.groupId !== null || data.seats.some((s) => s.player.id === userId)));
  const room = useQuery({
    ...roomQuery(roomId),
    refetchInterval: (query) => (canListenTo(query.state.data) ? false : 5000),
  });
  const r = room.data;
  const seated = r?.seats.some((s) => s.player.id === userId) ?? false;

  const refresh = () => void queryClient.invalidateQueries({ queryKey: queryKeys.room(roomId) });
  useChannel(canListenTo(r) ? roomChannelName(roomId) : null, { [ROOM_CHANGED_EVENT]: refresh }, refresh);

  async function share() {
    const result = await shareOrCopy({ title: `Play ${r?.gameName ?? "Lagos Property"} with me`, url: window.location.href });
    if (result === "copied") {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const header = (
    <div className="flex items-center justify-between px-4 pb-2">
      <button type="button" onClick={() => router.history.back()} className={backButtonClass} aria-label="Back">
        <BackIcon />
      </button>
      <div className="flex flex-col items-center gap-[2px]">
        <h1 className="text-title leading-body font-black tracking-tight text-ink">{r?.gameName ?? "Room"}</h1>
        <p className="text-caption leading-caption font-semibold text-ink-soft">Room {shortRoomCode(roomId)}</p>
      </div>
      <button
        type="button"
        onClick={share}
        className="flex h-9 shrink-0 items-center justify-center rounded-button border border-line bg-white px-3 text-label leading-caption font-bold text-ink"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );

  if (!r) {
    return (
      <Screen>
        {header}
        <div className="px-4 pt-4">
          {room.isPending ? <Muted>Loading…</Muted> : <ErrorText>{errorMessage(room.error)}</ErrorText>}
        </div>
      </Screen>
    );
  }

  const isHost = r.hostId === userId;
  const needed = Math.max(0, r.minPlayers - r.seats.length);
  const full = r.seats.length >= r.maxPlayers;

  let status = "Waiting for the host to start.";
  if (r.status === "closed") status = "This room has closed.";
  else if (r.status === "started") status = "The match has started.";
  else if (needed > 0) status = `Waiting for ${needed} more player${needed === 1 ? "" : "s"}. At least ${r.minPlayers} needed.`;
  else if (isHost) status = "Everyone's here. Starting matches comes with the game build.";

  return (
    <Screen>
      {header}

      <section className="mx-4 mt-1 flex items-center gap-[14px] rounded-card bg-white p-3">
        <div className="flex size-[72px] shrink-0 items-center justify-center overflow-hidden rounded-[12px] bg-paper">
          <ArtTile src={lagosArt.featured} className="h-[52px] w-16" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
          <p className="text-[11px] leading-[14px] font-bold tracking-wide text-ink-soft uppercase">{r.gameName}</p>
          <p className="text-[22px] leading-[26px] font-black tracking-tight text-ink">
            {r.seats.length} of {r.maxPlayers} seated
          </p>
          <p className="text-label leading-caption font-medium text-ink-soft">
            {r.minPlayers}–{r.maxPlayers} players
          </p>
        </div>
      </section>

      <ul className="flex flex-col gap-2 px-4 pt-4">
        {Array.from({ length: r.maxPlayers }, (_, i) => {
          const seat = r.seats[i];
          if (!seat) {
            return (
              <li
                key={`open-${i}`}
                className="flex items-center gap-3 rounded-[14px] border-[1.5px] border-dashed border-line px-3 py-2"
              >
                <div className="flex size-11 shrink-0 items-center justify-center rounded-pill bg-paper-deep text-[22px] leading-6 font-medium text-ink-soft">
                  +
                </div>
                <p className="flex-1 text-body leading-[18px] font-bold text-ink-soft">Open seat</p>
                {r.status === "open" && (
                  <button type="button" onClick={share} className="text-caption leading-caption font-bold text-lagoon">
                    Invite
                  </button>
                )}
              </li>
            );
          }
          const me = seat.player.id === userId;
          const host = seat.player.id === r.hostId;
          const role = [me && "You", host && "Host"].filter(Boolean).join(" · ") || "Player";
          return (
            <li key={seat.player.id} className="flex items-center gap-3 rounded-[14px] bg-white px-3 py-2">
              <Avatar person={seat.player} />
              <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
                <p className="truncate text-body leading-[18px] font-bold text-ink">{seat.player.displayName}</p>
                <p className="text-caption leading-caption font-semibold text-ink-soft">{role}</p>
              </div>
              <span className={`size-[14px] shrink-0 rounded-pill ${tokenShadow} ${seatTokens[i % seatTokens.length]}`} />
            </li>
          );
        })}
      </ul>

      <div className="mt-auto flex flex-col items-center gap-[10px] px-4 pt-3 pb-[max(28px,env(safe-area-inset-bottom))]">
        <p className="text-center text-label leading-caption font-medium text-ink-soft">{status}</p>
        <ErrorText>{errorMessage(join.error ?? leave.error)}</ErrorText>
        {r.status === "open" && !seated && (
          <Button variant="danfo" className="w-full" onClick={() => join.mutate()} disabled={join.isPending || full}>
            {full ? "Room is full" : join.isPending ? "Joining…" : "Take a seat"}
          </Button>
        )}
        {r.status === "open" && seated && (
          <div className={`${buttonClass("quiet", "lg")} w-full tracking-snug`}>
            {needed > 0 ? `Waiting for ${needed} more` : isHost ? "Start match soon" : "Waiting for host"}
          </div>
        )}
        {r.status === "open" && seated && (
          <button
            type="button"
            onClick={() => leave.mutate()}
            disabled={leave.isPending}
            className="text-[14px] leading-[18px] font-bold text-ink-soft disabled:opacity-60"
          >
            Leave room
          </button>
        )}
        {r.groupId && (
          <Link to="/groups/$groupId" params={{ groupId: r.groupId }} className="text-[14px] leading-[18px] font-bold text-lagoon">
            Back to group chat
          </Link>
        )}
      </div>
    </Screen>
  );
}
