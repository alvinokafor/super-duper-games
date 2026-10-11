import type { LagosEvent, LagosPlayer } from "@bankroll/lagos-rules";
import { useEffect, useRef, useState } from "react";
import type { QueuedAnimation } from "./stores/game-animation.store";

/** How long a "+₦" or "−₦" tag stays on a balance. */
export const FLASH_MS = 1600;

/** How each event moves money, by player. */
export function cashChanges(event: LagosEvent): [playerId: string, delta: number][] {
  switch (event.type) {
    case "payday":
      return event.amount > 0 ? [[event.playerId, event.amount]] : [];
    case "rent_paid":
      return event.amount > 0
        ? [
            [event.playerId, -event.amount],
            [event.ownerId, event.amount],
          ]
        : [];
    case "property_bought":
      return [[event.playerId, -event.price]];
    case "building_built":
      return [[event.playerId, -event.cost]];
    default:
      return [];
  }
}

/**
 * Cash as it should look right now: the server's figure, minus money from
 * events still waiting behind the one on screen. So a rent payment shows
 * when the piece lands, not when the die is thrown.
 */
export function shownCash(players: readonly LagosPlayer[], queue: readonly QueuedAnimation[]): Map<string, number> {
  const cash = new Map(players.map((p) => [p.id, p.cash]));
  for (const { event } of queue.slice(1)) {
    for (const [id, delta] of cashChanges(event)) {
      const now = cash.get(id);
      if (now !== undefined) cash.set(id, now - delta);
    }
  }
  return cash;
}

/** A tag on one player's balance. `key` is the event that caused it. */
export interface CashFlash {
  key: string;
  delta: number;
}

/** Tags after an event plays: each player it paid or charged gets a new one. */
export function addFlashes(flashes: ReadonlyMap<string, CashFlash>, played: QueuedAnimation): Map<string, CashFlash> {
  const next = new Map(flashes);
  for (const [id, delta] of cashChanges(played.event)) next.set(id, { key: played.key, delta });
  return next;
}

/** Drops the tags an event made, unless a later event has already replaced them. */
export function expireFlashes(flashes: ReadonlyMap<string, CashFlash>, key: string): Map<string, CashFlash> {
  return new Map([...flashes].filter(([, flash]) => flash.key !== key));
}

/**
 * Tags for money moved by the event now on screen. They come from events,
 * not from balance changes, so reloading the match never shows one.
 */
export function useCashFlashes(front: QueuedAnimation | undefined): ReadonlyMap<string, CashFlash> {
  const [flashes, setFlashes] = useState<ReadonlyMap<string, CashFlash>>(new Map());
  const seen = useRef<string | null>(null);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    if (!front || seen.current === front.key || cashChanges(front.event).length === 0) return;
    seen.current = front.key;
    setFlashes((f) => addFlashes(f, front));
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setFlashes((f) => expireFlashes(f, front.key));
    }, FLASH_MS);
    timers.current.add(timer);
  }, [front]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending) clearTimeout(timer);
    };
  }, []);

  return flashes;
}
