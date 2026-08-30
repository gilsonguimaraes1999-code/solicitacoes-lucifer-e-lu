import { AppHeader } from "@/components/layout/app-header";
import { AccountMonitor } from "@/components/layout/account-monitor";
import { getSessionProfile } from "@/features/auth/guards";
import { AppBackground } from "@/components/layout/app-background";
import { effectivePermissions } from "@/lib/permissions";

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, permissions } = await getSessionProfile();
  return <><AppBackground /><div className="relative z-10 min-h-screen"><AppHeader profile={profile} permissions={effectivePermissions(profile, permissions)} /><AccountMonitor userId={user.id} />{children}</div></>;
}
