import { useBoardUIStore } from "./board-ui.store";
import { useGameAnimationStore } from "./game-animation.store";
import { useGameSessionStore } from "./game-session.store";

export function resetMatchStores() {
  useGameSessionStore.getState().reset();
  useBoardUIStore.getState().reset();
  useGameAnimationStore.getState().clear();
}
