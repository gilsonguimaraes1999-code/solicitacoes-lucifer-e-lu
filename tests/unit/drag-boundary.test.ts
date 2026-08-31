import type { ClientRect } from "@dnd-kit/core";
import type { Transform } from "@dnd-kit/utilities";
import { describe, expect, it } from "vitest";
import { clampTransformToRect, createBoundaryModifier } from "@/components/kanban/drag-boundary";

function rect(rectangle: ClientRect): ClientRect {
  return rectangle;
}

describe("clampTransformToRect", () => {
  it("limita o transform aos quatro lados e preserva propriedades extras", () => {
    const transform = { x: 600, y: 400, scaleX: 1.2, scaleY: 0.8, opacity: 0.5 } satisfies Transform & { opacity: number };
    const draggingRect = rect({ top: 150, left: 200, right: 400, bottom: 350, width: 200, height: 200 });
    const boundaryRect = rect({ top: 50, left: 100, right: 900, bottom: 650, width: 800, height: 600 });

    expect(clampTransformToRect(transform, draggingRect, boundaryRect)).toEqual({
      x: 500,
      y: 300,
      scaleX: 1.2,
      scaleY: 0.8,
      opacity: 0.5,
    });
    expect(clampTransformToRect({ ...transform, x: -150, y: -250 }, draggingRect, boundaryRect)).toEqual({
      x: -100,
      y: -100,
      scaleX: 1.2,
      scaleY: 0.8,
      opacity: 0.5,
    });
  });

  it("ancora no início do eixo quando o item é maior do que o limite", () => {
    const transform = { x: 999, y: 999, scaleX: 1, scaleY: 1 };
    const draggingRect = rect({ top: 120, left: 160, right: 760, bottom: 620, width: 600, height: 500 });
    const boundaryRect = rect({ top: 100, left: 200, right: 500, bottom: 450, width: 300, height: 350 });

    expect(clampTransformToRect(transform, draggingRect, boundaryRect)).toEqual({
      x: 40,
      y: -20,
      scaleX: 1,
      scaleY: 1,
    });
  });
});

describe("createBoundaryModifier", () => {
  it("retorna o transform original se faltar o retângulo do item ou o limite", () => {
    const transform = { x: 25, y: -15, scaleX: 1, scaleY: 1 };
    const modifier = createBoundaryModifier(() => null);

    expect(modifier({
      activatorEvent: null,
      active: null,
      activeNodeRect: null,
      draggingNodeRect: null,
      containerNodeRect: null,
      over: null,
      overlayNodeRect: null,
      scrollableAncestors: [],
      scrollableAncestorRects: [],
      transform,
      windowRect: null,
    })).toBe(transform);

    const boundaryRect = rect({ top: 50, left: 100, right: 900, bottom: 650, width: 800, height: 600 });
    const withBoundary = createBoundaryModifier(() => boundaryRect);

    expect(withBoundary({
      activatorEvent: null,
      active: null,
      activeNodeRect: null,
      draggingNodeRect: null,
      containerNodeRect: null,
      over: null,
      overlayNodeRect: null,
      scrollableAncestors: [],
      scrollableAncestorRects: [],
      transform,
      windowRect: null,
    })).toBe(transform);
  });

  it("usa o retângulo medido para limitar o movimento", () => {
    const transform = { x: 600, y: 400, scaleX: 1, scaleY: 1 };
    const draggingNodeRect = rect({ top: 150, left: 200, right: 400, bottom: 350, width: 200, height: 200 });
    const boundaryRect = rect({ top: 50, left: 100, right: 900, bottom: 650, width: 800, height: 600 });
    const modifier = createBoundaryModifier(() => boundaryRect);

    expect(modifier({
      activatorEvent: null,
      active: null,
      activeNodeRect: null,
      draggingNodeRect,
      containerNodeRect: null,
      over: null,
      overlayNodeRect: null,
      scrollableAncestors: [],
      scrollableAncestorRects: [],
      transform,
      windowRect: null,
    })).toEqual({
      x: 500,
      y: 300,
      scaleX: 1,
      scaleY: 1,
    });
  });
});
