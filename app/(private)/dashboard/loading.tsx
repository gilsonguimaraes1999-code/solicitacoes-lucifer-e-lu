export default function Loading() {
  return <main className="p-5"><div className="mx-auto grid max-w-[1500px] gap-4 md:grid-cols-3">{[1,2,3].map((n) => <div key={n} className="h-96 animate-pulse rounded-2xl bg-slate-200" />)}</div></main>;
}
