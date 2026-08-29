import { createBrowserClient } from "@/lib/supabase/browser";
import { requestSchema, type RequestInput } from "@/features/requests/schemas";
import type { RequestRecord, RequestStatus } from "@/features/requests/types";

export async function createRequest(input: RequestInput, createdBy: string, position: number) {
  const data = requestSchema.parse(input);
  const supabase = createBrowserClient();
  const response = await supabase.from("requests").insert({ title: data.title, description: data.description || null, requester_name: data.requesterName, assigned_to: data.assignedTo, external_url: data.externalUrl, created_by: createdBy, status: "pending", position }).select("*, assignee:profiles!requests_assigned_to_fkey(id,full_name)").single();
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

export async function moveRequest(requestId: string, status: RequestStatus, position: number) {
  const response = await createBrowserClient().rpc("move_request", { request_id: requestId, new_status: status, new_position: position });
  if (response.error) throw response.error;
  return response.data as RequestRecord;
}

export async function deleteRequest(requestId: string) {
  const response = await createBrowserClient().from("requests").delete().eq("id", requestId);
  if (response.error) throw response.error;
}
