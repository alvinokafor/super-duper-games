import { useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { Button, ErrorText } from "@/components/ui";
import { parseInvite } from "./parse-invite";

export function JoinByLink({ placeholder, autoFocus }: { placeholder: string; autoFocus?: boolean }) {
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const target = parseInvite(value);
    if (!target) return setError("Paste a room link, a group invite link, or an 8-letter code.");
    setError(null);
    if (target.kind === "room") void navigate({ to: "/rooms/$roomId", params: { roomId: target.roomId } });
    else void navigate({ to: "/join/$code", params: { code: target.code } });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoCapitalize="none"
          autoComplete="off"
          spellCheck={false}
          className="h-10 min-w-0 flex-1 rounded-[12px] border border-edge bg-white px-3 text-[14px] leading-[18px] font-semibold text-ink outline-none placeholder:font-normal placeholder:text-muted focus:border-lagoon"
        />
        <Button type="submit" size="form" variant="lagoon" disabled={!value.trim()}>
          Open
        </Button>
      </div>
      <ErrorText>{error}</ErrorText>
    </form>
  );
}
