export function AuthMessage({ error, success }: { error?: string; success?: string }) {
  if (!error && !success) return null;
  return (
    <p className={`mt-4 rounded-lg p-3 text-sm ${error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
      {error ?? success}
    </p>
  );
}
