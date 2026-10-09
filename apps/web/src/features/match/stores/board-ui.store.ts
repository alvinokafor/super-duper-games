import { create } from "zustand";

const DEFAULT_ZOOM = 1;
const MIN_ZOOM = 0.75;
const MAX_ZOOM = 2.5;

interface BoardUIStore {
  selectedTileId: string | null;
  cameraZoom: number;
  cameraPosition: { x: number; y: number };

  selectTile: (tileId: string | null) => void;
  setCameraZoom: (zoom: number) => void;
  setCameraPosition: (position: { x: number; y: number }) => void;
  resetCamera: () => void;
  reset: () => void;
}

const initialState = {
  selectedTileId: null,
  cameraZoom: DEFAULT_ZOOM,
  cameraPosition: { x: 0, y: 0 },
};

export const useBoardUIStore = create<BoardUIStore>()((set) => ({
  ...initialState,
  selectTile: (selectedTileId) => set({ selectedTileId }),
  setCameraZoom: (zoom) => set({ cameraZoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)) }),
  setCameraPosition: (cameraPosition) => set({ cameraPosition }),
  resetCamera: () => set({ cameraZoom: DEFAULT_ZOOM, cameraPosition: { x: 0, y: 0 } }),
  reset: () => set(initialState),
}));
