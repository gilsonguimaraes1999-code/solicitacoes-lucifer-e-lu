"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="grid min-h-screen place-items-center p-5"><section className="panel max-w-md p-8 text-center"><h1 className="text-xl font-bold">Algo deu errado</h1><p className="mt-2 text-slate-600">Não foi possível carregar esta página.</p><button className="button mt-5" onClick={reset}>Tentar novamente</button></section></main>;
}
