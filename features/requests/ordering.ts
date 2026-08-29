const POSITION_STEP = 1024;

export function positionBetween(before?: number, after?: number): number {
  if (before === undefined && after === undefined) return POSITION_STEP;
  if (before === undefined) return Math.max(after! / 2, Number.EPSILON);
  if (after === undefined) return before + POSITION_STEP;
  return before + (after - before) / 2;
}

export function sortRequests<T extends { position: number; created_at: string; id: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
  );
}
