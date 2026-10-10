import { type LagosPublicState, netWorth } from "@bankroll/lagos-rules";
import type { PublicProfile } from "@bankroll/contracts";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui";
import { formatNaira, formatShortNaira } from "@/lib/format";
import { seatRing } from "./tokens";

const RING = 2 * Math.PI * 13.25;

/** Time left in the current phase, drawn from the server deadline. */
export function TurnTimer({
  deadline,
  totalSeconds,
  track = "#E4E1DB",
}: {
  deadline: string | null;
  totalSeconds: number;
  track?: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [deadline]);

  const left = deadline ? Math.max(0, new Date(deadline).getTime() - now) / 1000 : 0;
  const fraction = Math.min(1, left / totalSeconds);
  const seconds = Math.ceil(left);

  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 36 36"
      className="shrink-0"
      role="timer"
      aria-label={deadline ? `${seconds} seconds left` : "No timer"}
    >
      <circle cx="18" cy="18" r="15" fill="#FFFFFF" />
      <circle cx="18" cy="18" r="13.25" fill="none" stroke={track} strokeWidth="2.5" />
      <circle
        cx="18"
        cy="18"
        r="13.25"
        transform="rotate(-90 18 18)"
        fill="none"
        stroke={seconds <= 5 ? "#E76D62" : "#F5BF45"}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={RING}
        strokeDashoffset={RING * (1 - fraction)}
      />
      {deadline && seconds <= 9 ? (
        <text x="18" y="22" textAnchor="middle" className="fill-ink text-[11px] font-black">
          {seconds}
        </text>
      ) : (
        <g transform="translate(12.2 12.2)">
          <circle cx="5.8" cy="5.8" r="4.4" fill="none" stroke="#202A25" strokeWidth="1.4" />
          <path d="M5.8 3.2V6.1L7.8 7.3" fill="none" stroke="#202A25" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
    </svg>
  );
}

const pipSpots: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export function Die({ value }: { value: number }) {
  return (
    <div
      role="img"
      aria-label={`Rolled ${value}`}
      className="grid size-[76px] grid-cols-3 grid-rows-3 place-items-center rounded-[17px] border border-[#E6E2DA] bg-white p-[14px] shadow-[inset_0_2px_1px_#FFFFFF,inset_0_-3px_4px_#202A2514,0_2px_1px_#202A2529,0_14px_24px_#202A2538]"
    >
      {Array.from({ length: 9 }, (_, i) => (
        <span
          key={i}
          className={`size-[11px] rounded-pill ${pipSpots[value]?.includes(i) ? "bg-ink shadow-[inset_0_2px_1px_#FFFFFF66,inset_0_-2px_2px_#00000059]" : ""}`}
        />
      ))}
    </div>
  );
}

export function RollPill({ dotClass, text }: { dotClass: string; text: string }) {
  return (
    <div className="flex h-7 items-center justify-center gap-[6px] rounded-pill border border-[#E6E2DA] bg-white px-3 shadow-[0_4px_10px_#202A2524]">
      <span className={`size-2 shrink-0 rounded-pill ${dotClass}`} />
      <span className="text-caption leading-caption font-black whitespace-nowrap text-ink">{text}</span>
    </div>
  );
}

function TokenAvatar({
  person,
  seat,
  size,
  active,
  out,
}: {
  person: PublicProfile;
  seat: number;
  size: 28 | 36;
  active: boolean;
  out: boolean;
}) {
  return (
    <Avatar
      person={person}
      size={size}
      className={`ring-2 ${active ? "ring-danfo ring-offset-1" : seatRing(seat)} ${out ? "opacity-40 grayscale" : ""}`}
    />
  );
}

export function PlayerStrip({
  state,
  myId,
  profiles,
}: {
  state: LagosPublicState;
  myId: string;
  profiles: Map<string, PublicProfile>;
}) {
  const me = state.players.find((p) => p.id === myId);
  const others = state.players.filter((p) => p.id !== myId);
  const unknown = (id: string): PublicProfile => ({ id, username: "", displayName: "Player", avatarUrl: null });

  return (
    <div className="flex items-center gap-2 px-3 pt-3">
      {me && (
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-[14px] border border-line bg-white px-[10px] py-2">
          <TokenAvatar
            person={profiles.get(me.id) ?? unknown(me.id)}
            seat={me.seat}
            size={36}
            active={state.currentPlayerId === me.id && state.phase !== "finished"}
            out={me.status !== "playing"}
          />
          <div className="flex min-w-0 flex-col gap-px">
            <p className="truncate text-caption leading-caption font-bold text-ink">
              {profiles.get(me.id)?.displayName ?? "You"}
              {me.status !== "playing" && " · Out"}
            </p>
            <p className="text-body leading-[18px] font-black tracking-[-0.02em] whitespace-nowrap text-ink">
              Cash {formatNaira(me.cash)}
            </p>
            <p className="text-[11px] leading-[14px] font-bold whitespace-nowrap text-lagoon">
              Net worth {formatNaira(netWorth(state, me.id))}
            </p>
          </div>
        </div>
      )}
      {others.map((p) => {
        const person = profiles.get(p.id) ?? unknown(p.id);
        const out = p.status !== "playing";
        return (
          <div
            key={p.id}
            className={`flex shrink-0 flex-col items-center gap-[3px] ${others.length > 3 ? "w-11" : "w-[52px]"}`}
            title={person.displayName}
          >
            <TokenAvatar person={person} seat={p.seat} size={28} active={state.currentPlayerId === p.id && state.phase !== "finished"} out={out} />
            <span className="sr-only">{person.displayName}</span>
            <span className="text-[11px] leading-[14px] font-bold text-ink-soft">{out ? "Out" : formatShortNaira(p.cash)}</span>
          </div>
        );
      })}
    </div>
  );
}
