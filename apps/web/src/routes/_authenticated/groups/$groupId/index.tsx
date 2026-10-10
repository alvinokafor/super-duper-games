import {
  GROUP_CHANGED_EVENT,
  GROUP_MESSAGE_EVENT,
  type GroupMessage,
  groupChannelName,
  groupMessageSchema,
} from "@bankroll/contracts";
import { GAME_ID } from "@bankroll/lagos-rules";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";
import { BackIcon, SendIcon } from "@/components/icons";
import { Avatar, Button, ErrorText, errorMessage, GroupBadge, Muted, personTextColor, Screen } from "@/components/ui";
import { meQuery } from "@/features/auth/queries/me";
import { ArtTile, lagosArt } from "@/features/games/art";
import {
  groupMessagesQuery,
  groupQuery,
  groupsQuery,
  isPendingMessage,
  putMessageInCache,
  useMarkGroupRead,
  useSendGroupMessage,
} from "@/features/groups/api";
import { useCreateRoom } from "@/features/rooms/api";
import { ApiRequestError } from "@/lib/api-client";
import { formatClock, formatDayLabel, isSameDay, shortRoomCode } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import { useChannel } from "@/lib/realtime";

export const Route = createFileRoute("/_authenticated/groups/$groupId/")({
  component: GroupChatPage,
});

function GroupChatPage() {
  const { groupId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const me = useQuery(meQuery);
  const group = useQuery(groupQuery(groupId));
  const messages = useInfiniteQuery(groupMessagesQuery(groupId));
  const createRoom = useCreateRoom();
  const { mutate: markRead } = useMarkGroupRead(groupId);

  const unread = useQuery({ ...groupsQuery, select: (d) => d.groups.find((g) => g.id === groupId)?.unreadCount ?? 0 });
  const newest = messages.data?.pages[0]?.messages.find((m) => !isPendingMessage(m));
  const newestFromOthers = newest && newest.sender?.id !== me.data?.id ? newest.id : null;
  useEffect(() => {
    if (newestFromOthers || unread.data) markRead();
  }, [newestFromOthers, unread.data, markRead]);

  useChannel(
    groupChannelName(groupId),
    {
      [GROUP_MESSAGE_EVENT]: (payload) => {
        const message = groupMessageSchema.safeParse(payload);
        if (!message.success) return;
        putMessageInCache(queryClient, message.data);
        void queryClient.invalidateQueries({ queryKey: queryKeys.groups, exact: true });
      },
      [GROUP_CHANGED_EVENT]: () => void queryClient.invalidateQueries({ queryKey: queryKeys.group(groupId), exact: true }),
    },
    () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.group(groupId), exact: true });
      void queryClient.invalidateQueries({ queryKey: queryKeys.groupMessages(groupId) });
    },
  );

  if (group.error instanceof ApiRequestError && group.error.status === 404) {
    return (
      <Screen className="items-center justify-center gap-3 px-6 text-center">
        <p className="text-body leading-5 font-black text-ink">You're not in this group.</p>
        <Link to="/groups" className="text-body leading-[18px] font-black text-lagoon">
          Back to groups
        </Link>
      </Screen>
    );
  }

  async function startRoom() {
    const room = await createRoom.mutateAsync({ gameId: GAME_ID, groupId });
    await navigate({ to: "/rooms/$roomId", params: { roomId: room.id } });
  }

  const all = messages.data?.pages.flatMap((p) => p.messages) ?? [];
  const memberCount = group.data?.members.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-[10px] border-b border-edge bg-white px-4 pt-[calc(env(safe-area-inset-top)+16px)] pb-[10px]">
        <Link to="/groups" aria-label="Back to groups" className="-ml-1 p-1">
          <BackIcon size={20} />
        </Link>
        <Link to="/groups/$groupId/members" params={{ groupId }} className="flex min-w-0 flex-1 items-center gap-[10px]">
          {group.data && <GroupBadge group={group.data} size={40} />}
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[16px] leading-5 font-black text-ink">{group.data?.name ?? "…"}</span>
            <span className="text-caption leading-caption font-semibold text-ink-soft">
              {memberCount ? `${memberCount} member${memberCount === 1 ? "" : "s"} · Group info` : "\u00a0"}
            </span>
          </span>
        </Link>
        <Button size="sm" variant="danfo" className="px-3" onClick={startRoom} disabled={createRoom.isPending}>
          {createRoom.isPending ? "Starting…" : "Play"}
        </Button>
      </header>
      <ErrorText className="px-4 pt-2">{errorMessage(createRoom.error)}</ErrorText>

      <div className="flex min-h-0 flex-1 flex-col-reverse gap-[10px] overflow-y-auto px-4 py-3">
        {all.map((message, i) => {
          const newer = all[i - 1];
          const older = all[i + 1];
          const startsDay = !older || !isSameDay(older.createdAt, message.createdAt);
          const sameRun = (other: GroupMessage | undefined) =>
            other !== undefined &&
            other.kind === "text" &&
            message.kind === "text" &&
            other.sender?.id === message.sender?.id &&
            isSameDay(other.createdAt, message.createdAt);
          return (
            <MessageGroup
              key={message.clientId ?? message.id}
              message={message}
              mine={message.sender !== null && message.sender.id === me.data?.id}
              firstInRun={startsDay || !sameRun(older)}
              lastInRun={!sameRun(newer)}
              dayLabel={startsDay ? formatDayLabel(message.createdAt) : null}
            />
          );
        })}
        {messages.hasNextPage && (
          <button
            type="button"
            onClick={() => void messages.fetchNextPage()}
            disabled={messages.isFetchingNextPage}
            className="self-center py-2 text-label leading-caption font-black text-lagoon"
          >
            {messages.isFetchingNextPage ? "Loading…" : "Load earlier messages"}
          </button>
        )}
        {messages.isPending && <Muted className="self-center">Loading messages…</Muted>}
        {messages.data && all.length === 0 && (
          <Muted className="self-center text-center">No messages yet. Say hello, or tap Play to start a game.</Muted>
        )}
      </div>

      <Composer groupId={groupId} />
    </div>
  );
}

