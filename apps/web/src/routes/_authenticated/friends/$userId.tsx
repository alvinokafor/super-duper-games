import { GAME_ID } from "@bankroll/lagos-rules";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BackIcon } from "@/components/icons";
import { Avatar, BottomBar, buttonClass, ErrorText, errorMessage, Muted, Screen } from "@/components/ui";
import { friendsQuery, useRemoveFriend } from "@/features/friends/api";

export const Route = createFileRoute("/_authenticated/friends/$userId")({
  component: FriendProfilePage,
});

function FriendProfilePage() {
  const { userId } = Route.useParams();
  const navigate = useNavigate();
  const friends = useQuery(friendsQuery);
  const remove = useRemoveFriend();
  const friend = friends.data?.friends.find((f) => f.id === userId);

  async function removeFriend() {
    if (!friend || !confirm(`Remove ${friend.displayName} from your friends?`)) return;
    await remove.mutateAsync(friend.id);
    await navigate({ to: "/friends", replace: true });
  }

  if (friends.data && !friend) {
    return (
      <Screen className="px-4">
        <Muted>This person isn't on your friends list.</Muted>
        <Link to="/friends" className="pt-3 text-body leading-[18px] font-black text-lagoon">
          Back to friends
        </Link>
      </Screen>
    );
  }

  return (
    <main className="flex min-h-full flex-col">
      <header className="flex flex-col items-center bg-navy pt-[calc(env(safe-area-inset-top)+16px)] pb-[22px]">
        <div className="flex self-stretch px-4">
          <Link
            to="/friends"
            aria-label="Back to friends"
            className="flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-navy-mid"
          >
            <BackIcon color="#FFFFFF" />
          </Link>
        </div>
        {friend && (
          <>
            <Avatar person={friend} size={96} className="mt-1 border-[3px] border-white bg-origin-border" />
            <h1 className="mt-[10px] px-4 text-center text-[24px] leading-[28px] font-black tracking-tight text-white">
              {friend.displayName}
            </h1>
            <p className="mt-[2px] text-[14px] leading-[18px] font-semibold text-navy-mist">@{friend.username}</p>
          </>
        )}
      </header>

      {friend && (
        <div className="flex flex-col gap-3 px-4 pt-4">
          <div className="flex flex-col items-center gap-[2px] rounded-card bg-white py-3">
            <p className="text-section leading-title font-black text-ink">
              {new Date(friend.since).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}
            </p>
            <p className="text-caption leading-caption font-semibold text-ink-soft">Friends since</p>
          </div>
        </div>
      )}

      <BottomBar>
        <ErrorText>{errorMessage(remove.error)}</ErrorText>
        <Link to="/games/$gameId" params={{ gameId: GAME_ID }} className={buttonClass("danfo", "lg")}>
          Invite to a game
        </Link>
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={removeFriend}
            disabled={remove.isPending || !friend}
            className="text-[14px] leading-[18px] font-bold text-ink-soft disabled:opacity-60"
          >
            Remove friend
          </button>
        </div>
      </BottomBar>
    </main>
  );
}
