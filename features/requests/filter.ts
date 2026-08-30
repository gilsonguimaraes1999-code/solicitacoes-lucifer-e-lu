import type { RequestRecord } from "@/features/requests/types";

function normalize(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR").trim();
}

export function filterBoard(requests: RequestRecord[], selectedColumnId: string, query: string): RequestRecord[] {
  const normalizedQuery = normalize(query);
  return requests.filter((request) => {
    if (selectedColumnId !== "all" && request.column_id !== selectedColumnId) return false;
    if (!normalizedQuery) return true;
    return [request.title, request.requester_name, request.assignee?.full_name ?? ""].some((value) => normalize(value).includes(normalizedQuery));
  });
}