// In the reversed list, later siblings render above earlier ones.
function MessageGroup({
  message,
  mine,
  firstInRun,
  lastInRun,
  dayLabel,
}: {
  message: GroupMessage;
  mine: boolean;
  firstInRun: boolean;
  lastInRun: boolean;
  dayLabel: string | null;
}) {
  return (
    <>
      <MessageBubble message={message} mine={mine} firstInRun={firstInRun} lastInRun={lastInRun} />
      {dayLabel && <p className="self-center pt-2 text-[11px] leading-[14px] font-bold text-muted">{dayLabel}</p>}
    </>
  );
}

function MessageBubble({
  message,
  mine,
  firstInRun,
  lastInRun,
}: {
  message: GroupMessage;
  mine: boolean;
  firstInRun: boolean;
  lastInRun: boolean;
}) {
  const pending = isPendingMessage(message);
  const time = formatClock(message.createdAt);

  if (message.kind === "system") {
    return (
      <div className="flex flex-col items-center gap-[10px]">
        <p className="rounded-pill bg-segment px-[10px] py-[5px] text-center text-caption leading-caption font-semibold text-ink-soft">
          {message.body}
        </p>
        {message.roomId && <RoomCard roomId={message.roomId} />}
      </div>
    );
  }

  if (mine) {
    return (
      <div className="flex flex-col items-end gap-[2px]">
        <div
          className={`max-w-[250px] rounded-t-card rounded-br-tile rounded-bl-card bg-lagoon px-3 py-[9px] ${pending ? "opacity-60" : ""}`}
        >
          <p className="text-[14px] leading-[19px] break-words whitespace-pre-wrap text-white">{message.body}</p>
        </div>
        {lastInRun && (
          <p className="pr-1 text-[11px] leading-[14px] font-semibold text-muted">{pending ? "Sending…" : time}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-end gap-2">
      {lastInRun && message.sender ? <Avatar person={message.sender} size={28} /> : <div className="w-7 shrink-0" />}
      <div className="flex max-w-[250px] flex-col gap-[2px]">
        {firstInRun && (
          <p
            className={`pl-1 text-[11px] leading-[14px] font-black ${message.sender ? personTextColor(message.sender.id) : "text-muted"}`}
          >
            {message.sender?.displayName ?? "Former member"} · {time}
          </p>
        )}
        <div className="rounded-t-card rounded-br-card rounded-bl-tile bg-white px-3 py-[9px]">
          <p className="text-[14px] leading-[19px] break-words whitespace-pre-wrap text-ink">{message.body}</p>
        </div>
      </div>
    </div>
  );
}

function RoomCard({ roomId }: { roomId: string }) {
  return (
    <div className="flex w-[270px] flex-col self-start overflow-hidden rounded-t-card rounded-br-card rounded-bl-tile border-[1.5px] border-danfo bg-white">
      <div className="flex items-center gap-[10px] bg-lagoon px-3 py-[10px]">
        <ArtTile src={lagosArt.featured} className="size-10 shrink-0 rounded-button bg-lagoon-soft" />
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="text-[11px] leading-[14px] font-black tracking-[0.06em] text-danfo">LAGOS PROPERTY</p>
          <p className="text-body leading-[18px] font-black text-white">Game room</p>
        </div>
        <p className="text-[11px] leading-[14px] font-bold text-lagoon-mist">{shortRoomCode(roomId)}</p>
      </div>
      <div className="flex items-center gap-[10px] px-3 py-[10px]">
        <p className="flex-1 text-caption leading-caption font-bold text-ink-soft">See who's in</p>
        <Link
          to="/rooms/$roomId"
          params={{ roomId }}
          className="flex h-[34px] items-center rounded-button bg-danfo px-[14px] text-label leading-caption font-black text-ink"
        >
          Join game
        </Link>
      </div>
    </div>
  );
}

function Composer({ groupId }: { groupId: string }) {
  const me = useQuery(meQuery);
  const send = useSendGroupMessage(groupId, me.data);
  const [text, setText] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText("");
    send.mutate({ body, clientId: crypto.randomUUID() }, { onError: () => setText((current) => current || body) });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-1 border-t border-edge bg-white px-3 pt-[10px] pb-[max(30px,env(safe-area-inset-bottom))]"
    >
      <ErrorText>{send.isError ? "Message not sent. Try again." : null}</ErrorText>
      <div className="flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
          placeholder="Message the group"
          className="h-10 min-w-0 flex-1 rounded-[12px] bg-chip px-3 text-[14px] leading-[18px] text-ink outline-none placeholder:text-muted"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          aria-label="Send"
          className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-lagoon disabled:opacity-60"
        >
          <SendIcon />
        </button>
      </div>
    </form>
  );
}
