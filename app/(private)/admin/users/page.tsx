import { UsersPanel } from "@/components/users/users-panel";
import { requireOwner } from "@/features/auth/guards";

export default async function UsersPage() {
  const { user } = await requireOwner();
  return <UsersPanel currentUserId={user.id} />;
}
