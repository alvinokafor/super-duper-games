import { QueryClient } from "@tanstack/react-query";
import { ApiRequestError } from "./api-client";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        if (error instanceof ApiRequestError && error.status < 500) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      // Game commands handle their own retries with the same command id.
      retry: false,
    },
  },
});
