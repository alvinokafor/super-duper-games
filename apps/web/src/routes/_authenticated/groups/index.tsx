import type { GroupSummary } from "@bankroll/contracts";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PlusIcon } from "@/components/icons";
import { ErrorText, errorMessage, GroupBadge, headerActionClass, Muted, Screen, ScreenTitle } from "@/components/ui";
import { meQuery } from "@/features/auth/queries/me";
import { groupsQuery } from "@/features/groups/api";
import { JoinByLink } from "@/features/rooms/join-by-link";
import { formatListTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/groups/")({
  component: GroupsPage,
});

function GroupsPage() {
  const groups = useQuery(groupsQuery);

  return (
    <Screen>
      <ScreenTitle
        title="Groups"
        action={
          <Link to="/groups/new" className={headerActionClass}>
            <PlusIcon />
            New group
          </Link>
        }
      />

      <div className="flex flex-col gap-2 px-4 pb-4">
        {groups.isPending && <Muted className="px-1">Loading…</Muted>}
        <ErrorText>{errorMessage(groups.error)}</ErrorText>
        {groups.data?.groups.length === 0 && (
          <div className="rounded-[18px] bg-white p-4">
            <Muted>You're not in any groups yet. Make one for the people you play with most.</Muted>
          </div>
        )}

        {groups.data?.groups.map((group) => (
          <GroupCard key={group.id} group={group} />
        ))}

        <div className="mt-2 flex flex-col gap-[10px] rounded-[18px] border-[1.5px] border-dashed border-dash-line p-3">
          <p className="text-caption leading-caption font-black tracking-[0.06em] text-ink-soft">HAVE AN INVITE?</p>
          <JoinByLink placeholder="Invite link or code" />
        </div>
      </div>
    </Screen>
  );
}

function GroupCard({ group }: { group: GroupSummary }) {
  const me = useQuery(meQuery);
  const last = group.lastMessage;
  const openRoom = last?.kind === "system" && last.roomId ? last.roomId : null;

  let preview = "No messages yet";
  if (last) {
    if (last.kind === "system" || !last.sender) preview = last.body;
    else if (last.sender.id === me.data?.id) preview = `You: ${last.body}`;
    else preview = `${last.sender.displayName.split(" ")[0]}: ${last.body}`;
  }

  return (
    <div
      className={`flex flex-col gap-[10px] rounded-[18px] bg-white p-3 ${openRoom ? "border-[1.5px] border-danfo" : ""}`}
    >
      <Link to="/groups/$groupId" params={{ groupId: group.id }} className="flex items-center gap-3">
        <GroupBadge group={group} />
        <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-body leading-5 font-black text-ink">{group.name}</p>
            {last && (
              <span className="shrink-0 text-caption leading-caption font-semibold text-muted">
                {formatListTime(last.createdAt)}
              </span>
            )}
          </div>
          <p className="truncate text-label leading-[18px] text-ink-soft">{preview}</p>
        </div>
      </Link>
      {openRoom && (
        <div className="flex items-center gap-[10px] rounded-[12px] bg-danfo-wash px-[10px] py-2">
          <span className="size-2 shrink-0 rounded-pill bg-[#D9534F]" />
          <p className="flex-1 text-label leading-caption font-bold text-ink">Lagos Property · room open</p>
          <Link
            to="/rooms/$roomId"
            params={{ roomId: openRoom }}
            className="flex h-[30px] items-center rounded-[9px] bg-danfo px-3 text-label leading-caption font-black text-ink"
          >
            Join
          </Link>
        </div>
      )}
    </div>
  );
}
