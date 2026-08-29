export const REQUEST_STATUSES = ["pending", "in_progress", "completed"] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export type ApprovalStatus = "pending" | "approved" | "rejected" | "suspended";
export type UserRole = "owner" | "member";

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  approval_status: ApprovalStatus;
  created_at: string;
  updated_at: string;
}

export interface UserPermissions {
  user_id: string;
  can_create_requests: boolean;
  can_edit_requests: boolean;
  can_move_requests: boolean;
  can_delete_requests: boolean;
  updated_at: string;
}

export interface EffectivePermissions {
  canCreate: boolean;
  canEdit: boolean;
  canMove: boolean;
  canDelete: boolean;
}

export interface RequestRecord {
  id: string;
  title: string;
  description: string | null;
  requester_name: string;
  assigned_to: string;
  external_url: string | null;
  status: RequestStatus;
  position: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  assignee?: Pick<Profile, "id" | "full_name"> | null;
}
