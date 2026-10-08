"use client";

import type { ConnectionData, NodeData, GlobalSettings, Tool } from "@/lib/canvasTypes";
import { getPortPos, buildCurvedPath, getBezierMidpoint } from "@/lib/canvasUtils";

function brightenHex(hex: string, fraction: number): string {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return hex;
  const rv = parseInt(hex.slice(1, 3), 16) / 255;
  const gv = parseInt(hex.slice(3, 5), 16) / 255;
  const bv = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(rv, gv, bv), min = Math.min(rv, gv, bv);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rv) h = ((gv - bv) / d + (gv < bv ? 6 : 0)) / 6;
    else if (max === gv) h = ((bv - rv) / d + 2) / 6;
    else h = ((rv - gv) / d + 4) / 6;
  }
  const nl = l + (1 - l) * fraction;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let nr: number, ng: number, nb: number;
  if (s === 0) { nr = ng = nb = nl; }
  else {
    const q2 = nl < 0.5 ? nl * (1 + s) : nl + s - nl * s;
    const p2 = 2 * nl - q2;
    nr = hue2rgb(p2, q2, h + 1 / 3);
    ng = hue2rgb(p2, q2, h);
    nb = hue2rgb(p2, q2, h - 1 / 3);
  }
  const toH = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0");
  return "#" + toH(nr) + toH(ng) + toH(nb);
}

interface Props {
  conn: ConnectionData;
  fromNode: NodeData;
  toNode: NodeData;
  isSelected: boolean;
  tool: Tool;
  globalSettings: GlobalSettings;
  onMouseDown: (e: React.MouseEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  onBendMouseDown: (e: React.MouseEvent, index: number | null, naturalX: number, naturalY: number) => void;
  onBendDoubleClick: (e: React.MouseEvent, index: number) => void;
}

export default function Connection({
  conn, fromNode, toNode, isSelected, tool, globalSettings,
  onMouseDown, onDoubleClick, onBendMouseDown, onBendDoubleClick,
}: Props) {
  const a = getPortPos(fromNode, conn.fromSide, fromNode.borderThickness ?? globalSettings.boxBorderThickness);
  const b = getPortPos(toNode,   conn.toSide,   toNode.borderThickness   ?? globalSettings.boxBorderThickness);

  const connColor = conn.color ?? globalSettings.arrowColor;
  const connThickness = conn.lineThickness ?? globalSettings.lineThickness;
  const s = conn.arrowSize ?? globalSettings.arrowSize;
  const color = isSelected
    ? brightenHex(globalSettings.selectionHighlightColor ?? "#378ADD", globalSettings.selectionHighlightBrightness ?? 0.5)
    : connColor;
  const markerFill = color;

  const mw = 8 * s, mh = 6 * s, rx = 7 * s, ry = 3 * s;
  const pts = `0 0, ${8 * s} ${3 * s}, 0 ${6 * s}`;
  const endMarkerId  = `arrow-end-${conn.id}`;
  const startMarkerId = `arrow-start-${conn.id}`;

  const d = buildCurvedPath(a.x, a.y, conn.fromSide, b.x, b.y, conn.toSide, conn.bends);
  const markerEnd   = conn.arrowEnd   ? `url(#${endMarkerId})`   : undefined;
  const markerStart = conn.arrowStart ? `url(#${startMarkerId})` : undefined;

  const bends = conn.bends ?? [];
  const showEndpoints = isSelected && (tool === "select" || tool === "arrow");
  const vectorR = connThickness * s * 1.25;

  return (
    <g>
      <defs>
        {conn.arrowEnd && (
          <marker id={endMarkerId} markerWidth={mw} markerHeight={mh} refX={rx} refY={ry} orient="auto">
            <polygon points={pts} fill={markerFill} />
          </marker>
        )}
        {conn.arrowStart && (
          <marker id={startMarkerId} markerWidth={mw} markerHeight={mh} refX={rx} refY={ry} orient="auto-start-reverse">
            <polygon points={pts} fill={markerFill} />
          </marker>
        )}
      </defs>

      {/* Wide transparent hit area */}
      <path
        d={d} stroke="transparent" strokeWidth={22} fill="none"
        style={{ pointerEvents: "stroke", cursor: "grab" }}
        onMouseDown={onMouseDown}
        onDoubleClick={onDoubleClick}
      />
      {/* Visible stroke */}
      <path
        d={d} stroke={color} strokeWidth={connThickness} fill="none"
        markerStart={markerStart}
        markerEnd={markerEnd}
        style={{ pointerEvents: "none" }}
      />

      {/* Bend handles */}
      {isSelected && bends.length === 0 && (() => {
        const mid = getBezierMidpoint(a.x, a.y, conn.fromSide, b.x, b.y, conn.toSide);
        return (
          <circle
            cx={mid.x} cy={mid.y} r={vectorR}
            fill={color} stroke="#fff" strokeWidth={1.5}
            style={{ pointerEvents: "all", cursor: "crosshair" }}
            onMouseDown={e => onBendMouseDown(e, null, mid.x, mid.y)}
          />
        );
      })()}
      {isSelected && bends.length > 0 && bends.map((bend, i) => (
        <circle
          key={i}
          cx={bend.x} cy={bend.y} r={vectorR}
          fill={color} stroke="#fff" strokeWidth={1.5}
          style={{ pointerEvents: "all", cursor: "crosshair" }}
          onMouseDown={e => onBendMouseDown(e, i, bend.x, bend.y)}
          onDoubleClick={e => { e.stopPropagation(); onBendDoubleClick(e, i); }}
        />
      ))}

      {/* Endpoint indicators — visual only; actual drag is handled by port circles in Node */}
      {showEndpoints && (
        <>
          <circle cx={a.x} cy={a.y} r={6} fill="#fff" stroke={color} strokeWidth={2} style={{ pointerEvents: "none" }} />
          <circle cx={b.x} cy={b.y} r={6} fill="#fff" stroke={color} strokeWidth={2} style={{ pointerEvents: "none" }} />
        </>
      )}
    </g>
  );
}
