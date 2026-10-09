import { publicProfileSchema, updateMeSchema, usernameAvailabilitySchema } from "@bankroll/contracts";
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export const meQuery = queryOptions({
  queryKey: queryKeys.me,
  queryFn: ({ signal }) => api("/v1/me", { schema: publicProfileSchema, signal }),
});

export const usernameAvailableQuery = (username: string) =>
  queryOptions({
    queryKey: queryKeys.usernameAvailable(username),
    queryFn: ({ signal }) =>
      api(`/v1/public/usernames/${encodeURIComponent(username)}`, { schema: usernameAvailabilitySchema, signal }),
    staleTime: 10_000,
  });

export function useUpdateMe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: z.input<typeof updateMeSchema>) =>
      api("/v1/me", { method: "PATCH", body: input, schema: publicProfileSchema }),
    onSuccess: (me) => queryClient.setQueryData(queryKeys.me, me),
  });
}
