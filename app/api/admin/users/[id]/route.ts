import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateUserSchema } from "@/features/users/schemas";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionClient = await createServerClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { data: actor } = await sessionClient.from("profiles").select("role,approval_status").eq("id", user.id).single();
  if (actor?.role !== "owner" || actor.approval_status !== "approved") return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const { id } = await params;
  const parsed = updateUserSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  if (id === user.id && parsed.data.action === "status" && parsed.data.approvalStatus !== "approved") return NextResponse.json({ error: "Você não pode bloquear a própria conta owner" }, { status: 400 });
  const admin = createAdminClient();
  let error: { message: string } | null = null;
  if (parsed.data.action === "rename") ({ error } = await admin.from("profiles").update({ full_name: parsed.data.fullName }).eq("id", id));
  if (parsed.data.action === "status") ({ error } = await admin.from("profiles").update({ approval_status: parsed.data.approvalStatus }).eq("id", id));
  if (parsed.data.action === "permissions") ({ error } = await admin.from("user_permissions").update(parsed.data.permissions).eq("user_id", id));
  if (error) return NextResponse.json({ error: "Não foi possível atualizar o usuário" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
