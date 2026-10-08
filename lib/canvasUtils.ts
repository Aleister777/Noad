import type { Side, NodeData } from "./canvasTypes";

export function getPortPos(node: NodeData, side: Side, border = 0): { x: number; y: number } {
  // With CSS box-sizing:content-box, border grows outside the content area.
  // The visual box spans: left=node.x, right=node.x+width+2b, top=node.y, bottom=node.y+height+2b.
  const cx = node.x + border + node.width / 2;
  const cy = node.y + border + node.height / 2;
  if (side === "top")    return { x: cx, y: node.y };
  if (side === "bottom") return { x: cx, y: node.y + node.height + 2 * border };
  if (side === "left")   return { x: node.x, y: cy };
  return { x: node.x + node.width + 2 * border, y: cy };
}

function sideDir(s: Side): [number, number] {
  if (s === "right")  return [1, 0];
  if (s === "left")   return [-1, 0];
  if (s === "bottom") return [0, 1];
  return [0, -1];
}

function getCtrlPoints(
  x1: number, y1: number, fromSide: Side,
  x2: number, y2: number, toSide: Side,
) {
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const offset = Math.max(60, dist * 0.4);
  const [dx1, dy1] = sideDir(fromSide);
  const [dx2, dy2] = sideDir(toSide);
  return {
    cx1: x1 + dx1 * offset,
    cy1: y1 + dy1 * offset,
    cx2: x2 + dx2 * offset,
    cy2: y2 + dy2 * offset,
  };
}

export function buildCurvedPath(
  x1: number, y1: number, fromSide: Side,
  x2: number, y2: number, toSide: Side,
  bends?: { x: number; y: number }[]
): string {
  if (!bends || bends.length === 0) {
    const { cx1, cy1, cx2, cy2 } = getCtrlPoints(x1, y1, fromSide, x2, y2, toSide);
    return `M ${x1},${y1} C ${cx1},${cy1} ${cx2},${cy2} ${x2},${y2}`;
  }

  // Catmull-Rom spline through [start, ...waypoints, end].
  // Endpoint tangents use port directions; intermediate tangents use (P_{i+1} - P_{i-1}) / 2.
  const pts = [{ x: x1, y: y1 }, ...bends, { x: x2, y: y2 }];
  const N = pts.length;
  const tangents: { x: number; y: number }[] = [];

  for (let i = 0; i < N; i++) {
    if (i === 0) {
      const [dx, dy] = sideDir(fromSide);
      const dist = Math.hypot(pts[1].x - x1, pts[1].y - y1);
      const mag = Math.max(60, dist * 0.4) * 3;
      tangents.push({ x: dx * mag, y: dy * mag });
    } else if (i === N - 1) {
      // Incoming tangent at end port is opposite to the port exit direction.
      const [dx, dy] = sideDir(toSide);
      const dist = Math.hypot(x2 - pts[N - 2].x, y2 - pts[N - 2].y);
      const mag = Math.max(60, dist * 0.4) * 3;
      tangents.push({ x: -dx * mag, y: -dy * mag });
    } else {
      tangents.push({
        x: (pts[i + 1].x - pts[i - 1].x) / 2,
        y: (pts[i + 1].y - pts[i - 1].y) / 2,
      });
    }
  }

  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < N - 1; i++) {
    const p0 = pts[i], p1 = pts[i + 1];
    const cp1x = p0.x + tangents[i].x / 3;
    const cp1y = p0.y + tangents[i].y / 3;
    const cp2x = p1.x - tangents[i + 1].x / 3;
    const cp2y = p1.y - tangents[i + 1].y / 3;
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p1.x},${p1.y}`;
  }
  return d;
}

// Visual midpoint (t=0.5) of the single-segment Bézier — shown as the "add bend" handle.
export function getBezierMidpoint(
  x1: number, y1: number, fromSide: Side,
  x2: number, y2: number, toSide: Side,
): { x: number; y: number } {
  const { cx1, cy1, cx2, cy2 } = getCtrlPoints(x1, y1, fromSide, x2, y2, toSide);
  return {
    x: 0.125 * x1 + 0.375 * cx1 + 0.375 * cx2 + 0.125 * x2,
    y: 0.125 * y1 + 0.375 * cy1 + 0.375 * cy2 + 0.125 * y2,
  };
}

// Inserts a new waypoint into bends at the segment closest to the click point.
export function insertBendPoint(
  x1: number, y1: number,
  x2: number, y2: number,
  bends: { x: number; y: number }[],
  click: { x: number; y: number }
): { x: number; y: number }[] {
  const pts = [{ x: x1, y: y1 }, ...bends, { x: x2, y: y2 }];
  let bestSeg = 0, bestDist = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = distToSegment(click, pts[i], pts[i + 1]);
    if (d < bestDist) { bestDist = d; bestSeg = i; }
  }
  const newBends = [...bends];
  newBends.splice(bestSeg, 0, click);
  return newBends;
}

function distToSegment(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  const abx = b.x - a.x, aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2));
  return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby));
}

export function rectsOverlap(
  node: { x: number; y: number; width: number; height: number },
  sel: { x: number; y: number; w: number; h: number }
): boolean {
  return (
    node.x < sel.x + sel.w &&
    node.x + node.width  > sel.x &&
    node.y < sel.y + sel.h &&
    node.y + node.height > sel.y
  );
}

export function oppositeSide(s: Side): Side {
  if (s === "top")    return "bottom";
  if (s === "bottom") return "top";
  if (s === "left")   return "right";
  return "left";
}
