import Link from "next/link";
import Image from "next/image";
import { AppBackground } from "@/components/layout/app-background";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden p-5">
      <AppBackground variant="stars" />
      <section className="auth-card relative z-10 w-full max-w-md px-7 py-8">
        <Link href="/" className="mx-auto block w-fit text-center"><Image src="/angel-a.png" alt="" width={112} height={112} priority className="mx-auto h-28 w-28 object-contain" /><span className="mt-1 block font-display text-lg font-black uppercase tracking-[.12em] text-white">Solicitações</span></Link>
        {children}
      </section>
    </main>
  );
}
