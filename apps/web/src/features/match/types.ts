import { matchSnapshotSchema, matchUpdateSchema, matchViewSchema } from "@bankroll/contracts";
import { lagosEventSchema, lagosPublicStateSchema } from "@bankroll/lagos-rules";
import type { z } from "zod";

export const lagosSnapshotSchema = matchSnapshotSchema(lagosPublicStateSchema);
export type LagosSnapshot = z.infer<typeof lagosSnapshotSchema>;

export const lagosUpdateSchema = matchUpdateSchema(lagosPublicStateSchema, lagosEventSchema);
export type LagosUpdate = z.infer<typeof lagosUpdateSchema>;

export const lagosViewSchema = matchViewSchema(lagosPublicStateSchema);
export type LagosView = z.infer<typeof lagosViewSchema>;
