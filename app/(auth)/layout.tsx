import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen grid place-items-center p-5">
      <section className="panel w-full max-w-md p-7">
        <Link href="/" className="text-xl font-extrabold tracking-tight">Solicitações</Link>
        {children}
      </section>
    </main>
  );
}
