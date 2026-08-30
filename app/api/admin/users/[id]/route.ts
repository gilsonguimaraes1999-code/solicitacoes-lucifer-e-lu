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
  const { data: target, error: targetError } = await admin.from("profiles").select("id,role").eq("id", id).maybeSingle();
  if (targetError) return NextResponse.json({ error: "Não foi possível localizar o perfil do usuário." }, { status: 500 });
  if (!target) return NextResponse.json({ error: "O perfil deste usuário não existe. Recrie a conta ou restaure o perfil antes de editar." }, { status: 404 });
  if (target.role === "owner" && parsed.data.action !== "rename") return NextResponse.json({ error: "As permissões e o status da conta owner são nativos." }, { status: 400 });
  let error: { message: string } | null = null;
  if (parsed.data.action === "rename") ({ error } = await admin.from("profiles").update({ full_name: parsed.data.fullName }).eq("id", id));
  if (parsed.data.action === "status") ({ error } = await admin.from("profiles").update({ approval_status: parsed.data.approvalStatus }).eq("id", id));
  if (parsed.data.action === "permissions") ({ error } = await admin.from("user_permissions").upsert({
    user_id: id,
    can_create_requests: parsed.data.permissions.can_create_requests,
    can_edit_requests: parsed.data.permissions.can_edit_requests,
    can_move_requests: parsed.data.permissions.can_move_requests,
    can_delete_requests: parsed.data.permissions.can_delete_requests,
    can_manage_columns: parsed.data.permissions.can_manage_columns,
  }, { onConflict: "user_id" }));
  if (error) return NextResponse.json({ error: "Não foi possível salvar as alterações do usuário." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessionClient = await createServerClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { data: actor } = await sessionClient.from("profiles").select("role,approval_status").eq("id", user.id).single();
  if (actor?.role !== "owner" || actor.approval_status !== "approved") return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const { id } = await params;
  const admin = createAdminClient();
  const { data: target, error: targetError } = await admin.from("profiles").select("id,role").eq("id", id).maybeSingle();
  if (targetError) return NextResponse.json({ error: "Não foi possível localizar o perfil do usuário." }, { status: 500 });
  if (!target) return NextResponse.json({ error: "O perfil deste usuário não existe." }, { status: 404 });
  if (target.role === "owner") return NextResponse.json({ error: "A conta owner não pode ser excluída." }, { status: 400 });

  const { error: prepareError } = await admin.rpc("prepare_member_deletion", { target_user_id: id, replacement_user_id: user.id });
  if (prepareError) return NextResponse.json({ error: "Não foi possível realocar as solicitações desta conta." }, { status: 500 });

  const { error: deleteError } = await admin.auth.admin.deleteUser(id);
  if (deleteError) return NextResponse.json({ error: "Os vínculos foram realocados, mas a conta não pôde ser excluída. Tente novamente." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
