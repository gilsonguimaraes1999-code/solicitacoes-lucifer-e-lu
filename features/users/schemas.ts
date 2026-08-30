import { z } from "zod";

export const createUserSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.email(),
  password: z.string().min(8).max(72),
});

export const updateUserSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("rename"), fullName: z.string().trim().min(2).max(120) }),
  z.object({ action: z.literal("status"), approvalStatus: z.enum(["pending", "approved", "rejected", "suspended"]) }),
  z.object({ action: z.literal("permissions"), permissions: z.object({
    can_create_requests: z.boolean(), can_edit_requests: z.boolean(), can_move_requests: z.boolean(), can_delete_requests: z.boolean(), can_manage_columns: z.boolean(), can_manage_cities: z.boolean(),
  }) }),
]);
