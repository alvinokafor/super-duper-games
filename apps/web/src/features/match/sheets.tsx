import type { MatchMessage, PublicProfile } from "@bankroll/contracts";
import {
  BOARD,
  BUILDING_IDS,
  BUILDINGS,
  type BuildingId,
  type BuyableSpace,
  buildingStats,
  buildingsOn,
  CORRIDORS,
  type CorridorId,
  checkBuild,
  corridorCount,
  corridorSpaces,
  type LagosPublicState,
  netWorth,
  phaseSeconds,
  type Slot,
} from "@bankroll/lagos-rules";
import { Link } from "@tanstack/react-router";
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { Avatar, ErrorText, errorMessage, personTextColor } from "@/components/ui";
import { ArtTile, lagosArt } from "@/features/games/art";
import { formatNaira } from "@/lib/format";
import { corridorLook } from "./board/board-layout";
import { TurnTimer } from "./parts";

function Sheet({ children, onDismiss, label }: { children: ReactNode; onDismiss?: () => void; label: string }) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-[#17211D80] px-4 pt-4 pb-[max(24px,env(safe-area-inset-bottom))]"
      onClick={(e) => e.target === e.currentTarget && onDismiss?.()}
      onKeyDown={(e) => e.key === "Escape" && onDismiss?.()}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div className="flex max-h-full w-full max-w-[420px] flex-col overflow-hidden rounded-[20px] bg-white">{children}</div>
    </div>
  );
}

const timerTrack: Record<CorridorId, string> = {
  island_elite: "#F8EFD4",
  lekki: "#D7F1EE",
  mainland_premium: "#EBE4F4",
  mainland_central: "#F3D2CE",
  mainland_residential: "#FDE8D6",
  mainland_low_cost: "#F6E7D8",
};

const unlocks = ["", "unlocks shops", "unlocks houses and offices", "completes the corridor and unlocks hotels"];

function listNames(names: string[]) {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

export function BuySheet({
  space,
  state,
  myId,
  deadline,
  busy,
  error,
  onBuy,
  onPass,
}: {
  space: BuyableSpace;
  state: LagosPublicState;
  myId: string;
  deadline: string | null;
  busy: boolean;
  error: unknown;
  onBuy: () => void;
  onPass: () => void;
}) {
  const cash = state.players.find((p) => p.id === myId)?.cash ?? 0;
  const canAfford = cash >= space.price;

  let header = "bg-night";
  let subtitle = "Utility · For sale";
  let track = "#E4E1DB";
  let progress: ReactNode;

  if (space.kind === "property") {
    const look = corridorLook[space.corridor];
    const corridor = CORRIDORS[space.corridor];
    const held = corridorSpaces(space.corridor).filter((i) => state.owners[i] === myId);
    const heldText = held.length ? `You hold ${listNames(held.map((i) => BOARD[i]!.name))}.` : "You hold none yet.";
    header = look.solid;
    subtitle = `${corridor.name} · For sale`;
    track = timerTrack[space.corridor];
    progress = (
      <div className={`flex flex-col gap-[6px] rounded-[12px] p-3 ${look.soft}`}>
        <div className="flex items-center justify-between">
          <p className={`text-label leading-caption font-bold ${look.ink}`}>
            {corridor.short} · {held.length} of 3
          </p>
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`size-[10px] shrink-0 rounded-pill ${i < held.length ? look.solid : `border-[1.5px] bg-white ${look.ring}`}`}
              />
            ))}
          </div>
        </div>
        <p className={`text-label leading-[18px] font-medium ${look.ink}`}>
          {heldText} This buy makes {held.length + 1} of 3, and {unlocks[held.length + 1]}.
        </p>
      </div>
    );
  } else {
    const held = BOARD.filter((s, i) => s.kind === "utility" && state.owners[i] === myId).length;
    progress = (
      <div className="flex flex-col gap-[6px] rounded-[12px] bg-paper-deep p-3">
        <p className="text-label leading-caption font-bold text-ink">Utilities · {held} of 3</p>
        <p className="text-label leading-[18px] font-medium text-ink-soft">
          Utilities can't be built on. Owners get a fee each time someone else lands here.
        </p>
      </div>
    );
  }

  return (
    <Sheet label={`Buy ${space.name}`}>
      <div className={`flex items-center justify-between px-4 py-[14px] ${header}`}>
        <div className="flex flex-col gap-[2px]">
          <p className="text-[18px] leading-body font-black tracking-[-0.02em] text-white">{space.name}</p>
          <p className="text-caption leading-caption font-semibold text-[#FFFFFFE6]">{subtitle}</p>
        </div>
        <TurnTimer deadline={deadline} totalSeconds={phaseSeconds("awaiting_purchase")} track={track} />
      </div>
      <div className="flex flex-col gap-[14px] p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-[88px] shrink-0 items-center justify-center overflow-hidden rounded-[12px] bg-paper">
            <ArtTile src={lagosArt.property} className="h-[66px] w-[78px] rounded-button" />
          </div>
          <div className="flex flex-1 flex-col gap-[2px]">
            <p className="text-caption leading-caption font-semibold tracking-[0.06em] text-ink-soft">PRICE</p>
            <p className="text-[32px] leading-9 font-black tracking-tight text-ink">{formatNaira(space.price)}</p>
            <p className={`text-caption leading-caption font-semibold ${canAfford ? "text-ink-soft" : "text-alert"}`}>
              You have {formatNaira(cash)}
            </p>
          </div>
        </div>
        {progress}
      </div>
      <div className="flex flex-col gap-2 px-4 pb-4">
        <ErrorText>{errorMessage(error)}</ErrorText>
        <button
          type="button"
          onClick={onBuy}
          disabled={busy || !canAfford}
          className="flex h-12 items-center justify-center rounded-[12px] bg-lagoon text-body leading-[18px] font-black text-white disabled:opacity-50"
        >
          {canAfford ? "Buy alone" : "Not enough cash"}
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            disabled
            title="Buying together comes with deals"
            className="flex h-11 flex-1 items-center justify-center rounded-[12px] bg-paper-deep text-[14px] leading-[18px] font-bold text-ink disabled:opacity-50"
          >
            Buy together
          </button>
          <button
            type="button"
            onClick={onPass}
            disabled={busy}
            className="flex h-11 w-24 shrink-0 items-center justify-center rounded-[12px] border border-line bg-white text-[14px] leading-[18px] font-bold text-ink disabled:opacity-50"
          >
            Pass
          </button>
        </div>
      </div>
    </Sheet>
  );
}

