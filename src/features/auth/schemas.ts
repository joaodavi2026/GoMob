import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
});
export type ProfileInput = z.infer<typeof profileSchema>;
