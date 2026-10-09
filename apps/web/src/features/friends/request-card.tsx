import type { PublicProfile } from "@bankroll/contracts";
import { Avatar, Button } from "@/components/ui";

export function RequestCard({
  person,
  busy,
  onAccept,
  onDecline,
}: {
  person: PublicProfile;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <div className="flex flex-col gap-[10px] rounded-[14px] bg-white p-3">
      <div className="flex items-center gap-3">
        <Avatar person={person} />
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="truncate text-body leading-5 font-black text-ink">{person.displayName}</p>
          <p className="truncate text-caption leading-caption text-ink-soft">@{person.username}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="form" variant="lagoon" className="flex-1" disabled={busy} onClick={onAccept}>
          Accept
        </Button>
        <Button size="form" variant="ghost" className="flex-1" disabled={busy} onClick={onDecline}>
          Decline
        </Button>
      </div>
    </div>
  );
}
