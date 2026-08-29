import { sortRequests } from "@/features/requests/ordering";
import type { RequestRecord } from "@/features/requests/types";

export type RequestsEvent =
  | { type: "snapshot"; requests: RequestRecord[] }
  | { type: "insert" | "update"; request: RequestRecord }
  | { type: "delete"; id: string };

export function requestsReducer(state: RequestRecord[], event: RequestsEvent): RequestRecord[] {
  if (event.type === "snapshot") return sortRequests(event.requests);
  if (event.type === "delete") return state.filter((item) => item.id !== event.id);
  const map = new Map(state.map((item) => [item.id, item]));
  map.set(event.request.id, event.request);
  return sortRequests([...map.values()]);
}
