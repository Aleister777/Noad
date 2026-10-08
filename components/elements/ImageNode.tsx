"use client";

import type { CSSProperties } from "react";
import type { ImageNodeData, Side, Corner, GlobalSettings } from "@/lib/canvasTypes";

interface Props {
  image: ImageNodeData;
  isSelected: boolean;
  showHandles: boolean;
  isPanning: boolean;
  globalSettings: GlobalSettings;
  onMouseDown: (e: React.MouseEvent) => void;
  onResizeMouseDown: (e: React.MouseEvent, corner: Corner) => void;
  onEdgeResizeMouseDown: (e: React.MouseEvent, side: Side) => void;
}

// Scaled 2.25x (125% more than the original 20px/32px bands) so grabbing the
// outside edge to resize reliably wins over the image's own drag-to-move area.
const EDGE_HANDLES: { side: Side; cursor: string; style: CSSProperties }[] = [
  { side: "top",    cursor: "ns-resize", style: { top: -22.5,    left: 28, right: 28, height: 45 } },
  { side: "bottom", cursor: "ns-resize", style: { bottom: -22.5, left: 28, right: 28, height: 45 } },
  { side: "left",   cursor: "ew-resize", style: { left: -22.5,   top: 28,  bottom: 28, width: 45 } },
  { side: "right",  cursor: "ew-resize", style: { right: -22.5,  top: 28,  bottom: 28, width: 45 } },
];

const CORNER_HANDLES: { corner: Corner; cursor: string; pos: CSSProperties }[] = [
  { corner: "tl", cursor: "nw-resize", pos: { top: -22.5, left: -22.5, width: 72, height: 72 } },
  { corner: "tr", cursor: "ne-resize", pos: { top: -22.5, right: -22.5, width: 72, height: 72 } },
  { corner: "bl", cursor: "sw-resize", pos: { bottom: -22.5, left: -22.5, width: 72, height: 72 } },
  { corner: "br", cursor: "se-resize", pos: { bottom: -22.5, right: -22.5, width: 72, height: 72 } },
];

export default function ImageNode({
  image, isSelected, showHandles, isPanning, globalSettings,
  onMouseDown, onResizeMouseDown, onEdgeResizeMouseDown,
}: Props) {
  return (
    <div
      style={{
        position: "absolute",
        left: image.x, top: image.y, width: image.width, height: image.height,
        boxShadow: isSelected
          ? `0 0 0 3px ${globalSettings.selectionBorderColor ?? "#378ADD"}`
          : "0 2px 8px rgba(0,0,0,0.06)",
        cursor: isPanning ? "grabbing" : "grab",
        userSelect: "none",
      }}
      onMouseDown={onMouseDown}
    >
      <div
        style={{ width: "100%", height: "100%", pointerEvents: "none" }}
        dangerouslySetInnerHTML={{ __html: image.svg }}
      />

      {/* Edge resize handles */}
      {EDGE_HANDLES.map(({ side, cursor, style }) => (
        <div
          key={`edge-${side}`}
          data-resize="true"
          onMouseDown={e => onEdgeResizeMouseDown(e, side)}
          style={{ position: "absolute", zIndex: 5, cursor, ...style }}
        />
      ))}

      {/* Corner resize handles */}
      {showHandles && CORNER_HANDLES.map(({ corner, cursor, pos }) => (
        <div
          key={corner}
          data-resize="true"
          onMouseDown={e => onResizeMouseDown(e, corner)}
          style={{ position: "absolute", width: 24, height: 24, cursor, ...pos }}
        />
      ))}
    </div>
  );
}
