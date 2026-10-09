import { GAME_ID } from "@bankroll/lagos-rules";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { BellIcon, InviteFriendIcon, JoinRoomIcon, PlusIcon } from "@/components/icons";
import { Avatar, Screen, SectionTitle } from "@/components/ui";
import { meQuery } from "@/features/auth/queries/me";
import { friendsQuery } from "@/features/friends/api";
import { LagosHeroStrip } from "@/features/games/art";
import { JoinByLink } from "@/features/rooms/join-by-link";
import { greeting } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/")({
  component: HomePage,
});

function HomePage() {
  const me = useQuery(meQuery);
  const friends = useQuery(friendsQuery);
  const requests = friends.data?.incoming.length ?? 0;
  const [joining, setJoining] = useState(false);

  return (
    <Screen>
      <header className="flex items-center gap-[10px] px-4 pb-3">
        {me.data && <Avatar person={me.data} size={40} />}
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="text-caption leading-caption font-semibold text-ink-soft">{greeting()}</p>
          <p className="truncate text-[18px] leading-body font-black tracking-[-0.02em] text-ink">
            {me.data?.displayName.split(" ")[0] ?? "\u00a0"}
          </p>
        </div>
        <Link
          to="/friends"
          search={{ tab: "requests" }}
          aria-label={requests ? `${requests} friend requests` : "Friend requests"}
          className="relative flex size-10 shrink-0 items-center justify-center rounded-[12px] border border-edge bg-white"
        >
          <BellIcon />
          {requests > 0 && (
            <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-pill border-2 border-[#F4F5F2] bg-alert text-[10px] leading-3 font-black text-white">
              {requests}
            </span>
          )}
        </Link>
      </header>

      <section className="mx-4 flex flex-col overflow-hidden rounded-[20px] bg-lagoon">
        <LagosHeroStrip badge="FEATURED" />
        <div className="flex flex-col gap-1 px-4 pt-[10px] pb-[14px]">
          <h2 className="text-[22px] leading-[26px] font-black tracking-tight text-white">Lagos Property</h2>
          <p className="text-[14px] leading-[19px] text-lagoon-mist">
            Buy the city from Ajegunle to Banana Island. Build, lend and outlast your friends.
          </p>
          <div className="mt-[10px] flex items-center gap-3">
            <div className="flex flex-1 gap-[6px]">
              <span className="rounded-pill bg-lagoon-mid px-[9px] py-[5px] text-caption leading-caption font-bold text-white">
                3–6 players
              </span>
              <span className="rounded-pill bg-lagoon-mid px-[9px] py-[5px] text-caption leading-caption font-bold text-white">
                45–60 min
              </span>
            </div>
            <Link
              to="/games/$gameId"
              params={{ gameId: GAME_ID }}
              className="flex h-11 items-center rounded-[14px] bg-danfo px-5 text-body leading-[18px] font-black text-ink"
            >
              Play now
            </Link>
          </div>
        </div>
      </section>

      <div className="flex gap-2 px-4 pt-3">
        <QuickAction label="Create room" tint="bg-lagoon-soft" icon={<PlusIcon color="#206B52" size={18} />}>
          {(className, children) => (
            <Link to="/games/$gameId" params={{ gameId: GAME_ID }} className={className}>
              {children}
            </Link>
          )}
        </QuickAction>
        <QuickAction label="Join room" tint="bg-danfo-soft" icon={<JoinRoomIcon />}>
          {(className, children) => (
            <button type="button" onClick={() => setJoining((v) => !v)} aria-expanded={joining} className={className}>
              {children}
            </button>
          )}
        </QuickAction>
        <QuickAction label="Invite friends" tint="bg-[#F6E0EA]" icon={<InviteFriendIcon />}>
          {(className, children) => (
            <Link to="/friends/add" className={className}>
              {children}
            </Link>
          )}
        </QuickAction>
      </div>
      {joining && (
        <div className="mx-4 mt-2 rounded-card bg-white p-3">
          <JoinByLink placeholder="Paste a room or group link" autoFocus />
        </div>
      )}

      <FriendsStrip />

      <div className="flex flex-col gap-2 px-4 pt-3 pb-4">
        <div className="flex items-center gap-[10px] rounded-card border-[1.5px] border-dashed border-dash-line px-3 py-[10px]">
          <div className="flex">
            <div className="size-7 shrink-0 rounded-[9px] bg-[#E7E1F1]" />
            <div className="-ml-2 size-7 shrink-0 rounded-[9px] border-2 border-[#F4F5F2] bg-danfo-soft" />
          </div>
          <p className="flex-1 text-label leading-caption font-bold text-ink-soft">More games coming soon</p>
        </div>
      </div>
    </Screen>
  );
}

function QuickAction({
  label,
  tint,
  icon,
  children,
}: {
  label: string;
  tint: string;
  icon: ReactNode;
  children: (className: string, content: ReactNode) => ReactNode;
}) {
  return children(
    "flex flex-1 flex-col items-center gap-[6px] rounded-card bg-white py-[10px]",
    <>
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-[12px] ${tint}`}>{icon}</span>
      <span className="text-label leading-caption font-bold text-ink">{label}</span>
    </>,
  );
}

function FriendsStrip() {
  const friends = useQuery(friendsQuery);
  const list = friends.data?.friends ?? [];
  if (!friends.data) return null;

  return (
    <section className="flex flex-col gap-2 pt-3 pl-4">
      <div className="pr-4">
        <SectionTitle
          action={
            <Link to="/friends" className="text-label leading-caption font-bold text-lagoon">
              See all
            </Link>
          }
        >
          Friends · {list.length}
        </SectionTitle>
      </div>
      {list.length === 0 ? (
        <Link to="/friends/add" className="mr-4 rounded-card bg-white px-3 py-[10px] text-label leading-[18px] text-ink-soft">
          No friends yet. <span className="font-black text-lagoon">Find people by username</span>
        </Link>
      ) : (
        <ul className="flex gap-[14px] overflow-x-auto pr-4">
          {list.map((friend) => (
            <li key={friend.id}>
              <Link
                to="/friends/$userId"
                params={{ userId: friend.id }}
                className="flex w-[60px] shrink-0 flex-col items-center gap-1"
              >
                <Avatar person={friend} size={52} />
                <span className="w-full truncate text-center text-caption leading-caption font-bold text-ink">
                  {friend.displayName.split(" ")[0]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
