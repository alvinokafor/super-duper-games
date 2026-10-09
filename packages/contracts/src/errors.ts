import { z } from "zod";

export const apiErrorCodeSchema = z.enum([
  "unauthenticated",
  "forbidden",
  "not_found",
  "invalid_request",
  "conflict",
  "not_your_turn",
  "illegal_move",
  "version_conflict",
  "internal",
]);
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

export const apiErrorSchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