const slotGroups: { slot: Slot; title: string; note: string }[] = [
  { slot: "commercial", title: "Business", note: "Pays you at GO" },
  { slot: "residential", title: "Home", note: "Charges rent when others land" },
  { slot: "hotel", title: "Hotel", note: "Pays at GO and charges a fee" },
];

function buildingDetail(id: BuildingId, corridor: CorridorId) {
  const s = buildingStats(id, corridor);
  const parts = [
    s.income > 0 && `+${formatNaira(s.income)} at GO`,
    s.rent > 0 && `${formatNaira(s.rent)} ${id === "hotel" ? "fee" : "rent"}`,
    `${formatNaira(s.maintenance)} upkeep`,
  ];
  return parts.filter(Boolean).join(" · ");
}

export function BuildSheet({
  state,
  myId,
  deadline,
  busy,
  error,
  onBuild,
  onClose,
}: {
  state: LagosPublicState;
  myId: string;
  deadline: string | null;
  busy: boolean;
  error: unknown;
  onBuild: (space: number, building: BuildingId) => void;
  onClose: () => void;
}) {
  const me = state.players.find((p) => p.id === myId);
  const mine = BOARD.flatMap((s, i) => (s.kind === "property" && state.owners[i] === myId ? [i] : []));
  const [picked, setPicked] = useState(() => (me && mine.includes(me.position) ? me.position : mine[0]));
  const space = picked !== undefined ? BOARD[picked] : undefined;
  if (!me || picked === undefined || space?.kind !== "property") return null;

  const look = corridorLook[space.corridor];
  const corridor = CORRIDORS[space.corridor];
  const held = corridorCount(state, myId, space.corridor);

  return (
    <Sheet label={`Build on ${space.name}`} onDismiss={onClose}>
      <div className={`flex items-center justify-between px-4 py-[14px] ${look.solid}`}>
        <div className="flex flex-col gap-[2px]">
          <p className="text-[18px] leading-body font-black tracking-[-0.02em] text-white">Build on {space.name}</p>
          <p className="text-caption leading-caption font-semibold text-[#FFFFFFE6]">
            {corridor.name} · {held} of 3 · Cash {formatNaira(me.cash)}
          </p>
        </div>
        <TurnTimer deadline={deadline} totalSeconds={phaseSeconds("awaiting_action")} track={timerTrack[space.corridor]} />
      </div>
      {mine.length > 1 && (
        <div className="flex gap-2 overflow-x-auto border-b border-divider px-4 py-3">
          {mine.map((i) => {
            const land = BOARD[i]!;
            const count = buildingsOn(state.buildings[i]!).length;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setPicked(i)}
                aria-pressed={i === picked}
                className={`flex h-8 shrink-0 items-center gap-[6px] rounded-pill border px-3 text-caption leading-caption font-bold text-ink ${i === picked ? "border-ink bg-paper" : "border-line bg-white"}`}
              >
                {land.kind === "property" && <span className={`size-2 rounded-pill ${corridorLook[land.corridor].solid}`} />}
                {land.name}
                {count > 0 && <span className="text-ink-soft">· {count}</span>}
              </button>
            );
          })}
        </div>
      )}
      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-4 py-3">
        {slotGroups.map((group) => (
          <section key={group.slot} className="flex flex-col gap-1">
            <p className="text-caption leading-caption font-bold tracking-[0.06em] text-ink-soft">
              {group.title.toUpperCase()} · <span className="font-medium tracking-normal normal-case">{group.note}</span>
            </p>
            {BUILDING_IDS.filter((id) => BUILDINGS[id].slot === group.slot).map((id) => {
              const check = checkBuild(state, myId, picked, id);
              if (!check.ok && check.reason === "lower") return null;
              const short = check.ok && me.cash < check.cost;
              let status: ReactNode;
              if (check.ok) {
                status = (
                  <button
                    type="button"
                    onClick={() => onBuild(picked, id)}
                    disabled={busy || short}
                    className={`flex h-9 min-w-[96px] shrink-0 items-center justify-center rounded-[10px] px-3 text-label leading-caption font-black disabled:opacity-60 ${short ? "bg-paper-deep text-alert" : "bg-lagoon text-white"}`}
                  >
                    {check.replaces ? "Upgrade " : ""}
                    {formatNaira(check.cost)}
                  </button>
                );
              } else {
                const text = {
                  built: "Built",
                  locked: `Needs ${check.needs} of 3`,
                  uneven: "Build evenly first",
                  not_yours: "",
                  lower: "",
                }[check.reason];
                status = (
                  <span className={`shrink-0 text-label leading-caption font-bold ${check.reason === "built" ? "text-lagoon" : "text-ink-soft"}`}>
                    {text}
                  </span>
                );
              }
              return (
                <div key={id} className="flex items-center gap-3 border-b border-divider py-2 last:border-0">
                  <div className="flex min-w-0 flex-1 flex-col gap-px">
                    <p className="text-[14px] leading-[18px] font-bold text-ink">{BUILDINGS[id].name}</p>
                    <p className="text-caption leading-caption font-medium text-ink-soft">{buildingDetail(id, space.corridor)}</p>
                  </div>
                  {status}
                </div>
              );
            })}
          </section>
        ))}
        <p className="text-caption leading-caption font-medium text-ink-soft">
          Build evenly: a property can't get 2 more buildings than your other land in the same area.
        </p>
      </div>
      <div className="flex flex-col gap-2 border-t border-divider px-4 pt-3 pb-4">
        <ErrorText>{errorMessage(error)}</ErrorText>
        <button
          type="button"
          onClick={onClose}
          className="flex h-11 items-center justify-center rounded-[12px] border border-line bg-white text-[14px] leading-[18px] font-bold text-ink"
        >
          Done
        </button>
      </div>
    </Sheet>
  );
}

