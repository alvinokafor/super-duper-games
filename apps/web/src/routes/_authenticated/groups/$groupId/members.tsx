import { GROUP_CHANGED_EVENT, type GroupDetail, groupChannelName, groupNameSchema } from "@bankroll/contracts";
import { GAME_ID } from "@bankroll/lagos-rules";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { BackIcon } from "@/components/icons";
import {
  Avatar,
  backButtonClass,
  Button,
  buttonClass,
  ErrorText,
  errorMessage,
  GroupBadge,
  Muted,
  Screen,
  SectionLabel,
  TextArea,
  TextField,
} from "@/components/ui";
import {
  groupQuery,
  useAddGroupMembers,
  useRemoveGroupMember,
  useResetGroupInvite,
  useUpdateGroup,
} from "@/features/groups/api";
import { GroupColorPicker } from "@/features/groups/color-picker";
import { FriendPicker } from "@/features/groups/friend-picker";
import { useCreateRoom } from "@/features/rooms/api";
import { queryKeys } from "@/lib/query-keys";
import { useChannel } from "@/lib/realtime";
import { shareOrCopy } from "@/lib/share";

export const Route = createFileRoute("/_authenticated/groups/$groupId/members")({
  component: GroupInfoPage,
});

function GroupInfoPage() {
  const { groupId } = Route.useParams();
  const { userId } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const group = useQuery(groupQuery(groupId));
  const remove = useRemoveGroupMember(groupId);
  const createRoom = useCreateRoom();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);

  const refresh = () => void queryClient.invalidateQueries({ queryKey: queryKeys.group(groupId), exact: true });
  useChannel(groupChannelName(groupId), { [GROUP_CHANGED_EVENT]: refresh }, refresh);

  const header = (
    <div className="flex items-center justify-between px-4 pb-1">
      <Link to="/groups/$groupId" params={{ groupId }} className={backButtonClass} aria-label="Back to chat">
        <BackIcon />
      </Link>
      {group.data?.ownerId === userId && (
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className={`text-body leading-[18px] ${editing ? "font-bold text-ink-soft" : "font-black text-lagoon"}`}
        >
          {editing ? "Cancel" : "Edit"}
        </button>
      )}
    </div>
  );

  if (!group.data) {
    return (
      <Screen>
        {header}
        <div className="flex flex-col gap-3 px-4 pt-4">
          {group.isPending ? <Muted>Loading…</Muted> : <ErrorText>{errorMessage(group.error)}</ErrorText>}
          {!group.isPending && (
            <Link to="/groups" className="text-body leading-[18px] font-black text-lagoon">
              Back to groups
            </Link>
          )}
        </div>
      </Screen>
    );
  }

  const g = group.data;
  const isOwner = g.ownerId === userId;
  const full = g.members.length >= g.memberLimit;

  async function startGame() {
    const room = await createRoom.mutateAsync({ gameId: GAME_ID, groupId });
    await navigate({ to: "/rooms/$roomId", params: { roomId: room.id } });
  }

  async function leave() {
    if (!confirm(`Leave ${g.name}?`)) return;
    await remove.mutateAsync(userId);
    await navigate({ to: "/groups", replace: true });
  }

  return (
    <Screen>
      {header}

      {editing ? (
        <EditGroup group={g} onDone={() => setEditing(false)} />
      ) : (
        <div className="flex flex-col items-center gap-1 px-4 pb-3">
          <GroupBadge group={g} size={76} />
          <h1 className="mt-[6px] text-center text-[22px] leading-[26px] font-black tracking-tight text-ink">{g.name}</h1>
          <p className="text-center text-label leading-[18px] text-ink-soft">
            {g.description ?? `${g.members.length} of ${g.memberLimit} members`}
          </p>
        </div>
      )}

      <div className="flex gap-2 px-4">
        <Button size="md" variant="danfo" className="flex-1" disabled={createRoom.isPending} onClick={startGame}>
          {createRoom.isPending ? "Starting…" : "Start a game"}
        </Button>
        <Link to="/groups/$groupId" params={{ groupId }} className={`${buttonClass("outline", "md")} flex-1`}>
          Open chat
        </Link>
      </div>
      <ErrorText className="px-5 pt-2">{errorMessage(createRoom.error)}</ErrorText>

      <section className="mx-4 mt-3 flex flex-col rounded-[18px] bg-white px-[14px] py-1">
        <SectionLabel
          className="px-0 pt-[10px] pb-[6px]"
          action={
            !full && (
              <button
                type="button"
                onClick={() => setAdding((v) => !v)}
                className="text-label leading-caption font-black text-lagoon"
              >
                {adding ? "Close" : "+ Add"}
              </button>
            )
          }
        >
          Members · {g.members.length}
        </SectionLabel>

        {adding && (
          <div className="border-t border-divider py-3">
            <AddMembers groupId={groupId} memberIds={g.members.map((m) => m.id)} onDone={() => setAdding(false)} />
          </div>
        )}

        {g.members.map((member, i) => (
          <div
            key={member.id}
            className={`flex items-center gap-3 border-t border-divider pt-2 ${i === g.members.length - 1 ? "pb-[10px]" : "pb-2"}`}
          >
            <Avatar person={member} size={36} />
            <p className="min-w-0 flex-1 truncate text-[14px] leading-[18px] font-black text-ink">
              {member.displayName}
              {member.id === userId && " (you)"}
            </p>
            {member.id === g.ownerId ? (
              <span className="rounded-pill bg-lagoon-soft px-2 py-[3px] text-[11px] leading-[14px] font-black text-lagoon">
                Admin
              </span>
            ) : (
              isOwner && (
                <button
                  type="button"
                  disabled={remove.isPending}
                  onClick={() => {
                    if (confirm(`Remove ${member.displayName} from the group?`)) remove.mutate(member.id);
                  }}
                  className="text-label leading-caption font-bold text-alert disabled:opacity-60"
                >
                  Remove
                </button>
              )
            )}
          </div>
        ))}
        <ErrorText className="pb-2">{errorMessage(remove.error)}</ErrorText>
      </section>

      <InviteLink groupId={groupId} code={g.inviteCode} isOwner={isOwner} />

      <div className="mt-auto flex flex-col items-center gap-2 px-4 pt-6 pb-[max(34px,env(safe-area-inset-bottom))]">
        {isOwner && g.members.length > 1 && (
          <Muted className="text-center">If you leave, the longest-standing member becomes admin.</Muted>
        )}
        <button
          type="button"
          onClick={leave}
          disabled={remove.isPending}
          className="text-body leading-[18px] font-black text-alert disabled:opacity-60"
        >
          Leave group
        </button>
      </div>
    </Screen>
  );
}

