import {
  type GroupDetail,
  type GroupMessage,
  type GroupMessagesPage,
  groupDetailSchema,
  groupInvitePreviewSchema,
  groupJoinResponseSchema,
  groupMessageSchema,
  groupMessagesPageSchema,
  groupsResponseSchema,
  type PublicProfile,
} from "@bankroll/contracts";
import {
  type InfiniteData,
  infiniteQueryOptions,
  type QueryClient,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { z } from "zod";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export const groupsQuery = queryOptions({
  queryKey: queryKeys.groups,
  queryFn: ({ signal }) => api("/v1/groups", { schema: groupsResponseSchema, signal }),
});

export const groupQuery = (groupId: string) =>
  queryOptions({
    queryKey: queryKeys.group(groupId),
    queryFn: ({ signal }) => api(`/v1/groups/${groupId}`, { schema: groupDetailSchema, signal }),
  });

export const groupMessagesQuery = (groupId: string) =>
  infiniteQueryOptions({
    queryKey: queryKeys.groupMessages(groupId),
    queryFn: ({ pageParam, signal }) =>
      api(`/v1/groups/${groupId}/messages${pageParam ? `?before=${pageParam}` : ""}`, {
        schema: groupMessagesPageSchema,
        signal,
      }),
    initialPageParam: null as number | null,
    getNextPageParam: (last) => last.nextBefore,
  });

export const groupInviteQuery = (code: string) =>
  queryOptions({
    queryKey: queryKeys.groupInvite(code),
    queryFn: ({ signal }) => api(`/v1/group-invites/${code}`, { schema: groupInvitePreviewSchema, signal }),
  });

// Adds a message to the newest page, replacing an unsent copy with the same
// clientId or a copy that already arrived over the live channel.
export function putMessageInCache(queryClient: QueryClient, message: GroupMessage) {
  queryClient.setQueryData<InfiniteData<GroupMessagesPage>>(queryKeys.groupMessages(message.groupId), (data) => {
    if (!data) return data;
    const isSame = (m: GroupMessage) => m.id === message.id || (message.clientId !== null && m.clientId === message.clientId);
    const pages = data.pages.map((page) => ({ ...page, messages: page.messages.filter((m) => !isSame(m)) }));
    const [first, ...rest] = pages;
    if (!first) return data;
    return { ...data, pages: [{ ...first, messages: [message, ...first.messages] }, ...rest] };
  });
}

function dropMessageFromCache(queryClient: QueryClient, groupId: string, clientId: string) {
  queryClient.setQueryData<InfiniteData<GroupMessagesPage>>(queryKeys.groupMessages(groupId), (data) =>
    data
      ? { ...data, pages: data.pages.map((p) => ({ ...p, messages: p.messages.filter((m) => m.clientId !== clientId) })) }
      : data,
  );
}

// Unsent messages carry a negative id until the server confirms them.
export const isPendingMessage = (message: GroupMessage) => message.id < 0;

export function useSendGroupMessage(groupId: string, me: PublicProfile | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { body: string; clientId: string }) =>
      api(`/v1/groups/${groupId}/messages`, { method: "POST", body: input, schema: groupMessageSchema }),
    onMutate: ({ body, clientId }) => {
      putMessageInCache(queryClient, {
        id: -Date.now(),
        groupId,
        kind: "text",
        body,
        sender: me ?? null,
        roomId: null,
        clientId,
        createdAt: new Date().toISOString(),
      });
    },
    onSuccess: (message) => putMessageInCache(queryClient, message),
    onError: (_err, { clientId }) => dropMessageFromCache(queryClient, groupId, clientId),
  });
}

function useGroupMutation<T>(mutationFn: (input: T) => Promise<GroupDetail>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (group) => {
      queryClient.setQueryData(queryKeys.group(group.id), group);
      void queryClient.invalidateQueries({ queryKey: queryKeys.groups, exact: true });
    },
  });
}

export const useCreateGroup = () =>
  useGroupMutation((input: { name: string; memberIds: string[] }) =>
    api("/v1/groups", { method: "POST", body: input, schema: groupDetailSchema }),
  );

export const useRenameGroup = (groupId: string) =>
  useGroupMutation((name: string) =>
    api(`/v1/groups/${groupId}`, { method: "PATCH", body: { name }, schema: groupDetailSchema }),
  );

export const useAddGroupMembers = (groupId: string) =>
  useGroupMutation((userIds: string[]) =>
    api(`/v1/groups/${groupId}/members`, { method: "POST", body: { userIds }, schema: groupDetailSchema }),
  );

export const useResetGroupInvite = (groupId: string) =>
  useGroupMutation(() => api(`/v1/groups/${groupId}/invite-code`, { method: "POST", schema: groupDetailSchema }));

// Leaving (your own id) or removing someone as the owner.
export function useRemoveGroupMember(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      api(`/v1/groups/${groupId}/members/${userId}`, {
        method: "DELETE",
        schema: z.object({ deleted: z.boolean() }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.group(groupId), exact: true });
      void queryClient.invalidateQueries({ queryKey: queryKeys.groups, exact: true });
    },
  });
}

export function useJoinGroupInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) =>
      api(`/v1/group-invites/${code}/join`, { method: "POST", schema: groupJoinResponseSchema }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.groups, exact: true }),
  });
}
