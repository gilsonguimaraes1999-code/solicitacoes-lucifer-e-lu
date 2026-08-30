import type { EffectivePermissions, Profile, UserPermissions } from "@/features/requests/types";

export function effectivePermissions(
  profile: Pick<Profile, "role" | "approval_status">,
  permissions: Partial<UserPermissions> | null,
): EffectivePermissions {
  if (profile.role === "owner") {
    return { canCreate: true, canEdit: true, canMove: true, canDelete: true, canManageColumns: true };
  }
  return {
    canCreate: permissions?.can_create_requests ?? false,
    canEdit: permissions?.can_edit_requests ?? false,
    canMove: permissions?.can_move_requests ?? false,
    canDelete: permissions?.can_delete_requests ?? false,
    canManageColumns: profile.approval_status === "approved" && (permissions?.can_manage_columns ?? false),
  };
}
