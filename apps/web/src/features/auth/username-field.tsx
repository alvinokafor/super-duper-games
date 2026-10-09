import { usernameSchema } from "@bankroll/contracts";
import { useQuery } from "@tanstack/react-query";
import { useDebounced } from "@/lib/use-debounced";
import { usernameAvailableQuery } from "./queries/me";

export type UsernameStatus = "invalid" | "checking" | "taken" | "available" | "unchanged";

export function useUsernameStatus(value: string, current?: string): { status: UsernameStatus; message: string } {
  const parsed = usernameSchema.safeParse(value);
  const normalized = parsed.success ? parsed.data : "";
  const debounced = useDebounced(normalized);
  const unchanged = normalized !== "" && normalized === current;
  const availability = useQuery({
    ...usernameAvailableQuery(debounced),
    enabled: debounced !== "" && !unchanged,
  });

  if (!parsed.success) {
    return { status: "invalid", message: value ? (parsed.error.issues[0]?.message ?? "Invalid username") : "" };
  }
  if (unchanged) return { status: "unchanged", message: "" };
  if (debounced !== normalized || availability.isPending) return { status: "checking", message: "Checking…" };
  if (availability.isError) return { status: "checking", message: "Couldn't check right now" };
  return availability.data.available
    ? { status: "available", message: `@${normalized} is free` }
    : { status: "taken", message: `@${normalized} is taken` };
}

export function UsernameField({
  value,
  onChange,
  status,
}: {
  value: string;
  onChange: (value: string) => void;
  status: { status: UsernameStatus; message: string };
}) {
  const color = status.status === "available" ? "text-lagoon" : status.status === "checking" ? "text-ink-soft" : "text-alert";
  return (
    <label className="flex flex-col gap-[6px]">
      <span className="text-caption leading-caption font-bold text-ink-soft">Username</span>
      <span className="flex h-[46px] items-center gap-1 rounded-[12px] border border-edge bg-white px-[14px] focus-within:border-lagoon focus-within:shadow-[0_0_0_0.5px_#206B52]">
        <span className="text-body leading-[18px] font-bold text-muted">@</span>
        <input
          name="username"
          required
          placeholder="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value.toLowerCase())}
          className="h-full min-w-0 flex-1 bg-transparent text-body leading-[18px] font-bold text-ink outline-none placeholder:font-normal placeholder:text-muted"
        />
      </span>
      {status.message && <span className={`text-caption leading-caption font-semibold ${color}`}>{status.message}</span>}
    </label>
  );
}
