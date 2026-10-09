import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { z } from "zod";
import { ChevronIcon, PlusIcon } from "@/components/icons";
import {
  Avatar,
  Button,
  CountBadge,
  ErrorText,
  errorMessage,
  headerActionClass,
  Muted,
  rowClass,
  Screen,
  ScreenTitle,
  SectionLabel,
} from "@/components/ui";
import { friendsQuery, useAcceptFriend, useRemoveFriend } from "@/features/friends/api";
import { RequestCard } from "@/features/friends/request-card";

const tabSchema = z.enum(["all", "requests", "sent"]);
type Tab = z.infer<typeof tabSchema>;

export const Route = createFileRoute("/_authenticated/friends/")({
  validateSearch: z.object({ tab: tabSchema.optional() }),
  component: FriendsPage,
});

function FriendsPage() {
  const { tab = "all" } = Route.useSearch();
  const friends = useQuery(friendsQuery);
  const accept = useAcceptFriend();
  const remove = useRemoveFriend();
  const data = friends.data;

  return (
    <Screen>
      <ScreenTitle
        title="Friends"
        action={
          <Link to="/friends/add" className={headerActionClass}>
            <PlusIcon />
            Add
          </Link>
        }
      />

      <nav className="mx-4 flex gap-1 rounded-[14px] bg-segment p-1">
        <TabLink tab="all" current={tab}>
          All · {data?.friends.length ?? 0}
        </TabLink>
        <TabLink tab="requests" current={tab}>
          Requests
          <CountBadge count={data?.incoming.length ?? 0} />
        </TabLink>
        <TabLink tab="sent" current={tab}>
          Sent · {data?.outgoing.length ?? 0}
        </TabLink>
      </nav>

      <div className="flex flex-col gap-[6px] px-4 pt-[14px] pb-4">
        {friends.isPending && <Muted className="px-1">Loading…</Muted>}
        <ErrorText>{errorMessage(friends.error ?? accept.error ?? remove.error)}</ErrorText>

        {data && tab === "all" && (
          <>
            {data.friends.length === 0 ? (
              <EmptyState text="No friends yet. Search for someone's username to add them." />
            ) : (
              data.friends.map((friend) => (
                <Link key={friend.id} to="/friends/$userId" params={{ userId: friend.id }} className={rowClass}>
                  <Avatar person={friend} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="truncate text-body leading-5 font-black text-ink">{friend.displayName}</p>
                    <p className="truncate text-caption leading-caption font-semibold text-ink-soft">@{friend.username}</p>
                  </div>
                  <ChevronIcon />
                </Link>
              ))
            )}
          </>
        )}

        {data && tab === "requests" && (
          <>
            {data.incoming.length === 0 ? (
              <EmptyState text="No requests right now." />
            ) : (
              <>
                <SectionLabel>Requests for you · {data.incoming.length}</SectionLabel>
                {data.incoming.map((person) => (
                  <RequestCard
                    key={person.id}
                    person={person}
                    busy={accept.isPending || remove.isPending}
                    onAccept={() => accept.mutate(person.id)}
                    onDecline={() => remove.mutate(person.id)}
                  />
                ))}
              </>
            )}
          </>
        )}

        {data && tab === "sent" && (
          <>
            {data.outgoing.length === 0 ? (
              <EmptyState text="You have no requests waiting." />
            ) : (
              data.outgoing.map((person) => (
                <div key={person.id} className={rowClass}>
                  <Avatar person={person} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="truncate text-body leading-5 font-black text-ink">{person.displayName}</p>
                    <p className="truncate text-caption leading-caption text-ink-soft">@{person.username}</p>
                  </div>
                  <Button size="sm" variant="muted" className="px-3" disabled={remove.isPending} onClick={() => remove.mutate(person.id)}>
                    Cancel request
                  </Button>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </Screen>
  );
}

function TabLink({ tab, current, children }: { tab: Tab; current: Tab; children: ReactNode }) {
  const active = tab === current;
  return (
    <Link
      to="/friends"
      search={tab === "all" ? {} : { tab }}
      replace
      className={`flex h-9 flex-1 items-center justify-center gap-[6px] rounded-button text-[14px] leading-[18px] ${
        active ? "bg-white font-black text-ink" : "font-bold text-ink-soft"
      }`}
    >
      {children}
    </Link>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-[14px] bg-white p-4">
      <Muted>{text}</Muted>
      <Link to="/friends/add" className="text-label leading-caption font-black text-lagoon">
        Add friends
      </Link>
    </div>
  );
}
