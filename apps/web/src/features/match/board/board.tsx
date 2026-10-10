import { BOARD, CORRIDORS, type LagosPublicState, type Space } from "@bankroll/lagos-rules";
import type { ReactNode } from "react";
import { lagosArt } from "@/features/games/art";
import { seatToken, tokenShadow } from "../tokens";
import { corridorLook, placement, type Side, tileLabel } from "./board-layout";

interface TileToken {
  seat: number;
  isMe: boolean;
}

/**
 * The 28-space board from the Paper design. Bank-owned land is a solid
 * corridor colour; owned land turns white with a colour strip and the
 * owner's dot. Tokens sit above the label.
 */
export function Board({
  state,
  myId,
  names,
  children,
}: {
  state: LagosPublicState;
  myId: string;
  names: Map<string, string>;
  children?: ReactNode;
}) {
  const seats = new Map(state.players.map((p) => [p.id, p.seat]));
  const current = state.players.find((p) => p.id === state.currentPlayerId);

  return (
    <div
      className="grid aspect-square w-full bg-paper"
      style={{ gridTemplateColumns: "48fr repeat(6, 49fr) 48fr", gridTemplateRows: "48fr repeat(6, 49fr) 48fr" }}
    >
      {BOARD.map((space, index) => {
        const ownerId = state.owners[index] ?? null;
        const tokens = state.players
          .filter((p) => p.position === index && p.status === "playing")
          .map((p) => ({ seat: p.seat, isMe: p.id === myId }));
        const ownerName = ownerId ? names.get(ownerId) : undefined;
        return (
          <Tile
            key={space.name}
            index={index}
            space={space}
            ownerSeat={ownerId ? (seats.get(ownerId) ?? null) : null}
            tokens={tokens}
            highlight={state.phase !== "finished" && current?.position === index}
            label={ownerName ? `${space.name}, owned by ${ownerName}` : space.name}
          />
        );
      })}
      <div className="relative flex items-center justify-center" style={{ gridRow: "2 / 8", gridColumn: "2 / 8" }}>
        <div
          className="aspect-square w-[85%] bg-cover bg-center"
          style={{ backgroundImage: `url(${lagosArt.boardCentre})` }}
          aria-hidden
        />
        {children}
      </div>
    </div>
  );
}

const edgeStripClass: Record<Exclude<Side, "corner">, string> = {
  bottom: "order-last h-[6px] w-full",
  top: "order-first h-[6px] w-full",
  left: "order-first h-full w-[6px]",
  right: "order-last h-full w-[6px]",
};

const utilityStripe = {
  across: "repeating-linear-gradient(90deg, #5C6B64 0 4px, #DCE2DA 4px 6px)",
  down: "repeating-linear-gradient(#5C6B64 0 4px, #DCE2DA 4px 6px)",
};

function Tile({
  index,
  space,
  ownerSeat,
  tokens,
  highlight,
  label,
}: {
  index: number;
  space: Space;
  ownerSeat: number | null;
  tokens: TileToken[];
  highlight: boolean;
  label: string;
}) {
  const { row, col, side } = placement(index);
  const ring = highlight && <span className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_2px_#F5BF45]" />;
  const style = { gridRow: row, gridColumn: col };
  const vertical = side === "left" || side === "right";

  if (space.kind === "property" || space.kind === "utility") {
    const look = space.kind === "property" ? corridorLook[space.corridor] : null;
    const owned = ownerSeat !== null;
    const solid = look && !owned;
    const { label: short, size } = tileLabel(space);
    const strip = side !== "corner" && (owned || !look) && (
      <div
        className={`shrink-0 ${edgeStripClass[side]} ${look?.solid ?? ""}`}
        style={look ? undefined : { background: vertical ? utilityStripe.down : utilityStripe.across }}
      />
    );
    return (
      <div
        role="img"
        aria-label={label}
        className={`relative flex min-h-0 min-w-0 overflow-hidden ${vertical ? "flex-row" : "flex-col"} ${solid ? look.solid : "bg-white shadow-[inset_0_0_0_0.5px_#D0D8D2]"}`}
        style={style}
      >
        {strip}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-[2px]">
          {space.kind === "utility" && tokens.length === 0 && <UtilityIcon name={space.name} />}
          <Dots ownerSeat={look ? ownerSeat : null} tokens={tokens} />
          <span className={`flex items-center gap-[2px] font-black ${size} ${solid ? "text-white" : "text-ink"}`}>
            {!look && owned && <span className={`size-[6px] shrink-0 rounded-pill ${seatToken(ownerSeat)}`} />}
            {short}
          </span>
        </div>
        {ring}
      </div>
    );
  }

  const special: Record<Exclude<Space["kind"], "property" | "utility">, { box: string; body: ReactNode }> = {
    go: {
      box: "bg-lagoon shadow-[inset_0_0_0_1px_#202A2529]",
      body: <span className="text-[16px] leading-5 font-black tracking-tight text-white">GO</span>,
    },
    park: {
      box: "bg-[#E5F3EC] shadow-[inset_0_0_0_1px_#D0D8D2]",
      body: <span className="text-[9px] leading-3 font-black text-lagoon">Park</span>,
    },
    efcc: {
      box: "bg-night shadow-[inset_0_0_0_1px_#202A2529]",
      body: <span className="text-[9px] leading-3 font-black tracking-[0.04em] text-danfo">EFCC</span>,
    },
    tax: {
      box: "bg-paper-deep shadow-[inset_0_0_0_1px_#D0D8D2]",
      body: (
        <>
          <span className="text-[11px] leading-[14px] font-black text-ink">{space.name.split(" ")[0]}</span>
          <span className="text-[8px] leading-[10px] font-bold text-ink-soft">TAX</span>
        </>
      ),
    },
    chance: {
      box: "bg-info shadow-[inset_0_0_0_1px_#202A2529]",
      body: <span className="text-[16px] leading-5 font-black text-white">?</span>,
    },
    community_chest: {
      box: "bg-white shadow-[inset_0_0_0_1px_#D0D8D2]",
      body: (
        <>
          <span className="h-[10px] w-[14px] shrink-0 rounded-[2px] bg-brass" />
          <span className="text-[8px] leading-[10px] font-black text-ink-soft">CHEST</span>
        </>
      ),
    },
  };
  const { box, body } = special[space.kind];
  return (
    <div
      role="img"
      aria-label={label}
      className={`relative flex min-h-0 min-w-0 flex-col items-center justify-center gap-[2px] overflow-hidden ${box}`}
      style={style}
    >
      <Dots ownerSeat={null} tokens={tokens} />
      {body}
      {ring}
    </div>
  );
}

