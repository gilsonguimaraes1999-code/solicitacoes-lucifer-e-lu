import Link from "next/link";
import Image from "next/image";
import { AppBackground } from "@/components/layout/app-background";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-x-hidden px-4">
      <AppBackground variant="stars" />
      <section className="relative z-10 w-full max-w-md px-7 py-10">
        <Link href="/" className="mx-auto block w-fit text-center">
          <Image src="/angel-a.png" alt="Solicitações Lucifer e Lu" width={208} height={208} priority className="mx-auto h-44 w-44 object-contain sm:h-52 sm:w-52" />
        </Link>
        {children}
      </section>
    </main>
  );
}

