import { AppHeader } from "@/components/layout/app-header";
import { AccountMonitor } from "@/components/layout/account-monitor";
import { getSessionProfile } from "@/features/auth/guards";
import { AppBackground } from "@/components/layout/app-background";

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await getSessionProfile();
  return <><AppBackground /><div className="relative z-10 min-h-screen"><AppHeader profile={profile} /><AccountMonitor userId={user.id} />{children}</div></>;
}
