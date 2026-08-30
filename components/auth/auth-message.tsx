export function AuthMessage({ error, success }: { error?: string; success?: string }) {
  if (!error && !success) return null;
  return (
    <p className={`mt-4 rounded-lg border p-3 text-sm ${error ? "border-red-400/20 bg-red-400/10 text-red-300" : "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"}`}>
      {error ?? success}
    </p>
  );
}
