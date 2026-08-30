import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createUserSchema } from "@/features/users/schemas";

async function authorizeOwner() {
  const client = await createServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;
  const { data: profile } = await client.from("profiles").select("role,approval_status").eq("id", user.id).single();
  return profile?.role === "owner" && profile.approval_status === "approved" ? user : null;
}

export async function GET() {
  if (!await authorizeOwner()) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const admin = createAdminClient();
  const [{ data: authData, error: authError }, { data: profiles, error: profilesError }, { data: permissions, error: permissionsError }] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }), admin.from("profiles").select("*").order("created_at", { ascending: false }), admin.from("user_permissions").select("*"),
  ]);
  if (authError) return NextResponse.json({ error: "Não foi possível carregar os usuários" }, { status: 500 });
  if (profilesError) return NextResponse.json({ error: "Não foi possível carregar os perfis dos usuários." }, { status: 500 });
  if (permissionsError) return NextResponse.json({ error: "Não foi possível carregar as permissões dos usuários." }, { status: 500 });
  const profileMap = new Map((profiles ?? []).map((item) => [item.id, item]));
  const permissionMap = new Map((permissions ?? []).map((item) => [item.user_id, item]));
  const missingProfile = authData.users.find((user) => !profileMap.has(user.id));
  if (missingProfile) return NextResponse.json({ error: `A conta ${missingProfile.email ?? missingProfile.id} está sem perfil. Restaure o perfil antes de administrá-la.` }, { status: 409 });
  return NextResponse.json(authData.users.map((user) => {
    const profile = profileMap.get(user.id);
    const permission = permissionMap.get(user.id);
    return {
      id: user.id,
      email: user.email ?? "",
      created_at: user.created_at,
      full_name: profile?.full_name ?? user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Usuário",
      role: profile?.role ?? "member",
      approval_status: profile?.approval_status ?? "pending",
      permissions: {
        can_create_requests: permission?.can_create_requests ?? false,
        can_edit_requests: permission?.can_edit_requests ?? false,
        can_move_requests: permission?.can_move_requests ?? false,
        can_delete_requests: permission?.can_delete_requests ?? false,
        can_manage_columns: permission?.can_manage_columns ?? false,
      },
    };
  }));
}

export async function POST(request: Request) {
  if (!await authorizeOwner()) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const parsed = createUserSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  const { data, error } = await createAdminClient().auth.admin.createUser({ email: parsed.data.email, password: parsed.data.password, email_confirm: true, user_metadata: { full_name: parsed.data.fullName } });
  if (error) return NextResponse.json({ error: "Não foi possível criar a conta" }, { status: 400 });
  return NextResponse.json({ id: data.user.id }, { status: 201 });
}
