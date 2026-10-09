import { create } from "zustand";

// Dialogs hold ids only. They read game data from the session store.
export type GameDialog =
  | { kind: "buy_property"; tileId: string }
  | { kind: "build"; tileId: string }
  | { kind: "trade"; offerId: string | null }
  | { kind: "loan"; offerId: string | null }
  | { kind: "efcc_warning" }
  | { kind: "settlement" };

interface GameDialogStore {
  dialog: GameDialog | null;
  open: (dialog: GameDialog) => void;
  close: () => void;
}

export const useGameDialogStore = create<GameDialogStore>()((set) => ({
  dialog: null,
  open: (dialog) => set({ dialog }),
  close: () => set({ dialog: null }),
}));
