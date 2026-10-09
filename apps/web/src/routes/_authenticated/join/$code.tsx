import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BackIcon } from "@/components/icons";
import { backButtonClass, BottomBar, Button, buttonClass, ErrorText, errorMessage, GroupBadge, Muted, Screen } from "@/components/ui";
import { groupInviteQuery, useJoinGroupInvite } from "@/features/groups/api";

export const Route = createFileRoute("/_authenticated/join/$code")({
  component: JoinGroupPage,
});

function JoinGroupPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const invite = useQuery(groupInviteQuery(code.toUpperCase()));
  const join = useJoinGroupInvite();
  const data = invite.data;

  async function onJoin() {
    const { groupId } = await join.mutateAsync(code.toUpperCase());
    await navigate({ to: "/groups/$groupId", params: { groupId }, replace: true });
  }

  return (
    <Screen>
      <div className="flex items-center px-4 pb-1">
        <Link to="/groups" className={backButtonClass} aria-label="Back to groups">
          <BackIcon />
        </Link>
      </div>

      {invite.isPending && <Muted className="px-4 pt-4">Checking the invite…</Muted>}
      <ErrorText className="px-4 pt-4">{errorMessage(invite.error)}</ErrorText>

      {data && (
        <>
          <div className="flex flex-col items-center gap-1 px-4 pt-4">
            <p className="pb-2 text-caption leading-caption font-black tracking-[0.06em] text-ink-soft">GROUP INVITE</p>
            <GroupBadge group={data} size={76} />
            <h1 className="mt-[6px] text-center text-[22px] leading-[26px] font-black tracking-tight text-ink">{data.name}</h1>
            <p className="text-label leading-[18px] text-ink-soft">
              {data.memberCount} member{data.memberCount === 1 ? "" : "s"}
            </p>
          </div>

          <BottomBar>
            <ErrorText>{errorMessage(join.error)}</ErrorText>
            {data.isMember ? (
              <Link to="/groups/$groupId" params={{ groupId: data.groupId }} className={buttonClass("lagoon", "lg")}>
                You're already in. Open chat
              </Link>
            ) : data.isFull ? (
              <Muted className="text-center">This group is full.</Muted>
            ) : (
              <Button variant="lagoon" onClick={onJoin} disabled={join.isPending}>
                {join.isPending ? "Joining…" : "Join group"}
              </Button>
            )}
            <Link to="/groups" className="self-center pt-1 text-[14px] leading-[18px] font-bold text-ink-soft">
              Not now
            </Link>
          </BottomBar>
        </>
      )}
    </Screen>
  );
}
