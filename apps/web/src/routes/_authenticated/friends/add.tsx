import type { Relationship } from "@bankroll/contracts";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { BackIcon } from "@/components/icons";
import {
  Avatar,
  Button,
  ErrorText,
  errorMessage,
  Muted,
  rowClass,
  Screen,
  SearchField,
  SectionLabel,
  backButtonClass,
} from "@/components/ui";
import { meQuery } from "@/features/auth/queries/me";
import { friendsQuery, useAcceptFriend, useRemoveFriend, userSearchQuery, useSendFriendRequest } from "@/features/friends/api";
import { RequestCard } from "@/features/friends/request-card";
import { shareOrCopy } from "@/lib/share";
import { useDebounced } from "@/lib/use-debounced";

export const Route = createFileRoute("/_authenticated/friends/add")({
  component: AddFriendsPage,
});

function AddFriendsPage() {
  const [text, setText] = useState("");
  const q = useDebounced(text.trim().toLowerCase().replace(/^@/, ""));
  const search = useQuery(userSearchQuery(q));
  const friends = useQuery(friendsQuery);
  const send = useSendFriendRequest();
  const accept = useAcceptFriend();
  const remove = useRemoveFriend();
  const busy = send.isPending || accept.isPending || remove.isPending;
  const incoming = friends.data?.incoming ?? [];

  return (
    <Screen>
      <div className="flex items-center gap-3 px-4 pb-3">
        <Link to="/friends" className={backButtonClass} aria-label="Back to friends">
          <BackIcon />
        </Link>
        <h1 className="text-section leading-title font-black tracking-[-0.02em] text-ink">Add friends</h1>
      </div>

      <div className="px-4">
        <SearchField value={text} onChange={setText} placeholder="Search by username" autoFocus />
      </div>

      <ErrorText className="px-5 pt-2">{errorMessage(send.error ?? accept.error ?? remove.error)}</ErrorText>

      {q.length >= 2 && (
        <section className="flex flex-col gap-[6px] px-4 pt-3">
          <SectionLabel>People</SectionLabel>
          {search.isPending && <Muted className="px-1">Searching…</Muted>}
          {search.data?.users.length === 0 && <Muted className="px-1">No one with a username starting “{q}”.</Muted>}
          {search.data?.users.map((user) => (
            <div key={user.id} className={rowClass}>
              <Avatar person={user} />
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="truncate text-body leading-5 font-black text-ink">{user.displayName}</p>
                <p className="truncate text-caption leading-caption text-ink-soft">@{user.username}</p>
              </div>
              <RelationshipAction
                relationship={user.relationship}
                busy={busy}
                onAdd={() => send.mutate(user.username)}
                onAccept={() => accept.mutate(user.id)}
                onCancel={() => remove.mutate(user.id)}
              />
            </div>
          ))}
        </section>
      )}

      {incoming.length > 0 && (
        <section className="flex flex-col gap-[6px] px-4 pt-4">
          <SectionLabel>Requests for you · {incoming.length}</SectionLabel>
          {incoming.map((person) => (
            <RequestCard
              key={person.id}
              person={person}
              busy={busy}
              onAccept={() => accept.mutate(person.id)}
              onDecline={() => remove.mutate(person.id)}
            />
          ))}
        </section>
      )}

      <UsernameCard />
    </Screen>
  );
}

function RelationshipAction({
  relationship,
  busy,
  onAdd,
  onAccept,
  onCancel,
}: {
  relationship: Relationship;
  busy: boolean;
  onAdd: () => void;
  onAccept: () => void;
  onCancel: () => void;
}) {
  switch (relationship) {
    case "friends":
      return <span className="text-label leading-caption font-black text-lagoon">Friends</span>;
    case "request_sent":
      return (
        <Button size="sm" variant="muted" className="px-3" disabled={busy} onClick={onCancel} aria-label="Cancel request">
          Request sent
        </Button>
      );
    case "request_received":
      return (
        <Button size="sm" variant="lagoon" disabled={busy} onClick={onAccept}>
          Accept
        </Button>
      );
    case "none":
      return (
        <Button size="sm" variant="lagoon" disabled={busy} onClick={onAdd}>
          Add
        </Button>
      );
  }
}

function UsernameCard() {
  const me = useQuery(meQuery);
  const [copied, setCopied] = useState(false);
  if (!me.data) return null;
  const username = me.data.username;

  async function share() {
    const result = await shareOrCopy({
      title: "Lagos Property",
      text: `Add me on Lagos Property. My username is @${username}.`,
      url: window.location.origin,
    });
    if (result === "copied") {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="mt-auto px-4 pt-6 pb-[max(34px,env(safe-area-inset-bottom))]">
    <div className="flex items-center gap-3 rounded-card bg-ink px-4 py-[14px]">
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="text-[11px] leading-[14px] font-black tracking-[0.06em] text-danfo">YOUR USERNAME</p>
        <p className="truncate text-[18px] leading-body font-black tracking-[0.04em] text-white">@{username}</p>
      </div>
      <button
        type="button"
        onClick={share}
        className="flex h-9 shrink-0 items-center rounded-button bg-[#2E3A34] px-[14px] text-label leading-caption font-black text-white"
      >
        {copied ? "Copied" : "Share"}
      </button>
    </div>
    </div>
  );
}
