// Player token colours, by seat. In a match the seat is the turn order.
export const seatTokens = ["bg-lagoon", "bg-navy", "bg-rose", "bg-alert", "bg-violet", "bg-teal"] as const;
export const seatRings = ["ring-lagoon", "ring-navy", "ring-rose", "ring-alert", "ring-violet", "ring-teal"] as const;

export const tokenShadow = "shadow-[inset_0_2px_1px_#FFFFFF8C,inset_0_-2px_2px_#00000047,0_1px_1px_#00000047]";

export const seatToken = (seat: number) => seatTokens[seat % seatTokens.length]!;
export const seatRing = (seat: number) => seatRings[seat % seatRings.length]!;
