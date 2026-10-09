import { type ApiErrorCode, apiErrorSchema } from "@bankroll/contracts";
import type { z } from "zod";
import { env } from "./env";
import { supabase } from "./supabase";

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
  }
}

interface RequestOptions<T extends z.ZodType> {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  schema: T;
  signal?: AbortSignal;
}

export async function api<T extends z.ZodType>(
  path: string,
  { method = "GET", body, schema, signal }: RequestOptions<T>,
): Promise<z.infer<T>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${env.VITE_API_URL}${path}`, {
    method,
    headers,
    ...(body !== undefined && { body: JSON.stringify(body) }),
    ...(signal && { signal }),
  });

  const json: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const parsed = apiErrorSchema.safeParse(json);
    throw parsed.success
      ? new ApiRequestError(res.status, parsed.data.error.code, parsed.data.error.message)
      : new ApiRequestError(res.status, "internal", "Something went wrong");
  }

  return schema.parse(json);
}