function EditGroup({ group, onDone }: { group: GroupDetail; onDone: () => void }) {
  const update = useUpdateGroup(group.id);
  const [name, setName] = useState(group.name);
  const [color, setColor] = useState(group.color);
  const [description, setDescription] = useState(group.description ?? "");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = groupNameSchema.safeParse(name);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Enter a name");
    setError(null);
    update.mutate(
      { name: parsed.data, color, description },
      { onSuccess: onDone, onError: (err) => setError(errorMessage(err)) },
    );
  }

  return (
    <form onSubmit={onSubmit} className="mx-4 mb-3 flex flex-col gap-3 rounded-[20px] bg-white p-4">
      <div className="flex items-center gap-[14px]">
        <GroupBadge group={{ name: name || "?", color }} size={72} />
        <GroupColorPicker value={color} onChange={setColor} />
      </div>
      <TextField label="Group name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus />
      <TextArea
        label="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={160}
        placeholder="What's this group about?"
      />
      <ErrorText>{error}</ErrorText>
      <Button type="submit" size="form" variant="lagoon" disabled={update.isPending}>
        {update.isPending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}

function InviteLink({ groupId, code, isOwner }: { groupId: string; code: string; isOwner: boolean }) {
  const reset = useResetGroupInvite(groupId);
  const [copied, setCopied] = useState(false);

  async function share() {
    const result = await shareOrCopy({ title: "Join my group on Lagos Property", url: `${window.location.origin}/join/${code}` });
    if (result === "copied") {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <section className="mx-4 mt-[10px] flex flex-col rounded-[18px] bg-white px-[14px]">
      <div className="flex items-center justify-between gap-3 py-3">
        <div className="flex min-w-0 flex-col">
          <p className="text-[14px] leading-[18px] font-bold text-ink">Invite link</p>
          <p className="text-caption leading-caption font-semibold tracking-[0.08em] text-ink-soft">{code}</p>
        </div>
        <button type="button" onClick={share} className="text-[14px] leading-[18px] font-black text-lagoon">
          {copied ? "Copied" : "Share ›"}
        </button>
      </div>
      {isOwner && (
        <div className="flex items-center justify-between border-t border-divider py-3">
          <p className="text-[14px] leading-[18px] font-bold text-ink">Make a new link</p>
          <button
            type="button"
            disabled={reset.isPending}
            onClick={() => {
              if (confirm("Make a new link? The old one will stop working.")) reset.mutate();
            }}
            className="text-[14px] leading-[18px] font-semibold text-ink-soft disabled:opacity-60"
          >
            Reset ›
          </button>
        </div>
      )}
    </section>
  );
}

function AddMembers({ groupId, memberIds, onDone }: { groupId: string; memberIds: string[]; onDone: () => void }) {
  const add = useAddGroupMembers(groupId);
  const [selected, setSelected] = useState<string[]>([]);

  return (
    <div className="flex flex-col gap-2">
      <FriendPicker selected={selected} onChange={setSelected} exclude={memberIds} />
      <ErrorText>{errorMessage(add.error)}</ErrorText>
      {selected.length > 0 && (
        <Button
          size="form"
          variant="lagoon"
          disabled={add.isPending}
          onClick={() => add.mutate(selected, { onSuccess: onDone })}
        >
          {add.isPending ? "Adding…" : `Add ${selected.length} ${selected.length === 1 ? "friend" : "friends"}`}
        </Button>
      )}
    </div>
  );
}
