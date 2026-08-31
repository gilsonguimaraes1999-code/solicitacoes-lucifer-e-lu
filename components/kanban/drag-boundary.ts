import type { ClientRect, Modifier } from "@dnd-kit/core";
import type { Transform } from "@dnd-kit/utilities";

function clampToRange(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function clampAxis(offset: number, start: number, end: number, boundaryStart: number, boundaryEnd: number) {
  const minimum = boundaryStart - start;
  const maximum = boundaryEnd - end;
  return maximum < minimum ? minimum : clampToRange(offset, minimum, maximum);
}

export function clampTransformToRect<T extends Transform>(
  transform: T,
  draggingRect: ClientRect | null | undefined,
  boundaryRect: ClientRect | null | undefined,
): T {
  if (!draggingRect || !boundaryRect) return transform;

  return {
    ...transform,
    x: clampAxis(transform.x, draggingRect.left, draggingRect.right, boundaryRect.left, boundaryRect.right),
    y: clampAxis(transform.y, draggingRect.top, draggingRect.bottom, boundaryRect.top, boundaryRect.bottom),
  };
}

export function createBoundaryModifier(getBoundaryRect: () => ClientRect | null): Modifier {
  return ({ transform, draggingNodeRect, overlayNodeRect, activeNodeRect }) => clampTransformToRect(
    transform,
    draggingNodeRect ?? overlayNodeRect ?? activeNodeRect,
    getBoundaryRect(),
  );
}
