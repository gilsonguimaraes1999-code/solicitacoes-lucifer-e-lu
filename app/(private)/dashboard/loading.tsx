export default function Loading() {
  return <main className="relative z-10 p-5"><div className="mx-auto grid max-w-[1800px] gap-4 md:grid-cols-3">{[1,2,3].map((n) => <div key={n} className="h-96 animate-pulse rounded-2xl border border-white/10 bg-white/5" />)}</div></main>;
}
