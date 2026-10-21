import { z } from "zod";

const lat = z.number().min(-90).max(90);
const lng = z.number().min(-180).max(180);
const label = z.string().trim().min(1).max(160);

export const favoriteCreateSchema = z.object({
  nickname: z.string().trim().min(1).max(60),
  originLabel: label,
  destinationLabel: label,
  originLatitude: lat,
  originLongitude: lng,
  destinationLatitude: lat,
  destinationLongitude: lng,
});
export type FavoriteCreateInput = z.infer<typeof favoriteCreateSchema>;

export const favoriteUpdateSchema = favoriteCreateSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Provide at least one field to update." });
export type FavoriteUpdateInput = z.infer<typeof favoriteUpdateSchema>;

export const favoriteListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