function Dots({ ownerSeat, tokens }: { ownerSeat: number | null; tokens: TileToken[] }) {
  if (ownerSeat === null && tokens.length === 0) return null;
  const overlap = tokens.length > 3 ? "-ml-[6px]" : "-ml-[3px]";
  return (
    <div className="flex items-center gap-[3px]">
      {ownerSeat !== null && (
        <span className={`size-[10px] shrink-0 rounded-pill ${tokenShadow} ${seatToken(ownerSeat)}`} />
      )}
      {tokens.length > 0 && (
        <span className="flex items-center">
          {tokens.map((t, i) => (
            <span
              key={t.seat}
              className={`size-3 shrink-0 rounded-pill ${tokenShadow} ${seatToken(t.seat)} ${t.isMe ? "border-[1.5px] border-danfo" : "border border-white"} ${i > 0 ? overlap : ""}`}
            />
          ))}
        </span>
      )}
    </div>
  );
}

function UtilityIcon({ name }: { name: string }) {
  if (name === "Airport") {
    return (
      <svg width="20" height="18" viewBox="0 0 20 18" aria-hidden>
        <rect x="0.5" y="14.5" width="19" height="3" rx="0.8" fill="#202A25" />
        <path d="M3 16h2.4M8.8 16h2.4M14.6 16h2.4" fill="none" stroke="#FFFFFF" strokeWidth="0.9" />
        <path
          d="M10 0.5C10.8 0.5 11.3 1.2 11.3 2.2V5L18.5 8.6V10L11.3 8.4V10.6L13.4 12V13L10 12.3L6.6 13V12L8.7 10.6V8.4L1.5 10V8.6L8.7 5V2.2C8.7 1.2 9.2 0.5 10 0.5Z"
          fill="#4289D4"
        />
      </svg>
    );
  }
  if (name === "Railway") {
    return (
      <svg width="20" height="18" viewBox="0 0 20 18" aria-hidden>
        <rect x="4.5" y="0.8" width="11" height="12.4" rx="3" fill="#202A25" />
        <rect x="6.3" y="2.6" width="7.4" height="4.4" rx="1" fill="#9CC3EC" />
        <circle cx="7.4" cy="10.2" r="1.1" fill="#F5BF45" />
        <circle cx="12.6" cy="10.2" r="1.1" fill="#F5BF45" />
        <path d="M6.5 13.4L4 17.5M13.5 13.4L16 17.5" fill="none" stroke="#202A25" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M5 15.8h10" fill="none" stroke="#202A25" />
      </svg>
    );
  }
  return (
    <svg width="20" height="18" viewBox="0 0 20 18" aria-hidden>
      <path d="M14.3 0.4c1.5 1.1 1.7 2.3 0 3.1-1.7-.8-1.5-2 0-3.1z" fill="#EF9654" />
      <path d="M14.3 1.7c.6.5.6 1 0 1.4-.6-.4-.6-.9 0-1.4z" fill="#F5BF45" />
      <rect x="13" y="3.6" width="2.6" height="13.9" fill="#202A25" />
      <rect x="16.4" y="7" width="2.4" height="10.5" fill="#202A25" />
      <rect x="0.8" y="10" width="5.4" height="7.5" rx="1.2" fill="#5C6B64" />
      <rect x="6.8" y="8" width="5.4" height="9.5" rx="1.2" fill="#5C6B64" />
      <path d="M0.8 12.5h5.4M6.8 10.8h5.4" fill="none" stroke="#DCE2DA" strokeWidth="0.9" />
      <path d="M12.2 13.2h0.8" fill="none" stroke="#F5BF45" strokeWidth="1.4" />
      <path d="M13.6 7h1.4M13.6 10.5h1.4" fill="none" stroke="#FFFFFF" strokeWidth="0.8" />
    </svg>
  );
}

export function corridorName(space: Space): string {
  return space.kind === "property" ? CORRIDORS[space.corridor].name : "Utility";
}
