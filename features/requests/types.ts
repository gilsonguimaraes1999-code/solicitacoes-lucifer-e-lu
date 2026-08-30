import type { RequestTag } from "@/features/requests/tags";
import type { City } from "@/features/cities/types";

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
  can_manage_columns: boolean;
  can_manage_cities: boolean;
  updated_at: string;
}

export interface EffectivePermissions {
  canCreate: boolean;
  canEdit: boolean;
  canMove: boolean;
  canDelete: boolean;
  canManageColumns: boolean;
  canManageCities: boolean;
}

export interface RequestRecord {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string;
  external_url: string | null;
  tags: RequestTag[];
  status: RequestStatus | null;
  column_id: string;
  position: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  cities: City[];
  assignee?: Pick<Profile, "id" | "full_name"> | null;
}

export interface RequestRecordRaw extends Omit<RequestRecord, "cities"> {
  requester_name?: string | null;
  request_cities?: Array<{ city: City | null }>;
}

export const REQUEST_WITH_RELATIONS_SELECT = "*, assignee:profiles!requests_assigned_to_fkey(id,full_name), request_cities(city:cities(id,name,active,created_by,created_at,updated_at))";

export function normalizeRequestRecord(raw: RequestRecordRaw): RequestRecord {
  const { request_cities = [], requester_name: _legacyRequesterName, ...request } = raw;
  return {
    ...request,
    cities: request_cities.map((item) => item.city).filter((city): city is City => city !== null),
  };
}
