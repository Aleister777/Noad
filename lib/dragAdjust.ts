import type { MouseEvent as ReactMouseEvent } from "react";

/*
 Starts a middle-mouse-button "scrub" drag on a numeric field: holding the
 middle button and dragging the cursor up/down adjusts the value, mirroring
 the same up = increase / down = decrease direction as the scroll wheel.
 `onSteps` receives the total step count relative to the drag's starting
 position (not a per-move delta), so callers compute the new value as
 `startValue + steps` rather than accumulating off a possibly-stale value.
*/
export function startMiddleDragAdjust(
  e: ReactMouseEvent,
  onSteps: (steps: number) => void,
  pxPerStep = 4
) {
  if (e.button !== 1) return;
  e.preventDefault();
  e.stopPropagation();
  const startY = e.clientY;
  let last = 0;
  const onMove = (ev: MouseEvent) => {
    const steps = Math.trunc((startY - ev.clientY) / pxPerStep);
    if (steps !== last) { last = steps; onSteps(steps); }
  };
  const onUp = () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  };
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}
