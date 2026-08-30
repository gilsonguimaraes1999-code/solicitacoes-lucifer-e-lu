import { createBrowserClient } from "@/lib/supabase/browser";
import { requestSchema, type RequestInput } from "@/features/requests/schemas";
import {
  normalizeRequestRecord,
  REQUEST_WITH_RELATIONS_SELECT,
  type RequestRecordRaw,
} from "@/features/requests/types";

export { normalizeRequestRecord, REQUEST_WITH_RELATIONS_SELECT } from "@/features/requests/types";

export async function createRequest(input: RequestInput, _createdBy: string, position: number) {
  const data = requestSchema.parse(input);
  const supabase = createBrowserClient();
  const response = await supabase.rpc("create_request_with_cities", {
    new_title: data.title,
    new_description: data.description,
    new_assigned_to: data.assignedTo,
    new_external_url: data.externalUrl,
    new_tags: data.tags,
    new_position: position,
    new_city_ids: data.cityIds,
  });
  if (response.error) throw response.error;
  return getRequest((response.data as Pick<RequestRecordRaw, "id">).id);
}

export async function getRequest(requestId: string) {
  const response = await createBrowserClient()
    .from("requests")
    .select(REQUEST_WITH_RELATIONS_SELECT)
    .eq("id", requestId)
    .single();
  if (response.error) throw response.error;
  return normalizeRequestRecord(response.data as RequestRecordRaw);
}

export async function updateRequest(requestId: string, input: RequestInput) {
  const data = requestSchema.parse(input);
  const supabase = createBrowserClient();
  const response = await supabase.rpc("update_request_with_cities", {
    request_id: requestId,
    new_title: data.title,
    new_description: data.description,
    new_assigned_to: data.assignedTo,
    new_external_url: data.externalUrl,
    new_tags: data.tags,
    new_city_ids: data.cityIds,
  });
  if (response.error) throw response.error;
  return getRequest((response.data as Pick<RequestRecordRaw, "id">).id);
}

export async function moveRequest(requestId: string, columnId: string, position: number) {
  const response = await createBrowserClient().rpc("move_request", { request_id: requestId, new_column_id: columnId, new_position: position });
  if (response.error) throw response.error;
  return getRequest((response.data as Pick<RequestRecordRaw, "id">).id);
}

export async function deleteRequest(requestId: string) {
  const response = await createBrowserClient().from("requests").delete().eq("id", requestId);
  if (response.error) throw response.error;
}
