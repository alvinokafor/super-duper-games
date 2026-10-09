import type { ApiErrorCode } from "@bankroll/contracts";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";

export class ApiHttpError extends HTTPException {
  constructor(
    status: ContentfulStatusCode,
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(status, { message });
  }
}

export const badRequest = (message: string) => new ApiHttpError(400, "invalid_request", message);
export const forbidden = (message: string) => new ApiHttpError(403, "forbidden", message);
export const notFound = (message = "Not found") => new ApiHttpError(404, "not_found", message);
export const conflict = (message: string) => new ApiHttpError(409, "conflict", message);

export async function readJson<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T>> {
  const body: unknown = await c.req.json().catch(() => undefined);
  return parseOrThrow(schema, body);
}

export function parseOrThrow<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid request");
  return parsed.data;
}

const uuidSchema = z.uuid();

// Malformed ids are treated as missing rather than as a database error.
export function uuidParam(value: string | undefined): string {
  const parsed = uuidSchema.safeParse(value);
  if (!parsed.success) throw notFound();
  return parsed.data;
}

export const toIso = (value: string) => new Date(value).toISOString();

export function isUniqueViolation(err: unknown): boolean {
  for (let e: unknown = err; e && typeof e === "object"; e = (e as { cause?: unknown }).cause) {
    if ((e as { code?: unknown }).code === "23505") return true;
  }
  return false;
}
