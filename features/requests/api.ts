import { createBrowserClient } from "@/lib/supabase/browser";
import { requestSchema, type RequestInput } from "@/features/requests/schemas";
import type { RequestRecord } from "@/features/requests/types";

export async function createRequest(input: RequestInput, _createdBy: string, position: number) {
  const data = requestSchema.parse(input);
  const supabase = createBrowserClient();
  const response = await supabase.rpc("create_request", {
    new_title: data.title,
    new_description: data.description,
    new_requester_name: data.requesterName,
    new_assigned_to: data.assignedTo,
    new_external_url: data.externalUrl,
    new_position: position,
  });
  if (response.error) throw response.error;
  return response.data as RequestRecord;
}

export async function getRequest(requestId: string) {
  const response = await createBrowserClient()
    .from("requests")
    .select("*, assignee:profiles!requests_assigned_to_fkey(id,full_name)")
    .eq("id", requestId)
    .single();
  if (response.error) throw response.error;
  return response.data as RequestRecord;
}

export async function updateRequest(requestId: string, input: RequestInput) {
  const data = requestSchema.parse(input);
  const supabase = createBrowserClient();
  const response = await supabase.rpc("update_request_content", { request_id: requestId, new_title: data.title, new_description: data.description, new_requester_name: data.requesterName, new_assigned_to: data.assignedTo, new_external_url: data.externalUrl });
  if (response.error) throw response.error;
  return response.data as RequestRecord;
}

export async function moveRequest(requestId: string, columnId: string, position: number) {
  const response = await createBrowserClient().rpc("move_request", { request_id: requestId, new_column_id: columnId, new_position: position });
  if (response.error) throw response.error;
  return response.data as RequestRecord;
}

export async function deleteRequest(requestId: string) {
  const response = await createBrowserClient().from("requests").delete().eq("id", requestId);
  if (response.error) throw response.error;
}
