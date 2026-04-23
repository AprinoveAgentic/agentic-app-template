import { z } from "zod";

export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  db: z.union([z.literal("ok"), z.literal("error")]),
  environment: z.string(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
