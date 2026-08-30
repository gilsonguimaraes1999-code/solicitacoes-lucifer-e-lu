import type { ApprovalStatus } from "@/features/requests/types";

export type UserStatusFilter = ApprovalStatus | "all";
export type UserSortOrder = "asc" | "desc";

export interface FilterableUser {
  id: string;
  fullName: string;
  email: string;
  approvalStatus: ApprovalStatus;
}

export function sortUsersByName<T extends Pick<FilterableUser, "fullName">>(users: T[], order: UserSortOrder): T[] {
  return [...users].sort((left, right) => {
    const comparison = left.fullName.localeCompare(right.fullName, "pt-BR", { sensitivity: "base" });
    return order === "asc" ? comparison : -comparison;
  });
}

export function filterUsersByStatus<T extends FilterableUser>(
  users: T[],
  status: UserStatusFilter,
  query: string,
): T[] {
  const normalized = query.trim().toLocaleLowerCase("pt-BR");
  return users.filter((user) => {
    const matchesStatus = status === "all" || user.approvalStatus === status;
    const matchesQuery =
      !normalized ||
      user.fullName.toLocaleLowerCase("pt-BR").includes(normalized) ||
      user.email.toLocaleLowerCase("pt-BR").includes(normalized);
    return matchesStatus && matchesQuery;
  });
}
