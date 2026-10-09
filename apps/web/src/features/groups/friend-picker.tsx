import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CheckIcon } from "@/components/icons";
import { Avatar, Muted } from "@/components/ui";
import { friendsQuery } from "@/features/friends/api";

export function FriendPicker({
  selected,
  onChange,
  exclude = [],
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
  exclude?: string[];
}) {
  const friends = useQuery(friendsQuery);
  const options = friends.data?.friends.filter((f) => !exclude.includes(f.id)) ?? [];

  if (friends.isPending) return <Muted className="px-1">Loading friends…</Muted>;
  if (options.length === 0) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-[14px] bg-white p-3">
        <Muted>{friends.data?.friends.length ? "All your friends are already here." : "You can only add friends."}</Muted>
        {!friends.data?.friends.length && (
          <Link to="/friends/add" className="text-label leading-caption font-black text-lagoon">
            Add friends first
          </Link>
        )}
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-[6px]">
      {options.map((friend) => {
        const checked = selected.includes(friend.id);
        return (
          <li key={friend.id}>
            <label
              className={`flex cursor-pointer items-center gap-3 rounded-[14px] border-[1.5px] px-3 py-2 ${
                checked ? "border-lagoon bg-lagoon-soft" : "border-transparent bg-white"
              }`}
            >
              <Avatar person={friend} size={36} />
              <span className="min-w-0 flex-1 truncate text-body leading-[18px] font-black text-ink">{friend.displayName}</span>
              <input
                type="checkbox"
                className="sr-only"
                checked={checked}
                onChange={() => onChange(checked ? selected.filter((id) => id !== friend.id) : [...selected, friend.id])}
              />
              <span
                aria-hidden
                className={`flex size-[22px] shrink-0 items-center justify-center rounded-[7px] ${
                  checked ? "bg-lagoon" : "border-[1.5px] border-check"
                }`}
              >
                {checked && <CheckIcon />}
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
