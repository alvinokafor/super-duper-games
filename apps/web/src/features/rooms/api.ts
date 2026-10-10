import { gamesResponseSchema, roomSchema } from "@bankroll/contracts";
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export const gamesQuery = queryOptions({
  queryKey: queryKeys.games,
  queryFn: ({ signal }) => api("/v1/games", { schema: gamesResponseSchema, signal }),
  staleTime: 5 * 60_000,
});

export const roomQuery = (roomId: string) =>
  queryOptions({
    queryKey: queryKeys.room(roomId),
    queryFn: ({ signal }) => api(`/v1/rooms/${roomId}`, { schema: roomSchema, signal }),
  });

export function useCreateRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { gameId: string; groupId?: string }) =>
      api("/v1/rooms", { method: "POST", body: input, schema: roomSchema }),
    onSuccess: (room) => queryClient.setQueryData(queryKeys.room(room.id), room),
  });
}

function useSeatMutation(roomId: string, action: "join" | "leave") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api(`/v1/rooms/${roomId}/${action}`, { method: "POST", schema: roomSchema }),
    onSuccess: (room) => queryClient.setQueryData(queryKeys.room(roomId), room),
  });
}

export const useJoinRoom = (roomId: string) => useSeatMutation(roomId, "join");
export const useLeaveRoom = (roomId: string) => useSeatMutation(roomId, "leave");

export function useStartRoom(roomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api(`/v1/rooms/${roomId}/start`, { method: "POST", schema: roomSchema }),
    onSuccess: (room) => queryClient.setQueryData(queryKeys.room(roomId), room),
  });
}
