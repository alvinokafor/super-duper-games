import { friendsResponseSchema, relationshipResponseSchema, userSearchResponseSchema } from "@bankroll/contracts";
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export const friendsQuery = queryOptions({
  queryKey: queryKeys.friends,
  queryFn: ({ signal }) => api("/v1/friends", { schema: friendsResponseSchema, signal }),
});

export const userSearchQuery = (q: string) =>
  queryOptions({
    queryKey: queryKeys.userSearch(q),
    queryFn: ({ signal }) =>
      api(`/v1/users/search?q=${encodeURIComponent(q)}`, { schema: userSearchResponseSchema, signal }),
    enabled: q.length >= 2,
    staleTime: 10_000,
  });

// Every friend action changes both the friends list and search results,
// which share the "friends" key prefix.
function useFriendMutation<T>(mutationFn: (input: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.friends }),
  });
}

export const useSendFriendRequest = () =>
  useFriendMutation((username: string) =>
    api("/v1/friends/requests", { method: "POST", body: { username }, schema: relationshipResponseSchema }),
  );

export const useAcceptFriend = () =>
  useFriendMutation((userId: string) =>
    api(`/v1/friends/${userId}/accept`, { method: "POST", schema: relationshipResponseSchema }),
  );

// Declines, cancels, or unfriends.
export const useRemoveFriend = () =>
  useFriendMutation((userId: string) =>
    api(`/v1/friends/${userId}`, { method: "DELETE", schema: relationshipResponseSchema }),
  );
