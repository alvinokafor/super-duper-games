import { type MatchMessage, matchMessageSchema, matchMessagesResponseSchema } from "@bankroll/contracts";
import type { LagosCommand } from "@bankroll/lagos-rules";
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiRequestError, api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { receiveUpdate } from "./receive";
import { useGameSessionStore } from "./stores/game-session.store";
import { lagosUpdateSchema, lagosViewSchema } from "./types";

export const matchViewQuery = (matchId: string) =>
  queryOptions({
    queryKey: queryKeys.match(matchId),
    queryFn: ({ signal }) => api(`/v1/matches/${matchId}`, { schema: lagosViewSchema, signal }),
    // Live updates keep the store current; this only reloads on reconnect or a missed version.
    staleTime: Number.POSITIVE_INFINITY,
  });

export const matchMessagesQuery = (matchId: string) =>
  queryOptions({
    queryKey: queryKeys.matchMessages(matchId),
    queryFn: ({ signal }) => api(`/v1/matches/${matchId}/messages`, { schema: matchMessagesResponseSchema, signal }),
    staleTime: Number.POSITIVE_INFINITY,
  });

export function useMatchCommand(matchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    // The command id is made once per tap, so automatic retries reuse it and
    // the server never applies the same tap twice.
    mutationFn: ({ command, commandId }: { command: LagosCommand; commandId: string }) =>
      api(`/v1/matches/${matchId}/commands`, {
        method: "POST",
        body: { commandId, command },
        schema: lagosUpdateSchema,
      }),
    retry: (count, error) => count < 2 && !(error instanceof ApiRequestError),
    onMutate: ({ commandId }) => useGameSessionStore.getState().addPending(commandId),
    onSuccess: (update) => {
      if (!receiveUpdate(update)) void queryClient.invalidateQueries({ queryKey: queryKeys.match(matchId) });
    },
    onSettled: (_data, _error, { commandId }) => useGameSessionStore.getState().removePending(commandId),
  });
}

export function addMatchMessage(
  queryClient: ReturnType<typeof useQueryClient>,
  matchId: string,
  message: MatchMessage,
) {
  queryClient.setQueryData(queryKeys.matchMessages(matchId), (old: { messages: MatchMessage[] } | undefined) =>
    !old ? old : old.messages.some((m) => m.id === message.id) ? old : { messages: [...old.messages, message] },
  );
}

export function useSendMatchMessage(matchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      api(`/v1/matches/${matchId}/messages`, { method: "POST", body: { body }, schema: matchMessageSchema }),
    onSuccess: (message) => addMatchMessage(queryClient, matchId, message),
  });
}
