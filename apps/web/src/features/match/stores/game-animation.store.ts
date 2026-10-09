import type { LagosEvent } from "@bankroll/lagos-rules";
import { create } from "zustand";

export interface QueuedAnimation {
  /** Match version the event came from, plus its index inside that update. */
  key: string;
  event: LagosEvent;
}

// Animations only replay what the server already decided. They never change money or ownership.
interface GameAnimationStore {
  queue: readonly QueuedAnimation[];
  enqueue: (version: number, events: readonly LagosEvent[]) => void;
  /** Called by the board when it finishes the animation at the front of the queue. */
  complete: (key: string) => void;
  /** Skip everything queued, e.g. after loading a fresh snapshot. */
  clear: () => void;
}

export const useGameAnimationStore = create<GameAnimationStore>()((set) => ({
  queue: [],
  enqueue: (version, events) =>
    set((s) => ({
      queue: [...s.queue, ...events.map((event, i) => ({ key: `${version}:${i}`, event }))],
    })),
  complete: (key) => set((s) => ({ queue: s.queue.filter((a) => a.key !== key) })),
  clear: () => set({ queue: [] }),
}));
