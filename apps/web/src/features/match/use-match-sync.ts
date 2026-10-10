import { MATCH_EVENT, MATCH_MESSAGE_EVENT, matchChannelName, matchMessageSchema } from "@bankroll/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { queryKeys } from "@/lib/query-keys";
import { useChannel } from "@/lib/realtime";
import { addMatchMessage, matchViewQuery } from "./api";
import { receiveSnapshot, receiveUpdate } from "./receive";
import { lagosUpdateSchema } from "./types";

/**
 * Loads the match, then keeps the session store in step with the live
 * channel. A missed version or a reconnect reloads the full state.
 */
export function useMatchSync(matchId: string, onMessage?: (senderId: string, body: string) => void) {
  const queryClient = useQueryClient();
  const view = useQuery(matchViewQuery(matchId));

  useEffect(() => {
    if (view.data) receiveSnapshot(view.data.snapshot);
  }, [view.data]);

  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.match(matchId), exact: true });
    void queryClient.invalidateQueries({ queryKey: queryKeys.matchMessages(matchId) });
  };

  useChannel(
    matchChannelName(matchId),
    {
      [MATCH_EVENT]: (payload) => {
        const update = lagosUpdateSchema.safeParse(payload);
        if (!update.success || !receiveUpdate(update.data)) reload();
      },
      [MATCH_MESSAGE_EVENT]: (payload) => {
        const message = matchMessageSchema.safeParse(payload);
        if (!message.success) return;
        addMatchMessage(queryClient, matchId, message.data);
        onMessage?.(message.data.sender.id, message.data.body);
      },
    },
    reload,
  );

  return view;
}
