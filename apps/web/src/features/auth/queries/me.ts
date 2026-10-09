import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

const meSchema = z.object({ userId: z.string() });

export const meQuery = queryOptions({
  queryKey: queryKeys.me,
  queryFn: ({ signal }) => api("/v1/me", { schema: meSchema, signal }),
});
