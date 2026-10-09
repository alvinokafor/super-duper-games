import { GROUP_MEMBER_LIMIT, groupNameSchema } from "@bankroll/contracts";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { BottomBar, Button, ErrorText, errorMessage, GroupBadge, Screen, SectionLabel, TextField } from "@/components/ui";
import { useCreateGroup } from "@/features/groups/api";
import { FriendPicker } from "@/features/groups/friend-picker";

export const Route = createFileRoute("/_authenticated/groups/new")({
  component: NewGroupPage,
});

function NewGroupPage() {
  const navigate = useNavigate();
  const create = useCreateGroup();
  const [name, setName] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = groupNameSchema.safeParse(name);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Enter a group name");
    if (memberIds.length > GROUP_MEMBER_LIMIT - 1) return setError(`Groups can have at most ${GROUP_MEMBER_LIMIT} members`);
    setError(null);
    try {
      const group = await create.mutateAsync({ name: parsed.data, memberIds });
      await navigate({ to: "/groups/$groupId", params: { groupId: group.id }, replace: true });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const people = memberIds.length + 1;

  return (
    <Screen>
      <form onSubmit={onSubmit} className="flex flex-1 flex-col">
        <div className="flex items-center justify-between px-4 pb-[10px]">
          <Link to="/groups" className="w-[60px] shrink-0 text-body leading-[18px] font-bold text-ink-soft">
            Cancel
          </Link>
          <h1 className="text-title leading-body font-black text-ink">New group</h1>
          <div className="w-[60px] shrink-0" />
        </div>

        <div className="mx-4 flex flex-col gap-3 rounded-[20px] bg-white p-4">
          <div className="flex items-center gap-[14px]">
            <GroupBadge group={{ name: name || "?" }} size={72} />
            <TextField
              label="Group name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              placeholder="Friday Night Table"
              autoFocus
              className="min-w-0 flex-1"
            />
          </div>
        </div>

        <section className="flex flex-col gap-[6px] px-4 pt-[14px]">
          <SectionLabel
            action={
              memberIds.length > 0 && (
                <span className="text-caption leading-caption font-black text-lagoon">{memberIds.length} selected</span>
              )
            }
          >
            Add members
          </SectionLabel>
          <FriendPicker selected={memberIds} onChange={setMemberIds} />
        </section>

        <BottomBar>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" variant="lagoon" disabled={create.isPending}>
            {create.isPending ? "Creating…" : `Create group · ${people} ${people === 1 ? "person" : "people"}`}
          </Button>
        </BottomBar>
      </form>
    </Screen>
  );
}
