import Link from "next/link";
import Image from "next/image";
import { AppBackground } from "@/components/layout/app-background";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-x-hidden px-4 py-8">
      <AppBackground variant="stars" />
      <section className="relative z-10 w-full max-w-md px-3 py-6 sm:px-7 sm:py-10">
        <Link href="/" className="mx-auto block w-fit text-center"><Image src="/angel-a.png" alt="" width={208} height={208} priority className="mx-auto h-44 w-44 object-contain sm:h-52 sm:w-52" /><span className="-mt-4 block font-display text-xl font-black uppercase tracking-[.12em] text-white">Solicitações</span></Link>
        {children}
      </section>
    </main>
  );
}
