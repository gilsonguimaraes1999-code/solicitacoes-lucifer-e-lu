import Link from "next/link";

export default function NotFound() {
  return <main className="grid min-h-screen place-items-center p-5"><section className="panel max-w-md p-8 text-center"><h1 className="text-2xl font-bold">Página não encontrada</h1><Link href="/dashboard" className="button mt-5 inline-block">Voltar ao quadro</Link></section></main>;
}
