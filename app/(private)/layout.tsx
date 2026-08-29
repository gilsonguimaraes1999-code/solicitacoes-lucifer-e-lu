import { AppHeader } from "@/components/layout/app-header";
import { AccountMonitor } from "@/components/layout/account-monitor";
import { getSessionProfile } from "@/features/auth/guards";

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await getSessionProfile();
  return <><AppHeader profile={profile} /><AccountMonitor userId={user.id} />{children}</>;
}
