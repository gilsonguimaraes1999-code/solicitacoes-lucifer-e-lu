import type { ApprovalStatus } from "@/features/requests/types";

export interface PermissionSet {
  can_create_requests: boolean;
  can_edit_requests: boolean;
  can_move_requests: boolean;
  can_delete_requests: boolean;
  can_manage_columns: boolean;
  can_manage_cities: boolean;
}

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: "owner" | "member";
  approval_status: ApprovalStatus;
  created_at?: string;
  permissions: PermissionSet;
}

export interface UserEditorValue {
  fullName: string;
  approvalStatus: ApprovalStatus;
  permissions: PermissionSet;
}
