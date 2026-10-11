import { BOARD_SIZE } from "@bankroll/lagos-rules";
import { Application, Graphics } from "pixi.js";
import { useEffect, useRef, useState } from "react";
import { STEP_MS } from "../token-walk";
import { seatColor, seatToken, themeColor, tokenShadow } from "../tokens";
import { PIECE_RADIUS, pieceSpot } from "./board-layout";

export interface TokenSpot {
  id: string;
  seat: number;
  isMe: boolean;
  position: number;
}

interface Point {
  x: number;
  y: number;
}

interface Piece {
  view: Graphics;
  position: number;
  ground: Point;
  from: Point;
  to: Point;
  started: number;
  duration: number;
  hop: boolean;
}

const SHUFFLE_MS = 150;

/** This piece's place among the pieces on the same tile. */
function spotOf(token: TokenSpot, all: readonly TokenSpot[]): Point {
  const here = all.filter((t) => t.position === token.position).sort((a, b) => a.seat - b.seat);
  return pieceSpot(token.position, here.findIndex((t) => t.id === token.id), here.length);
}

/**
 * Draws the player pieces over the board with PixiJS. A piece that moves one
 * tile hops onto it; React drives the walk one tile at a time, so a roll of
 * 4 is four hops. Bigger jumps, like after a reload, snap into place. If
 * the browser can't start PixiJS, plain dots are shown instead.
 */
export function TokenLayer({ tokens }: { tokens: readonly TokenSpot[] }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const tokensRef = useRef(tokens);
  const syncRef = useRef<((tokens: readonly TokenSpot[]) => void) | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    tokensRef.current = tokens;
    syncRef.current?.(tokens);
  }, [tokens]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const app = new Application();
    const pieces = new Map<string, Piece>();
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let size = 0;
    let ready = false;
    let destroyed = false;

    const radius = () => size * PIECE_RADIUS;
    const spotFor = (token: TokenSpot, all: readonly TokenSpot[]): Point => {
      const spot = spotOf(token, all);
      return { x: spot.x * size, y: spot.y * size };
    };

    const draw = (g: Graphics, token: TokenSpot) => {
      const r = radius();
      g.clear();
      g.circle(0, r * 0.25, r).fill({ color: 0x000000, alpha: 0.25 });
      g.circle(0, 0, r)
        .fill(seatColor(token.seat))
        .stroke({ width: token.isMe ? r * 0.32 : r * 0.22, color: token.isMe ? themeColor("danfo") : 0xffffff });
      g.circle(-r * 0.3, -r * 0.35, r * 0.32).fill({ color: 0xffffff, alpha: 0.35 });
    };

    const sync = (all: readonly TokenSpot[], snap = false) => {
      if (!ready || size === 0) return;
      const now = performance.now();
      const seen = new Set<string>();
      for (const token of all) {
        seen.add(token.id);
        const target = spotFor(token, all);
        let piece = pieces.get(token.id);
        if (!piece) {
          const view = new Graphics();
          app.stage.addChild(view);
          piece = { view, position: token.position, ground: target, from: target, to: target, started: now, duration: 0, hop: false };
          pieces.set(token.id, piece);
          draw(view, token);
          view.position.set(target.x, target.y);
          continue;
        }
        if (snap) draw(piece.view, token);
        else if (piece.position === token.position && piece.to.x === target.x && piece.to.y === target.y) continue;
        const steps = (token.position - piece.position + BOARD_SIZE) % BOARD_SIZE;
        const jump = snap || still || steps > 1;
        piece.from = jump ? target : piece.ground;
        piece.to = target;
        piece.started = now;
        piece.hop = steps === 1 && !jump;
        piece.duration = jump ? 0 : piece.hop ? STEP_MS * 0.9 : SHUFFLE_MS;
        piece.position = token.position;
        if (piece.hop) app.stage.addChild(piece.view);
      }
      for (const [id, piece] of pieces) {
        if (seen.has(id)) continue;
        piece.view.destroy();
        pieces.delete(id);
      }
    };

    const tick = () => {
      const now = performance.now();
      for (const piece of pieces.values()) {
        const t = piece.duration === 0 ? 1 : Math.min(1, (now - piece.started) / piece.duration);
        const eased = 1 - (1 - t) ** 3;
        piece.ground = {
          x: piece.from.x + (piece.to.x - piece.from.x) * eased,
          y: piece.from.y + (piece.to.y - piece.from.y) * eased,
        };
        const lift = piece.hop ? Math.sin(Math.PI * t) * radius() * 1.8 : 0;
        piece.view.position.set(piece.ground.x, piece.ground.y - lift);
      }
    };

    const resize = () => {
      size = host.clientWidth;
      app.renderer.resize(host.clientWidth, host.clientHeight);
      sync(tokensRef.current, true);
    };
    const observer = new ResizeObserver(() => ready && resize());

    void (async () => {
      try {
        await app.init({
          backgroundAlpha: 0,
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
          width: host.clientWidth,
          height: host.clientHeight,
        });
      } catch {
        if (!destroyed) setFailed(true);
        return;
      }
      if (destroyed) {
        app.destroy(true, { children: true });
        return;
      }
      app.canvas.style.position = "absolute";
      app.canvas.style.inset = "0";
      host.appendChild(app.canvas);
      ready = true;
      app.ticker.add(tick);
      syncRef.current = (all) => sync(all);
      observer.observe(host);
      resize();
    })();

    return () => {
      destroyed = true;
      syncRef.current = null;
      observer.disconnect();
      if (ready) app.destroy(true, { children: true });
    };
  }, []);

  return (
    <div ref={hostRef} className="pointer-events-none absolute inset-0" aria-hidden>
      {failed &&
        tokens.map((token) => {
          const { x, y } = spotOf(token, tokens);
          return (
            <span
              key={token.id}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-pill ${tokenShadow} ${seatToken(token.seat)} ${token.isMe ? "border-[1.5px] border-danfo" : "border border-white"}`}
              style={{ left: `${x * 100}%`, top: `${y * 100}%`, width: `${PIECE_RADIUS * 200}%`, aspectRatio: "1" }}
            />
          );
        })}
    </div>
  );
}