export function PaydaySheet({
  income,
  costs,
  amount,
  onClose,
}: {
  income: number;
  costs: number;
  amount: number;
  onClose: () => void;
}) {
  const note =
    income === 0 && costs === 0
      ? "No shops, offices or hotels yet. Once you build, they pay you here."
      : costs > income
        ? "Upkeep was more than income this time. GO never takes money, so you get nothing."
        : "Your businesses pay you, minus upkeep on everything you've built.";
  return (
    <Sheet label="Payday" onDismiss={onClose}>
      <div className="flex flex-col gap-[2px] bg-lagoon px-4 pt-4 pb-[14px]">
        <p className="text-caption leading-caption font-bold tracking-wide text-teal-soft">GO</p>
        <p className="text-section leading-title font-black tracking-tight text-white">You passed the corner</p>
      </div>
      <div className="flex flex-col gap-3 px-4 pt-[14px] pb-4">
        <div className="flex items-center gap-3">
          <div className="flex size-[72px] shrink-0 items-center justify-center overflow-hidden rounded-[12px] bg-paper">
            <ArtTile src={lagosArt.payday} className="h-12 w-[60px]" />
          </div>
          <p className="text-[14px] leading-5 font-semibold text-ink-soft">{note}</p>
        </div>
        {(income > 0 || costs > 0) && (
          <>
            <div className="flex items-center justify-between border-b border-edge py-[10px]">
              <p className="text-body leading-5 font-medium text-ink-soft">Income</p>
              <p className="text-body leading-5 font-bold text-ink">{formatNaira(income)}</p>
            </div>
            <div className="flex items-center justify-between border-b border-edge py-[10px]">
              <p className="text-body leading-5 font-medium text-ink-soft">Upkeep</p>
              <p className="text-body leading-5 font-bold text-alert">−{formatNaira(costs)}</p>
            </div>
          </>
        )}
        <div className="flex items-center justify-between border-b border-edge py-[10px]">
          <p className="text-body leading-5 font-black text-ink">Payday</p>
          <p className="text-body leading-5 font-black text-ink">{formatNaira(amount)}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          autoFocus
          className="flex h-[52px] items-center justify-center rounded-button bg-danfo text-body leading-5 font-black tracking-[0.04em] text-ink"
        >
          {amount > 0 ? "COLLECT" : "OK"}
        </button>
      </div>
    </Sheet>
  );
}

