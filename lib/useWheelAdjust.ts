import { useEffect, useRef, type RefObject } from "react";

/*
 React attaches onWheel listeners as passive by default, so calling
 preventDefault() from a React synthetic wheel handler is silently ignored —
 the scroll still reaches the nearest scrollable ancestor (e.g. a sidebar
 panel) even though the field's own value updates correctly. Attaching a
 real, non-passive listener via addEventListener is the only way to actually
 block that ancestor scroll while the cursor is over the field.
*/
export function useWheelAdjust<T extends HTMLElement>(ref: RefObject<T | null>, onDelta: (deltaY: number) => void) {
  const onDeltaRef = useRef(onDelta);
  onDeltaRef.current = onDelta;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onDeltaRef.current(e.deltaY);
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [ref]);
}
