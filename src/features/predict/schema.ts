import { z } from "zod";

export const predictQuerySchema = z
  .object({
    lineId: z.string().trim().min(1).max(40),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    weekday: z.coerce.number().int().min(0).max(6).optional(),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    direction: z.enum(["1", "2"]).optional(),
  })
  .refine((v) => v.date !== undefined || v.weekday !== undefined, { message: "Provide a date or a weekday.", path: ["date"] });

export type PredictQuery = z.infer<typeof predictQuerySchema>;