export function ResultsSheet({
  state,
  profiles,
  myId,
  onClose,
}: {
  state: LagosPublicState;
  profiles: Map<string, PublicProfile>;
  myId: string;
  onClose: () => void;
}) {
  const winners = state.winnerIds ?? [];
  const name = (id: string) => (id === myId ? "You" : (profiles.get(id)?.displayName ?? "Player"));
  const title =
    winners.length === 0 ? "No winner" : winners.length === 1 ? `${name(winners[0]!)} won` : `Shared win: ${listNames(winners.map(name))}`;
  const ranked = [...state.players].sort(
    (a, b) =>
      Number(b.status === "playing") - Number(a.status === "playing") ||
      netWorth(state, b.id) - netWorth(state, a.id) ||
      b.cash - a.cash,
  );

  return (
    <Sheet label="Match over" onDismiss={onClose}>
      <div className="flex flex-col gap-[2px] bg-lagoon px-4 pt-4 pb-[14px]">
        <p className="text-caption leading-caption font-bold tracking-wide text-teal-soft">MATCH OVER</p>
        <p className="text-section leading-title font-black tracking-tight text-white">{title}</p>
      </div>
      <ol className="flex flex-col px-4 pt-2">
        {ranked.map((p, i) => {
          const person = profiles.get(p.id);
          return (
            <li key={p.id} className="flex items-center gap-3 border-b border-divider py-[10px] last:border-0">
              <span className="w-4 text-label leading-caption font-black text-ink-soft">{i + 1}</span>
              {person && <Avatar person={person} size={28} />}
              <span className="flex-1 truncate text-body leading-5 font-bold text-ink">
                {name(p.id)}
                {p.status !== "playing" && <span className="font-medium text-ink-soft"> · out</span>}
              </span>
              <span className="text-body leading-5 font-black text-ink">{formatNaira(netWorth(state, p.id))}</span>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-col gap-2 px-4 pt-2 pb-4">
        <Link
          to="/"
          className="flex h-[52px] items-center justify-center rounded-button bg-danfo text-body leading-5 font-black text-ink"
        >
          Back to home
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="flex h-11 items-center justify-center rounded-[12px] border border-line bg-white text-[14px] leading-[18px] font-bold text-ink"
        >
          See the board
        </button>
      </div>
    </Sheet>
  );
}

export function ChatSheet({
  messages,
  myId,
  sending,
  error,
  onSend,
  onClose,
}: {
  messages: MatchMessage[];
  myId: string;
  sending: boolean;
  error: unknown;
  onSend: (body: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    try {
      await onSend(body);
      setDraft("");
    } catch {
      // The error shows above the input; keep the draft so it can be resent.
    }
  }

  return (
    <Sheet label="Match chat" onDismiss={onClose}>
      <div className="flex items-center justify-between border-b border-divider px-4 py-3">
        <p className="text-title leading-body font-black tracking-tight text-ink">Table talk</p>
        <button type="button" onClick={onClose} className="text-[14px] leading-[18px] font-bold text-ink-soft">
          Close
        </button>
      </div>
      <div className="flex min-h-[200px] flex-col gap-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <p className="m-auto text-label leading-caption font-medium text-ink-soft">No messages yet. Say hi.</p>
        )}
        {messages.map((m) => {
          const mine = m.sender.id === myId;
          return (
            <div key={m.id} className={`flex flex-col gap-[2px] ${mine ? "items-end" : "items-start"}`}>
              {!mine && (
                <p className={`text-caption leading-caption font-bold ${personTextColor(m.sender.id)}`}>{m.sender.displayName}</p>
              )}
              <p
                className={`max-w-[80%] rounded-[14px] px-3 py-2 text-body leading-5 font-medium break-words ${mine ? "bg-lagoon text-white" : "bg-paper-deep text-ink"}`}
              >
                {m.body}
              </p>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <form onSubmit={submit} className="flex flex-col gap-2 border-t border-divider px-3 py-3">
        <ErrorText>{errorMessage(error)}</ErrorText>
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={280}
            placeholder="Say something…"
            aria-label="Message"
            autoFocus
            className="h-11 min-w-0 flex-1 rounded-[12px] border border-line bg-white px-[14px] text-[14px] leading-[18px] font-medium text-ink placeholder:text-muted"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="h-11 shrink-0 rounded-[12px] bg-lagoon px-4 text-[14px] leading-[18px] font-black text-white disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </Sheet>
  );
}
