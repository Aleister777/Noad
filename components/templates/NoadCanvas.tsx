"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { Tool, Corner, Side, NodeData, ConnectionData, ImageNodeData, GlobalSettings } from "@/lib/canvasTypes";
import { DEFAULT_GLOBAL } from "@/lib/canvasTypes";
import { getPortPos, oppositeSide, buildCurvedPath, rectsOverlap, insertBendPoint } from "@/lib/canvasUtils";
import { plainText } from "@/lib/richText";
import Toolbar from "@/components/molecules/Toolbar";
import Node from "@/components/elements/Node";
import ImageNode from "@/components/elements/ImageNode";
import Connection from "@/components/elements/Connection";
import Sidebar from "@/components/organisms/Sidebar";
import GlobalSidebar from "@/components/organisms/GlobalSidebar";
import TopMenu from "@/components/organisms/TopMenu";
import ImageModal from "@/components/organisms/ImageModal";
import HelpModal from "@/components/organisms/HelpModal";

const CURSORS: Record<Tool, string> = {
  select: "default", box: "crosshair", arrow: "default",
};

// Maps Next.js CSS font variables to real family names for use in SVG (CSS vars
// don't resolve inside SVG presentation attributes).
const FONT_VAR_MAP: Record<string, string> = {
  "var(--font-inter)":       "Inter, sans-serif",
  "var(--font-lato)":        "Lato, sans-serif",
  "var(--font-poppins)":     "Poppins, sans-serif",
  "var(--font-roboto)":      "Roboto, sans-serif",
  "var(--font-merriweather)":"Merriweather, serif",
  "var(--font-playfair)":    '"Playfair Display", serif',
  "var(--font-source-code)": '"Source Code Pro", monospace',
  "var(--font-dm-sans)":     '"DM Sans", sans-serif',
  "var(--font-raleway)":     "Raleway, sans-serif",
  "var(--font-nunito)":      "Nunito, sans-serif",
};
function resolveFont(f: string): string {
  return FONT_VAR_MAP[f.trim()] ?? f ?? "sans-serif";
}

function buildExportSVG(
  nodes: NodeData[],
  connections: ConnectionData[],
  images: ImageNodeData[],
  gs: GlobalSettings
): string {
  const escXml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const PADDING = 48;
  const TITLE_ABOVE = 32;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    const t = (n.borderThickness ?? gs.boxBorderThickness) / 2;
    minX = Math.min(minX, n.x - t);
    minY = Math.min(minY, n.y - t - TITLE_ABOVE);
    maxX = Math.max(maxX, n.x + n.width + t);
    maxY = Math.max(maxY, n.y + n.height + t);
  }
  for (const c of connections) {
    for (const b of c.bends ?? []) {
      minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x); maxY = Math.max(maxY, b.y);
    }
  }
  for (const im of images) {
    minX = Math.min(minX, im.x); minY = Math.min(minY, im.y);
    maxX = Math.max(maxX, im.x + im.width); maxY = Math.max(maxY, im.y + im.height);
  }
  if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 800; maxY = 600; }

  const ox = PADDING - minX;
  const oy = PADDING - minY;
  const viewW = maxX - minX + PADDING * 2;
  const viewH = maxY - minY + PADDING * 2;

  const defs: string[] = [];
  const buildConnPaths = (list: ConnectionData[]): string[] => list.map(c => {
    const fromNode = nodes.find(n => n.id === c.fromId);
    const toNode = nodes.find(n => n.id === c.toId);
    if (!fromNode || !toNode) return "";
    const color = c.color ?? gs.arrowColor;
    const thick = c.lineThickness ?? gs.lineThickness;
    const arrowSz = c.arrowSize ?? gs.arrowSize;
    const fp = getPortPos(fromNode, c.fromSide, fromNode.borderThickness ?? gs.boxBorderThickness);
    const tp = getPortPos(toNode, c.toSide, toNode.borderThickness ?? gs.boxBorderThickness);
    const bends = c.bends?.map(b => ({ x: b.x + ox, y: b.y + oy }));
    const d = buildCurvedPath(fp.x + ox, fp.y + oy, c.fromSide, tp.x + ox, tp.y + oy, c.toSide, bends);
    const aw = 8 * arrowSz, ah = 6 * arrowSz;
    if (c.arrowEnd)
      defs.push(`<marker id="ae${c.id}" markerWidth="${aw}" markerHeight="${ah}" refX="${aw}" refY="${ah / 2}" orient="auto" markerUnits="userSpaceOnUse"><polygon points="0 0, ${aw} ${ah / 2}, 0 ${ah}" fill="${color}" /></marker>`);
    if (c.arrowStart)
      defs.push(`<marker id="as${c.id}" markerWidth="${aw}" markerHeight="${ah}" refX="0" refY="${ah / 2}" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><polygon points="0 0, ${aw} ${ah / 2}, 0 ${ah}" fill="${color}" /></marker>`);
    return `<path d="${d}" stroke="${color}" stroke-width="${thick}" fill="none"${c.arrowEnd ? ` marker-end="url(#ae${c.id})"` : ""}${c.arrowStart ? ` marker-start="url(#as${c.id})"` : ""} />`;
  }).filter(Boolean);

  // Respect behindNodes per-connection and synapsesAboveNodes global setting
  const isBehind = (c: ConnectionData) => c.behindNodes ?? !(gs.synapsesAboveNodes ?? true);
  const behindPaths = buildConnPaths(connections.filter(c => isBehind(c)));
  const frontPaths = buildConnPaths(connections.filter(c => !isBehind(c)));

  const nodeEls: string[] = [];
  for (const n of nodes) {
    const bg = n.bg ?? gs.boxBg;
    const bc = n.borderColor ?? gs.boxBorderColor;
    const bt = n.borderThickness ?? gs.boxBorderThickness;
    const br = n.borderRadius ?? gs.boxBorderRadius;
    const tc = n.titleColor ?? gs.boxTitleColor;
    const xc = n.textColor ?? gs.boxTextColor;
    const tfs = n.titleFontSize ?? gs.titleFontSize ?? 12;
    const PAD_SVG = 12;
    const baseXfs = n.textFontSize ?? gs.textFontSize ?? 14;
    const xfs = (n.textFill && n.text)
      ? Math.min(500, Math.max(6, Math.sqrt(
          ((n.width - 2 * PAD_SVG) * (n.height - 2 * PAD_SVG)) / (plainText(n.text).length * 0.72)
        )))
      : baseXfs;
    const ta = n.titleAlign ?? gs.titleAlign ?? "left";
    const xa = n.textAlign ?? gs.textAlign ?? "center";
    const ff = escXml(resolveFont(gs.textFont ?? "sans-serif"));
    const tf = escXml(resolveFont(gs.titleFont ?? "sans-serif"));
    const x = n.x + ox, y = n.y + oy;

    // Clip at the node boundary (matches HTML overflow:hidden behaviour).
    const PAD = 12;
    const clipId = `nc${n.id}`;
    defs.push(`<clipPath id="${clipId}"><rect x="${x}" y="${y}" width="${n.width}" height="${n.height}" rx="${br}" ry="${br}" /></clipPath>`);

    nodeEls.push(`<rect x="${x}" y="${y}" width="${n.width}" height="${n.height}" fill="${bg}" stroke="${bc}" stroke-width="${bt}" rx="${br}" ry="${br}" />`);

    if (n.title) {
      const tx = ta === "center" ? x + n.width / 2 : ta === "right" ? x + n.width - 4 : x + 4;
      const anchor = ta === "center" ? "middle" : ta === "right" ? "end" : "start";
      const titleStyle = n.titleStyle ?? "bold";
      const tfw = titleStyle === "bold" ? "bold" : "normal";
      const tfsty = titleStyle === "italic" ? " font-style=\"italic\"" : "";
      nodeEls.push(`<text x="${tx}" y="${y - 6}" font-family="${tf}" font-size="${tfs}" font-weight="${tfw}"${tfsty} fill="${tc}" text-anchor="${anchor}">${escXml(plainText(n.title))}</text>`);
    }

    if (n.text) {
      // Word-wrap: SVG has no native wrapping, so break long lines manually.
      // Estimate average char width as 0.55 × fontSize (reasonable for sans-serif).
      const wrapW = Math.max(1, n.width - 2 * PAD);
      const avgCW = xfs * 0.55;
      const lines: string[] = [];
      for (const para of plainText(n.text).split("\n")) {
        if (!para) { lines.push(""); continue; }
        const words = para.split(/\s+/);
        let cur = "", curW = 0;
        for (const word of words) {
          const ww = word.length * avgCW;
          if (curW > 0 && curW + avgCW + ww > wrapW) {
            lines.push(cur); cur = word; curW = ww;
          } else {
            if (curW > 0) { cur += " "; curW += avgCW; }
            cur += word; curW += ww;
          }
        }
        if (cur) lines.push(cur);
      }

      const xx = xa === "left" ? x + PAD : xa === "right" ? x + n.width - PAD : x + n.width / 2;
      const anchor = xa === "left" ? "start" : xa === "right" ? "end" : "middle";
      const lh = xfs * 1.5;
      // Alphabetic baseline of the first line that centres the block vertically.
      // 0.35*xfs converts from em-box centre to alphabetic baseline (approx. for sans-serif).
      const startY = (y + n.height / 2) + 0.35 * xfs - (lines.length - 1) * lh / 2;
      const tspans = lines.map((line, i) =>
        `<tspan x="${xx}" dy="${i === 0 ? 0 : lh}">${escXml(line || " ")}</tspan>`
      ).join("");
      const xfw = n.textStyle === "bold" ? " font-weight=\"bold\"" : "";
      const xfsty = n.textStyle === "italic" ? " font-style=\"italic\"" : "";
      nodeEls.push(`<text x="${xx}" y="${startY}" font-family="${ff}" font-size="${xfs}"${xfw}${xfsty} fill="${xc}" text-anchor="${anchor}" clip-path="url(#${clipId})">${tspans}</text>`);
    }
  }

  const imageEls: string[] = images.map(im => {
    const inner = im.svg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
    const nw = im.naturalWidth || im.width;
    const nh = im.naturalHeight || im.height;
    return `<svg x="${im.x + ox}" y="${im.y + oy}" width="${im.width}" height="${im.height}" viewBox="0 0 ${nw} ${nh}">${inner}</svg>`;
  });

  const defsStr = defs.length > 0 ? `<defs>${defs.join("")}</defs>` : "";
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${viewW}" height="${viewH}" viewBox="0 0 ${viewW} ${viewH}"><rect width="${viewW}" height="${viewH}" fill="${gs.canvasBg}" />${defsStr}${behindPaths.join("")}${imageEls.join("")}${nodeEls.join("")}${frontPaths.join("")}</svg>`;
}

const HINTS: Record<Tool, string> = {
  select: "Click or drag to select · Drag selection to move · Delete to remove · S = Select · N = Node · X = Synapse",
  box:    "Click to place a node · Click & drag to size it · S = Select · N = Node · X = Synapse",
  arrow:  "Drag from a blue port to another node · Dbl-click synapse to add bend · S = Select · N = Node · X = Synapse",
};

type HistSnap = { nodes: NodeData[]; connections: ConnectionData[]; images: ImageNodeData[]; globalSettings: GlobalSettings };

export default function NoadCanvas() {
  const nodeCounter = useRef(0);
  const connCounter = useRef(0);
  const imageCounter = useRef(0);

  const [tool, setToolState] = useState<Tool>("select");
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [connections, setConnections] = useState<ConnectionData[]>([]);
  const [images, setImages] = useState<ImageNodeData[]>([]);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<number>>(new Set());
  const [selectedConnIds, setSelectedConnIds] = useState<Set<number>>(new Set());
  const [selectedImageIds, setSelectedImageIds] = useState<Set<number>>(new Set());
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [globalSidebarOpen, setGlobalSidebarOpen] = useState(false);
  const [topMenuOpen, setTopMenuOpen] = useState(false);
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveFileName, setSaveFileName] = useState("canvas-state");
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  const [loadFile, setLoadFile] = useState<File | null>(null);
  const [loadError, setLoadError] = useState("");
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportFileName, setExportFileName] = useState("export");
  const [exportMode, setExportMode] = useState<"all" | "selected">("all");
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>(DEFAULT_GLOBAL);
  const [isLoaded, setIsLoaded] = useState(false);
  // ── Undo history ─────────────────────────────────────────────────────────

  const captureSnapshot = useCallback((): HistSnap => ({
    nodes: nodesRef.current.map(n => ({ ...n })),
    connections: connectionsRef.current.map(c => ({
      ...c,
      bends: c.bends?.map(b => ({ ...b })),
    })),
    images: imagesRef.current.map(i => ({ ...i })),
    globalSettings: { ...globalSettingsRef.current },
  }), []);

  const pushHistory = useCallback(() => {
    historyRef.current.push(captureSnapshot());
    if (historyRef.current.length > 50) historyRef.current.shift();
  }, [captureSnapshot]);

  const undo = useCallback(() => {
    const snap = historyRef.current.pop();
    if (!snap) return;
    setNodes(snap.nodes);
    setConnections(snap.connections);
    setImages(snap.images);
    setGlobalSettings(snap.globalSettings);
    setSelectedNodeIds(new Set());
    setSelectedConnIds(new Set());
    setSelectedImageIds(new Set());
    setEditingId(null);
  }, []);

  // ── Global settings ───────────────────────────────────────────────────────

  const onUpdateGlobal = (updates: Partial<GlobalSettings>) => {
    pushHistory();
    const changingThickness = updates.boxBorderThickness !== undefined;
    const thicknessDelta = changingThickness
      ? updates.boxBorderThickness! - globalSettings.boxBorderThickness
      : 0;

    const hasNodeUpdate = changingThickness ||
      "boxBg" in updates || "boxBorderColor" in updates || "boxBorderRadius" in updates ||
      "boxTitleColor" in updates || "titleFontSize" in updates || "titleAlign" in updates ||
      "boxTextColor" in updates || "textFontSize" in updates || "textAlign" in updates;

    const hasConnUpdate =
      "arrowColor" in updates || "lineThickness" in updates ||
      "arrowSize" in updates || "synapsesAboveNodes" in updates;

    if (hasNodeUpdate) {
      setNodes(prev => prev.map(n => {
        const u: Partial<NodeData> = {};
        if ("boxBg" in updates)            u.bg = undefined;
        if ("boxBorderColor" in updates)   u.borderColor = undefined;
        if ("boxBorderRadius" in updates)  u.borderRadius = undefined;
        if ("boxTitleColor" in updates)    u.titleColor = undefined;
        if ("titleFontSize" in updates)    u.titleFontSize = undefined;
        if ("titleAlign" in updates)       u.titleAlign = undefined;
        if ("boxTextColor" in updates)     u.textColor = undefined;
        if ("textFontSize" in updates)     u.textFontSize = undefined;
        if ("textAlign" in updates)        u.textAlign = undefined;
        if (changingThickness) {
          u.borderThickness = undefined;
          if (n.borderThickness === undefined && thicknessDelta !== 0) {
            u.x = n.x - thicknessDelta;
            u.y = n.y - thicknessDelta;
          }
        }
        return { ...n, ...u };
      }));
    }

    if (hasConnUpdate) {
      setConnections(prev => prev.map(c => {
        const u: Partial<ConnectionData> = {};
        if ("arrowColor" in updates)         u.color = undefined;
        if ("lineThickness" in updates)      u.lineThickness = undefined;
        if ("arrowSize" in updates)          u.arrowSize = undefined;
        if ("synapsesAboveNodes" in updates) u.behindNodes = undefined;
        return { ...c, ...u };
      }));
    }

    setGlobalSettings(prev => ({ ...prev, ...updates }));
  };
  const [drawingLineState, setDrawingLineState] = useState<{
    x1: number; y1: number; x2: number; y2: number; fromSide: Side;
  } | null>(null);
  // Marquee selection rect shown while drag-selecting
  const [selectionRect, setSelectionRect] = useState<{
    x: number; y: number; w: number; h: number;
  } | null>(null);
  // Ref mirror so onMouseUp can read the latest rect without a stale closure.
  const selectionRectRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  // Multi-drag: records start-mouse world pos + each selected node's original position.
  const dragging = useRef<{
    startMx: number;
    startMy: number;
    nodePositions: Map<number, { x: number; y: number }>;
    // Set when drag also includes selected images (mixed multi-drag).
    imagePositions?: Map<number, { x: number; y: number }>;
    // Set when drag was initiated from a connection — keeps its bends in sync.
    connBends?: Map<number, { x: number; y: number }[]>;
    snapshot: HistSnap;
    moved: boolean;
  } | null>(null);
  const resizing = useRef<{
    kind: "node" | "image"; id: number; corner: Corner;
    startMouseX: number; startMouseY: number;
    startX: number; startY: number; startW: number; startH: number;
    snapshot: HistSnap;
    moved: boolean;
  } | null>(null);
  const edgeResizing = useRef<{
    kind: "node" | "image"; id: number; edge: Side;
    startMouseX: number; startMouseY: number;
    startX: number; startY: number; startW: number; startH: number;
    snapshot: HistSnap;
    moved: boolean;
  } | null>(null);
  const boxDrawing   = useRef<{ id: number; startX: number; startY: number } | null>(null);
  const connStart    = useRef<{ id: number; side: Side } | null>(null);
  const drawingLine  = useRef<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const panning      = useRef<{ startX: number; startY: number; startPanX: number; startPanY: number } | null>(null);
  const bendDragging = useRef<{ connId: number; index: number; snapshot?: HistSnap; moved: boolean } | null>(null);
  const selectionDrag = useRef<{ startX: number; startY: number } | null>(null);

  const canvasRef    = useRef<HTMLDivElement>(null);
  const arrowKeys    = useRef<Set<string>>(new Set());
  const arrowAnimRef = useRef<number | null>(null);
  const shiftHeld    = useRef(false);
  const clipboardRef = useRef<{ nodes: NodeData[]; connections: ConnectionData[]; images: ImageNodeData[] } | null>(null);
  const cursorWorldRef = useRef({ x: 0, y: 0 });
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadFileInputRef = useRef<HTMLInputElement>(null);
  const lastEscapeRef = useRef<number>(0);
  const historyRef = useRef<HistSnap[]>([]);
  const titleEditPushedRef = useRef<number | null>(null);

  const zoomRef = useRef(1);
  zoomRef.current = zoom;
  const panRef = useRef({ x: 0, y: 0 });
  panRef.current = pan;
  // Keep mutable snapshots so the global event handlers can read them
  // without being in the useEffect dependency array.
  const nodesRef = useRef<NodeData[]>([]);
  nodesRef.current = nodes;
  const connectionsRef = useRef<ConnectionData[]>([]);
  connectionsRef.current = connections;
  const imagesRef = useRef<ImageNodeData[]>([]);
  imagesRef.current = images;
  const globalSettingsRef = useRef<GlobalSettings>(globalSettings);
  globalSettingsRef.current = globalSettings;
  const selectedNodeIdsRef = useRef<Set<number>>(new Set());
  selectedNodeIdsRef.current = selectedNodeIds;
  const selectedConnIdsRef = useRef<Set<number>>(new Set());
  selectedConnIdsRef.current = selectedConnIds;
  const selectedImageIdsRef = useRef<Set<number>>(new Set());
  selectedImageIdsRef.current = selectedImageIds;

  // ── Tool ──────────────────────────────────────────────────────────────────

  const setTool = (t: Tool) => {
    setToolState(t);
    setSelectedNodeIds(new Set());
    setSelectedConnIds(new Set());
    setSelectedImageIds(new Set());
    setEditingId(null);
  };

  // ── Zoom (scroll wheel) ───────────────────────────────────────────────────

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest("[data-noad-panel]")) return;
      e.preventDefault();
      const speed = globalSettingsRef.current.zoomSpeed ?? 1.12;
      const factor   = e.deltaY < 0 ? speed : 1 / speed;
      const prevZoom = zoomRef.current;
      const prevPan  = panRef.current;
      // No practical floor on zoom-out — scrolling out keeps shrinking the canvas
      // indefinitely (down to a hair above 0) until content is imperceptibly small.
      const newZoom  = Math.min(4, Math.max(0.0001, prevZoom * factor));
      const newPan   = {
        x: e.clientX - (e.clientX - prevPan.x) * (newZoom / prevZoom),
        y: e.clientY - (e.clientY - prevPan.y) * (newZoom / prevZoom),
      };
      zoomRef.current = newZoom;
      panRef.current  = newPan;
      setZoom(newZoom);
      setPan(newPan);
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  // ── Load saved state ──────────────────────────────────────────────────────

  useEffect(() => {
    fetch("/api/canvas")
      .then(r => r.json())
      .then((data: {
        nodes?: NodeData[]; connections?: ConnectionData[]; images?: ImageNodeData[];
        globalSettings?: GlobalSettings;
        pan?: { x: number; y: number }; zoom?: number;
      } | null) => {
        if (data) {
          if (data.nodes?.length) {
            setNodes(data.nodes);
            nodeCounter.current = Math.max(0, ...data.nodes.map(n => n.id));
          }
          if (data.connections?.length) {
            setConnections(data.connections);
            connCounter.current = Math.max(0, ...data.connections.map(c => c.id));
          }
          if (data.images?.length) {
            setImages(data.images);
            imageCounter.current = Math.max(0, ...data.images.map(i => i.id));
          }
          if (data.globalSettings) setGlobalSettings(data.globalSettings);
          if (data.pan) { setPan(data.pan); panRef.current = data.pan; }
          if (data.zoom !== undefined) { setZoom(data.zoom); zoomRef.current = data.zoom; }
        }
        setIsLoaded(true);
      })
      .catch(() => setIsLoaded(true));
  }, []);

  // ── Auto-save (debounced 500 ms) ──────────────────────────────────────────

  useEffect(() => {
    if (!isLoaded) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      fetch("/api/canvas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodes, connections, images, globalSettings, pan, zoom }),
      }).catch(() => {});
    }, 500);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [nodes, connections, images, globalSettings, pan, zoom, isLoaded]);

  // ── Node text / title ─────────────────────────────────────────────────────

  const updateNodeText  = (id: number, text: string) =>
    setNodes(prev => prev.map(n => n.id === id ? { ...n, text }  : n));
  const updateNodeTitle = (id: number, title: string) => {
    if (titleEditPushedRef.current !== id) {
      pushHistory();
      titleEditPushedRef.current = id;
    }
    setNodes(prev => prev.map(n => n.id === id ? { ...n, title } : n));
  };

  // ── Delete all selected ───────────────────────────────────────────────────

  const deleteSelected = useCallback(() => {
    pushHistory();
    const nodeIds = selectedNodeIdsRef.current;
    const connIds = selectedConnIdsRef.current;
    const imageIds = selectedImageIdsRef.current;
    if (nodeIds.size > 0) {
      setNodes(prev => prev.filter(n => !nodeIds.has(n.id)));
      setConnections(prev => prev.filter(c => !nodeIds.has(c.fromId) && !nodeIds.has(c.toId)));
      setSelectedNodeIds(new Set());
    }
    if (connIds.size > 0) {
      setConnections(prev => prev.filter(c => !connIds.has(c.id)));
      setSelectedConnIds(new Set());
    }
    if (imageIds.size > 0) {
      setImages(prev => prev.filter(i => !imageIds.has(i.id)));
      setSelectedImageIds(new Set());
    }
  }, [pushHistory]);

  const copySelected = useCallback(() => {
    const nodeIds = selectedNodeIdsRef.current;
    const connIds = selectedConnIdsRef.current;
    const imageIds = selectedImageIdsRef.current;
    if (nodeIds.size === 0 && connIds.size === 0 && imageIds.size === 0) return;
    clipboardRef.current = {
      nodes: nodesRef.current.filter(n => nodeIds.has(n.id)),
      connections: connectionsRef.current.filter(c =>
        (nodeIds.has(c.fromId) && nodeIds.has(c.toId)) || connIds.has(c.id)
      ),
      images: imagesRef.current.filter(i => imageIds.has(i.id)),
    };
  }, []);

  const pasteClipboard = useCallback(() => {
    const cb = clipboardRef.current;
    if (!cb || (cb.nodes.length === 0 && cb.connections.length === 0 && cb.images.length === 0)) return;
    pushHistory();

    // Paste is centered on the current cursor position: find the bounding-box
    // center of the copied content, then shift everything so that center lands
    // under the cursor's current world position.
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of cb.nodes) {
      minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.width); maxY = Math.max(maxY, n.y + n.height);
    }
    for (const im of cb.images) {
      minX = Math.min(minX, im.x); minY = Math.min(minY, im.y);
      maxX = Math.max(maxX, im.x + im.width); maxY = Math.max(maxY, im.y + im.height);
    }
    const centerX = isFinite(minX) ? (minX + maxX) / 2 : cursorWorldRef.current.x;
    const centerY = isFinite(minY) ? (minY + maxY) / 2 : cursorWorldRef.current.y;
    const dx = cursorWorldRef.current.x - centerX;
    const dy = cursorWorldRef.current.y - centerY;

    const idMap = new Map<number, number>();
    const newNodes: NodeData[] = cb.nodes.map(n => {
      const newId = ++nodeCounter.current;
      idMap.set(n.id, newId);
      return { ...n, id: newId, x: n.x + dx, y: n.y + dy };
    });
    const newConns: ConnectionData[] = cb.connections
      .filter(c => idMap.has(c.fromId) && idMap.has(c.toId))
      .map(c => ({
        ...c,
        id: ++connCounter.current,
        fromId: idMap.get(c.fromId)!,
        toId: idMap.get(c.toId)!,
        bends: c.bends?.map(b => ({ x: b.x + dx, y: b.y + dy })),
      }));
    const newImages: ImageNodeData[] = cb.images.map(i => ({
      ...i, id: ++imageCounter.current, x: i.x + dx, y: i.y + dy,
    }));
    setNodes(prev => [...prev, ...newNodes]);
    setConnections(prev => [...prev, ...newConns]);
    setImages(prev => [...prev, ...newImages]);
    setSelectedNodeIds(new Set(newNodes.map(n => n.id)));
    setSelectedConnIds(new Set(newConns.map(c => c.id)));
    setSelectedImageIds(new Set(newImages.map(i => i.id)));
  }, [pushHistory]);

  // ── Copy / Paste ──────────────────────────────────────────────────────────
  // Use the browser's copy/paste events rather than keydown — Firefox intercepts
  // Ctrl+C and Ctrl+P at the browser-chrome level before keydown reaches the page.
  useEffect(() => {
    const onCopy = (e: ClipboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const inTextField = tag === "TEXTAREA" || tag === "INPUT" ||
        (e.target as HTMLElement)?.isContentEditable;
      if (inTextField) return;
      if (selectedNodeIdsRef.current.size === 0 && selectedConnIdsRef.current.size === 0 && selectedImageIdsRef.current.size === 0) return;
      e.preventDefault();
      copySelected();
    };

    // paste event fires for Ctrl+V; also handle Ctrl+P via keydown as a supplement
    const onPaste = (e: ClipboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const inTextField = tag === "TEXTAREA" || tag === "INPUT" ||
        (e.target as HTMLElement)?.isContentEditable;
      if (inTextField) return;
      if (!clipboardRef.current) return;
      e.preventDefault();
      pasteClipboard();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.code === "KeyP") {
        e.preventDefault();
        pasteClipboard();
      }
    };

    document.addEventListener("copy", onCopy);
    document.addEventListener("paste", onPaste);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("paste", onPaste);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [copySelected, pasteClipboard]);

  const clearCanvas = useCallback(() => {
    setNodes([]);
    setConnections([]);
    setImages([]);
    setSelectedNodeIds(new Set());
    setSelectedConnIds(new Set());
    setSelectedImageIds(new Set());
    nodeCounter.current = 0;
    connCounter.current = 0;
    imageCounter.current = 0;
    setSaveFileName("Untitled");
    setTopMenuOpen(false);
    setHelpModalOpen(true);
  }, []);

  const handleSave = async () => {
    const data = { nodes, connections, images, globalSettings, pan, zoom };
    const json = JSON.stringify(data, null, 2);
    const fileName = `${saveFileName || "canvas-state"}.json`;

    if ("showSaveFilePicker" in window) {
      try {
        const fileHandle = await (window as Window & { showSaveFilePicker: (opts: object) => Promise<FileSystemFileHandle> }).showSaveFilePicker({
          suggestedName: fileName,
          types: [{ description: "JSON file", accept: { "application/json": [".json"] } }],
        });
        const writable = await fileHandle.createWritable();
        await writable.write(json);
        await writable.close();
        setSaveModalOpen(false);
      } catch (err) {
        if ((err as { name?: string }).name !== "AbortError") throw err;
        // User cancelled — leave modal open
      }
    } else {
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSaveModalOpen(false);
    }
  };

  const handleLoad = async () => {
    if (!loadFile) return;
    try {
      const text = await loadFile.text();
      const data = JSON.parse(text) as {
        nodes?: NodeData[];
        connections?: ConnectionData[];
        images?: ImageNodeData[];
        globalSettings?: GlobalSettings;
        pan?: { x: number; y: number };
        zoom?: number;
      };
      const newNodes = data.nodes ?? [];
      const newConns = data.connections ?? [];
      const newImages = data.images ?? [];
      setNodes(newNodes);
      setConnections(newConns);
      setImages(newImages);
      nodeCounter.current = newNodes.length ? Math.max(...newNodes.map(n => n.id)) : 0;
      connCounter.current = newConns.length ? Math.max(...newConns.map(c => c.id)) : 0;
      imageCounter.current = newImages.length ? Math.max(...newImages.map(i => i.id)) : 0;
      if (data.globalSettings) setGlobalSettings(data.globalSettings);
      if (data.pan) { setPan(data.pan); panRef.current = data.pan; }
      if (data.zoom !== undefined) { setZoom(data.zoom); zoomRef.current = data.zoom; }
      setSaveFileName(loadFile.name.replace(/\.json$/i, ""));
      setSelectedNodeIds(new Set());
      setSelectedConnIds(new Set());
      setSelectedImageIds(new Set());
      setEditingId(null);
      setLoadModalOpen(false);
      setLoadFile(null);
      setLoadError("");
    } catch {
      setLoadError("Could not parse file. Make sure it's a valid canvas JSON.");
    }
  };

  const handleExport = () => {
    const exportNodes = exportMode === "selected" ? nodes.filter(n => selectedNodeIds.has(n.id)) : nodes;
    const exportConns = exportMode === "selected" ? connections.filter(c => selectedConnIds.has(c.id)) : connections;
    const exportImages = exportMode === "selected" ? images.filter(i => selectedImageIds.has(i.id)) : images;
    if (exportNodes.length === 0 && exportConns.length === 0 && exportImages.length === 0) return;
    const svg = buildExportSVG(exportNodes, exportConns, exportImages, globalSettings);
    const fname = exportFileName.trim() || "export";
    const canvasBg = globalSettings.canvasBg ?? "#f5f4f0";
    // Collect the actual Google Font family names needed so the print window
    // can load them (CSS font variables don't work outside the Next.js app).
    const GFONT_MAP: Record<string, string> = {
      "var(--font-inter)": "Inter:wght@400;700",
      "var(--font-lato)": "Lato:wght@400;700",
      "var(--font-poppins)": "Poppins:wght@400;600;700",
      "var(--font-roboto)": "Roboto:wght@400;700",
      "var(--font-merriweather)": "Merriweather:wght@400;700",
      "var(--font-playfair)": "Playfair+Display:wght@400;700",
      "var(--font-source-code)": "Source+Code+Pro:wght@400;700",
      "var(--font-dm-sans)": "DM+Sans:wght@400;700",
      "var(--font-raleway)": "Raleway:wght@400;700",
      "var(--font-nunito)": "Nunito:wght@400;700",
    };
    const usedFontKeys = new Set([
      (globalSettings.textFont ?? "").trim(),
      (globalSettings.titleFont ?? "").trim(),
    ]);
    const gFontFamilies = Array.from(usedFontKeys)
      .map(k => GFONT_MAP[k])
      .filter(Boolean) as string[];
    const gFontsLink = gFontFamilies.length
      ? `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?${gFontFamilies.map(f => `family=${f}`).join("&")}&display=swap">`
      : "";
    const pw = window.open("", "_blank", "width=1200,height=900");
    if (!pw) return;
    // SVG is displayed at its natural 1:1 pixel size so nodes and text appear
    // at their true world-space dimensions (readable, correct proportions).
    // In the print dialog the user can choose "fit to page" to scale to paper.
    pw.document.write(`<!DOCTYPE html><html><head><title>${fname}</title>${gFontsLink}<style>*{margin:0;padding:0;box-sizing:border-box}html,body{background:${canvasBg};-webkit-print-color-adjust:exact;print-color-adjust:exact}body::before{content:"";position:fixed;inset:0;z-index:-1;background:${canvasBg};-webkit-print-color-adjust:exact;print-color-adjust:exact}svg{display:block}@media print{@page{margin:0;size:auto}body::before{content:"";position:fixed;inset:0;background:${canvasBg};-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>${svg}<script>window.onload=function(){setTimeout(function(){window.print()},400)}<\/script></body></html>`);
    pw.document.close();
    setExportModalOpen(false);
  };

  const handleInsertImage = (result: { svg: string; naturalWidth: number; naturalHeight: number }) => {
    pushHistory();
    const MAX_DIM = 400;
    const ratio = result.naturalWidth && result.naturalHeight ? result.naturalWidth / result.naturalHeight : 1;
    let width = result.naturalWidth || MAX_DIM;
    let height = result.naturalHeight || MAX_DIM;
    if (width > MAX_DIM || height > MAX_DIM) {
      if (ratio >= 1) { width = MAX_DIM; height = MAX_DIM / ratio; }
      else { height = MAX_DIM; width = MAX_DIM * ratio; }
    }
    const centerX = (window.innerWidth / 2 - panRef.current.x) / zoomRef.current;
    const centerY = (window.innerHeight / 2 - panRef.current.y) / zoomRef.current;
    const id = ++imageCounter.current;
    const newImage: ImageNodeData = {
      id, x: centerX - width / 2, y: centerY - height / 2, width, height,
      svg: result.svg, naturalWidth: result.naturalWidth, naturalHeight: result.naturalHeight,
    };
    setImages(prev => [...prev, newImage]);
    setSelectedImageIds(new Set([id]));
    setSelectedNodeIds(new Set());
    setSelectedConnIds(new Set());
  };

  // ── Sidebar ───────────────────────────────────────────────────────────────

  const onUpdateNode = (id: number, updates: Partial<NodeData>) => {
    if (!("text" in updates) && !("title" in updates)) pushHistory();
    setNodes(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n));
  };

  const onUpdateConn = (id: number, updates: Partial<ConnectionData>) => {
    pushHistory();
    setConnections(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const onUpdateImage = (id: number, updates: Partial<ImageNodeData>) => {
    pushHistory();
    setImages(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
  };

  const onUpdateAllImages = useCallback((updates: Partial<ImageNodeData>) => {
    pushHistory();
    const ids = selectedImageIdsRef.current;
    setImages(prev => prev.map(i => ids.has(i.id) ? { ...i, ...updates } : i));
  }, [pushHistory]);

  const onSendImageToFront = useCallback((id: number) => {
    pushHistory();
    setImages(prev => {
      const img = prev.find(i => i.id === id);
      if (!img) return prev;
      return [...prev.filter(i => i.id !== id), img];
    });
  }, [pushHistory]);

  const onSendImageToBack = useCallback((id: number) => {
    pushHistory();
    setImages(prev => {
      const img = prev.find(i => i.id === id);
      if (!img) return prev;
      return [img, ...prev.filter(i => i.id !== id)];
    });
  }, [pushHistory]);

  const onUpdateAllNodes = useCallback((updates: Partial<NodeData>) => {
    pushHistory();
    const ids = selectedNodeIdsRef.current;
    setNodes(prev => prev.map(n => ids.has(n.id) ? { ...n, ...updates } : n));
  }, [pushHistory]);

  const onUpdateAllConns = useCallback((updates: Partial<ConnectionData>) => {
    pushHistory();
    const ids = selectedConnIdsRef.current;
    setConnections(prev => prev.map(c => ids.has(c.id) ? { ...c, ...updates } : c));
  }, [pushHistory]);

  const onSendToFront = useCallback((id: number) => {
    pushHistory();
    setNodes(prev => {
      const node = prev.find(n => n.id === id);
      if (!node) return prev;
      return [...prev.filter(n => n.id !== id), node];
    });
  }, [pushHistory]);

  const onSendToBack = useCallback((id: number) => {
    pushHistory();
    setNodes(prev => {
      const node = prev.find(n => n.id === id);
      if (!node) return prev;
      return [node, ...prev.filter(n => n.id !== id)];
    });
  }, [pushHistory]);


  // ── Mouse handlers ────────────────────────────────────────────────────────

  const onRootMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault();
      panning.current = { startX: e.clientX, startY: e.clientY, startPanX: pan.x, startPanY: pan.y };
      setIsPanning(true);
      return;
    }
    // Left-click directly on the root div — happens when pan shifts the canvas div
    // out of view for part of the viewport (e.g. viewing negative canvas coordinates).
    if (e.button === 0 && e.target === e.currentTarget) {
      const mx = (e.clientX - panRef.current.x) / zoomRef.current;
      const my = (e.clientY - panRef.current.y) / zoomRef.current;
      if (tool === "box") {
        e.preventDefault();
        pushHistory();
        const id = ++nodeCounter.current;
        setNodes(prev => [...prev, { id, x: mx, y: my, width: 0, height: 0, title: "", text: "" }]);
        setSelectedNodeIds(new Set([id]));
        setSelectedConnIds(new Set());
        setSelectedImageIds(new Set());
        boxDrawing.current = { id, startX: mx, startY: my };
      } else if (tool === "arrow") {
        setTool("select");
      } else if (tool === "select") {
        setSelectedNodeIds(new Set());
        setSelectedConnIds(new Set());
        setSelectedImageIds(new Set());
        selectionDrag.current = { startX: mx, startY: my };
      }
    }
  };

  const onCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || e.target !== canvasRef.current) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / zoom;
    const my = (e.clientY - rect.top)  / zoom;

    if (tool === "box") {
      e.preventDefault();
      pushHistory();
      const id = ++nodeCounter.current;
      setNodes(prev => [...prev, { id, x: mx, y: my, width: 0, height: 0, title: "", text: "" }]);
      setSelectedNodeIds(new Set([id]));
      setSelectedConnIds(new Set());
      setSelectedImageIds(new Set());
      boxDrawing.current = { id, startX: mx, startY: my };
    } else if (tool === "arrow") {
      setTool("select");
    } else if (tool === "select") {
      // Clear selection and start marquee drag
      setSelectedNodeIds(new Set());
      setSelectedConnIds(new Set());
      setSelectedImageIds(new Set());
      selectionDrag.current = { startX: mx, startY: my };
    }
  };

  const onCanvasDoubleClick = (_e: React.MouseEvent) => {
    setSidebarOpen(false);
    setGlobalSidebarOpen(false);
    setTopMenuOpen(false);
  };

  const onNodeMouseDown = (e: React.MouseEvent, id: number) => {
    if ((e.target as HTMLElement).dataset.port)   return;
    if ((e.target as HTMLElement).dataset.resize) return;
    if (editingId === id) return;
    e.preventDefault();
    setEditingId(null);

    const rect = canvasRef.current!.getBoundingClientRect();
    const startMx = (e.clientX - rect.left) / zoom;
    const startMy = (e.clientY - rect.top)  / zoom;

    const alreadySelected = selectedNodeIdsRef.current.has(id);
    const ctrl = e.ctrlKey || e.metaKey;

    let dragIds: Set<number>;
    let dragImageIds: Set<number>;

    if (ctrl) {
      // Ctrl/Cmd+click: toggle this node in the multi-selection
      const newSel = new Set(selectedNodeIdsRef.current);
      if (alreadySelected) {
        newSel.delete(id);
        setSelectedNodeIds(newSel);
        setSelectedConnIds(new Set());
        return; // Deselect only — no drag
      }
      newSel.add(id);
      setSelectedNodeIds(newSel);
      setSelectedConnIds(new Set());
      dragIds = newSel;
      dragImageIds = selectedImageIdsRef.current;
    } else {
      // Regular click: select only this node (or drag the existing multi-selection)
      dragIds = alreadySelected ? selectedNodeIdsRef.current : new Set([id]);
      dragImageIds = alreadySelected ? selectedImageIdsRef.current : new Set();
      if (!alreadySelected) {
        setSelectedNodeIds(new Set([id]));
        setSelectedConnIds(new Set());
        setSelectedImageIds(new Set());
      }
    }

    const nodePositions = new Map<number, { x: number; y: number }>();
    nodesRef.current.filter(n => dragIds.has(n.id))
      .forEach(n => nodePositions.set(n.id, { x: n.x, y: n.y }));

    const imagePositions = new Map<number, { x: number; y: number }>();
    imagesRef.current.filter(im => dragImageIds.has(im.id))
      .forEach(im => imagePositions.set(im.id, { x: im.x, y: im.y }));

    // Move bend circles of connections whose both endpoints are in the drag set.
    const connBends = new Map<number, { x: number; y: number }[]>();
    connectionsRef.current.forEach(c => {
      if (dragIds.has(c.fromId) && dragIds.has(c.toId) && c.bends && c.bends.length > 0) {
        connBends.set(c.id, c.bends.map(b => ({ ...b })));
      }
    });

    dragging.current = { startMx, startMy, nodePositions, imagePositions, connBends, snapshot: captureSnapshot(), moved: false };
  };

  const onImageMouseDown = (e: React.MouseEvent, id: number) => {
    if ((e.target as HTMLElement).dataset.resize) return;
    e.preventDefault();
    setEditingId(null);

    const rect = canvasRef.current!.getBoundingClientRect();
    const startMx = (e.clientX - rect.left) / zoom;
    const startMy = (e.clientY - rect.top)  / zoom;

    const alreadySelected = selectedImageIdsRef.current.has(id);
    const ctrl = e.ctrlKey || e.metaKey;

    let dragImageIds: Set<number>;
    let dragNodeIds: Set<number>;

    if (ctrl) {
      const newSel = new Set(selectedImageIdsRef.current);
      if (alreadySelected) {
        newSel.delete(id);
        setSelectedImageIds(newSel);
        setSelectedConnIds(new Set());
        return; // Deselect only — no drag
      }
      newSel.add(id);
      setSelectedImageIds(newSel);
      setSelectedConnIds(new Set());
      dragImageIds = newSel;
      dragNodeIds = selectedNodeIdsRef.current;
    } else {
      dragImageIds = alreadySelected ? selectedImageIdsRef.current : new Set([id]);
      dragNodeIds = alreadySelected ? selectedNodeIdsRef.current : new Set();
      if (!alreadySelected) {
        setSelectedImageIds(new Set([id]));
        setSelectedConnIds(new Set());
        setSelectedNodeIds(new Set());
      }
    }

    const nodePositions = new Map<number, { x: number; y: number }>();
    nodesRef.current.filter(n => dragNodeIds.has(n.id))
      .forEach(n => nodePositions.set(n.id, { x: n.x, y: n.y }));

    const imagePositions = new Map<number, { x: number; y: number }>();
    imagesRef.current.filter(im => dragImageIds.has(im.id))
      .forEach(im => imagePositions.set(im.id, { x: im.x, y: im.y }));

    const connBends = new Map<number, { x: number; y: number }[]>();
    connectionsRef.current.forEach(c => {
      if (dragNodeIds.has(c.fromId) && dragNodeIds.has(c.toId) && c.bends && c.bends.length > 0) {
        connBends.set(c.id, c.bends.map(b => ({ ...b })));
      }
    });

    dragging.current = { startMx, startMy, nodePositions, imagePositions, connBends, snapshot: captureSnapshot(), moved: false };
  };

  const onNodeDoubleClick = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    dragging.current = null;
    setSelectedNodeIds(new Set([id]));
    setSelectedConnIds(new Set());
    setSelectedImageIds(new Set());
    pushHistory();
    setEditingId(id);
    if (globalSettingsRef.current.propertiesAutoOpen ?? true) setSidebarOpen(true);
  };

  const onResizeMouseDown = (e: React.MouseEvent, id: number, corner: Corner) => {
    e.preventDefault();
    e.stopPropagation();
    const node = nodes.find(n => n.id === id)!;
    const rect = canvasRef.current!.getBoundingClientRect();
    resizing.current = {
      kind: "node", id, corner,
      startMouseX: (e.clientX - rect.left) / zoom,
      startMouseY: (e.clientY - rect.top)  / zoom,
      startX: node.x, startY: node.y, startW: node.width, startH: node.height,
      snapshot: captureSnapshot(), moved: false,
    };
  };

  const onEdgeResizeMouseDown = (e: React.MouseEvent, id: number, edge: Side) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedNodeIds(new Set([id]));
    setSelectedConnIds(new Set());
    setSelectedImageIds(new Set());
    const node = nodesRef.current.find(n => n.id === id)!;
    const rect = canvasRef.current!.getBoundingClientRect();
    edgeResizing.current = {
      kind: "node", id, edge,
      startMouseX: (e.clientX - rect.left) / zoom,
      startMouseY: (e.clientY - rect.top)  / zoom,
      startX: node.x, startY: node.y, startW: node.width, startH: node.height,
      snapshot: captureSnapshot(), moved: false,
    };
  };

  const onImageResizeMouseDown = (e: React.MouseEvent, id: number, corner: Corner) => {
    e.preventDefault();
    e.stopPropagation();
    const img = imagesRef.current.find(i => i.id === id)!;
    const rect = canvasRef.current!.getBoundingClientRect();
    resizing.current = {
      kind: "image", id, corner,
      startMouseX: (e.clientX - rect.left) / zoom,
      startMouseY: (e.clientY - rect.top)  / zoom,
      startX: img.x, startY: img.y, startW: img.width, startH: img.height,
      snapshot: captureSnapshot(), moved: false,
    };
  };

  const onImageEdgeResizeMouseDown = (e: React.MouseEvent, id: number, edge: Side) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedImageIds(new Set([id]));
    setSelectedConnIds(new Set());
    setSelectedNodeIds(new Set());
    const img = imagesRef.current.find(i => i.id === id)!;
    const rect = canvasRef.current!.getBoundingClientRect();
    edgeResizing.current = {
      kind: "image", id, edge,
      startMouseX: (e.clientX - rect.left) / zoom,
      startMouseY: (e.clientY - rect.top)  / zoom,
      startX: img.x, startY: img.y, startW: img.width, startH: img.height,
      snapshot: captureSnapshot(), moved: false,
    };
  };

  const onPortMouseDown = (e: React.MouseEvent, id: number, side: Side) => {
    e.preventDefault();
    e.stopPropagation();

    // Always start a new connection — a port can be the source of any number of
    // synapses, so dragging from an already-connected port never re-attaches or
    // removes the existing connection(s) there.
    if (tool !== "arrow" && tool !== "box" && tool !== "select") return;
    if (tool === "box") setToolState("arrow");
    connStart.current = { id, side };
    const node = nodesRef.current.find(n => n.id === id)!;
    const pos  = getPortPos(node, side, node.borderThickness ?? globalSettingsRef.current.boxBorderThickness);
    drawingLine.current = { x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y };
    setDrawingLineState({ ...drawingLine.current, fromSide: side });
  };

  const onPortMouseUp = (id: number, side: Side) => {
    if (!connStart.current) return;

    if (connStart.current.id === id) return;
    pushHistory();
    const cid      = ++connCounter.current;
    const fromId   = connStart.current.id;
    const fromSide = connStart.current.side;
    setConnections(prev => [...prev, { id: cid, fromId, fromSide, toId: id, toSide: side }]);
    setSelectedConnIds(new Set([cid]));
    setSelectedNodeIds(new Set());
    setSelectedImageIds(new Set());
    connStart.current = null;
    drawingLine.current = null;
    setDrawingLineState(null);
  };

  const onConnectionMouseDown = (e: React.MouseEvent, connId: number) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedConnIds(new Set([connId]));
    setSelectedNodeIds(new Set());
    setSelectedImageIds(new Set());
    setSidebarOpen(true);
  };

  const onBendMouseDown = (
    e: React.MouseEvent, connId: number,
    bendIndex: number | null, naturalX: number, naturalY: number
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (bendIndex === null) {
      // No existing waypoints — add one at the natural midpoint and start dragging it.
      pushHistory();
      setConnections(prev => prev.map(c =>
        c.id === connId ? { ...c, bends: [{ x: naturalX, y: naturalY }] } : c
      ));
      bendDragging.current = { connId, index: 0, moved: false };
    } else {
      bendDragging.current = { connId, index: bendIndex, snapshot: captureSnapshot(), moved: false };
    }
  };

  const onBendDoubleClick = (e: React.MouseEvent, connId: number, bendIndex: number) => {
    e.stopPropagation();
    bendDragging.current = null;
    pushHistory();
    setConnections(prev => prev.map(c => {
      if (c.id !== connId) return c;
      const newBends = [...(c.bends ?? [])];
      newBends.splice(bendIndex, 1);
      return { ...c, bends: newBends };
    }));
  };

  const onConnectionDoubleClick = (e: React.MouseEvent, connId: number) => {
    e.stopPropagation();
    pushHistory();
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / zoomRef.current;
    const my = (e.clientY - rect.top)  / zoomRef.current;
    setConnections(prev => prev.map(c => {
      if (c.id !== connId) return c;
      const fromNode = nodesRef.current.find(n => n.id === c.fromId);
      const toNode   = nodesRef.current.find(n => n.id === c.toId);
      if (!fromNode || !toNode) return c;
      const a = getPortPos(fromNode, c.fromSide, fromNode.borderThickness ?? globalSettingsRef.current.boxBorderThickness);
      const b = getPortPos(toNode,   c.toSide,   toNode.borderThickness   ?? globalSettingsRef.current.boxBorderThickness);
      return { ...c, bends: insertBendPoint(a.x, a.y, b.x, b.y, c.bends ?? [], { x: mx, y: my }) };
    }));
  };

  // ── Global mouse/keyboard ─────────────────────────────────────────────────

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (panning.current) {
        const { startX, startY, startPanX, startPanY } = panning.current;
        setPan({ x: startPanX + e.clientX - startX, y: startPanY + e.clientY - startY });
        return;
      }
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mx = (e.clientX - rect.left) / zoomRef.current;
      const my = (e.clientY - rect.top)  / zoomRef.current;
      cursorWorldRef.current = { x: mx, y: my };

      if (dragging.current) {
        dragging.current.moved = true;
        const { startMx, startMy, nodePositions, imagePositions, connBends } = dragging.current;
        const dx = mx - startMx;
        const dy = my - startMy;
        setNodes(prev => prev.map(n => {
          const pos = nodePositions.get(n.id);
          return pos ? { ...n, x: pos.x + dx, y: pos.y + dy } : n;
        }));
        if (imagePositions && imagePositions.size > 0) {
          setImages(prev => prev.map(im => {
            const pos = imagePositions.get(im.id);
            return pos ? { ...im, x: pos.x + dx, y: pos.y + dy } : im;
          }));
        }
        if (connBends && connBends.size > 0) {
          setConnections(prev => prev.map(c => {
            const initialBends = connBends.get(c.id);
            if (!initialBends || initialBends.length === 0) return c;
            return { ...c, bends: initialBends.map(b => ({ x: b.x + dx, y: b.y + dy })) };
          }));
        }
      }

      if (resizing.current) {
        resizing.current.moved = true;
        const { kind, id, corner, startMouseX, startMouseY, startX, startY, startW, startH } = resizing.current;
        const dx = mx - startMouseX;
        const dy = my - startMouseY;
        let x = startX, y = startY, width = startW, height = startH;
        if (corner === "br") {
          width = Math.max(80, startW + dx); height = Math.max(40, startH + dy);
        } else if (corner === "bl") {
          width = Math.max(80, startW - dx); x = startX + startW - width;
          height = Math.max(40, startH + dy);
        } else if (corner === "tr") {
          width = Math.max(80, startW + dx);
          height = Math.max(40, startH - dy); y = startY + startH - height;
        } else {
          width = Math.max(80, startW - dx); x = startX + startW - width;
          height = Math.max(40, startH - dy); y = startY + startH - height;
        }
        if (kind === "image") {
          setImages(prev => prev.map(im => im.id === id ? { ...im, x, y, width, height } : im));
        } else {
          setNodes(prev => prev.map(n => n.id === id ? { ...n, x, y, width, height } : n));
        }
      }

      if (edgeResizing.current) {
        edgeResizing.current.moved = true;
        const { kind, id, edge, startMouseX, startMouseY, startX, startY, startW, startH } = edgeResizing.current;
        const dx = mx - startMouseX;
        const dy = my - startMouseY;
        let updates: { x?: number; y?: number; width?: number; height?: number };
        if (edge === "right")       updates = { width: Math.max(80, startW + dx) };
        else if (edge === "left")   { const w = Math.max(80, startW - dx); updates = { x: startX + startW - w, width: w }; }
        else if (edge === "bottom") updates = { height: Math.max(40, startH + dy) };
        else                        { const h = Math.max(40, startH - dy); updates = { y: startY + startH - h, height: h }; }
        if (kind === "image") {
          setImages(prev => prev.map(im => im.id === id ? { ...im, ...updates } : im));
        } else {
          setNodes(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n));
        }
      }

      if (boxDrawing.current) {
        const { id, startX, startY } = boxDrawing.current;
        setNodes(prev => prev.map(n => n.id === id ? {
          ...n,
          x: Math.min(startX, mx), y: Math.min(startY, my),
          width: Math.abs(mx - startX), height: Math.abs(my - startY),
        } : n));
      }

      if (selectionDrag.current) {
        const { startX, startY } = selectionDrag.current;
        const r = {
          x: Math.min(startX, mx), y: Math.min(startY, my),
          w: Math.abs(mx - startX), h: Math.abs(my - startY),
        };
        selectionRectRef.current = r;
        setSelectionRect(r);
      }

      if (bendDragging.current) {
        bendDragging.current.moved = true;
        const { connId, index } = bendDragging.current;
        setConnections(prev => prev.map(c => {
          if (c.id !== connId) return c;
          const newBends = [...(c.bends ?? [])];
          newBends[index] = { x: mx, y: my };
          return { ...c, bends: newBends };
        }));
      }

      if (connStart.current && drawingLine.current) {
        drawingLine.current = { ...drawingLine.current, x2: mx, y2: my };
        setDrawingLineState({ ...drawingLine.current, fromSide: connStart.current.side });
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 1) { panning.current = null; setIsPanning(false); return; }

      // Save before clearing so we can check `moved` and push history
      const savedDragging = dragging.current;
      const savedResizing = resizing.current;
      const savedEdgeResizing = edgeResizing.current;
      const savedBendDragging = bendDragging.current;
      if (savedDragging?.moved && savedDragging.snapshot) {
        historyRef.current.push(savedDragging.snapshot);
        if (historyRef.current.length > 50) historyRef.current.shift();
      }
      if (savedResizing?.moved && savedResizing.snapshot) {
        historyRef.current.push(savedResizing.snapshot);
        if (historyRef.current.length > 50) historyRef.current.shift();
      }
      if (savedEdgeResizing?.moved && savedEdgeResizing.snapshot) {
        historyRef.current.push(savedEdgeResizing.snapshot);
        if (historyRef.current.length > 50) historyRef.current.shift();
      }
      if (savedBendDragging?.moved && savedBendDragging.snapshot) {
        historyRef.current.push(savedBendDragging.snapshot);
        if (historyRef.current.length > 50) historyRef.current.shift();
      }

      dragging.current  = null;
      resizing.current  = null;
      edgeResizing.current = null;
      bendDragging.current = null;

      if (selectionDrag.current) {
        selectionDrag.current = null;
        const rect = selectionRectRef.current;
        selectionRectRef.current = null;
        setSelectionRect(null);
        if (rect) {
          const nodeIds = new Set(
            nodesRef.current.filter(n => rectsOverlap(n, rect)).map(n => n.id)
          );
          const connIds = new Set(
            connectionsRef.current
              .filter(c => nodeIds.has(c.fromId) && nodeIds.has(c.toId))
              .map(c => c.id)
          );
          const imageIds = new Set(
            imagesRef.current.filter(im => rectsOverlap(im, rect)).map(im => im.id)
          );
          setSelectedNodeIds(nodeIds);
          setSelectedConnIds(connIds);
          setSelectedImageIds(imageIds);
        }
      }

      if (boxDrawing.current) {
        const { id, startX, startY } = boxDrawing.current;
        boxDrawing.current = null;
        setNodes(prev => prev.map(n => {
          if (n.id !== id) return n;
          if (n.width < 20 || n.height < 20)
            return { ...n, x: startX - 80, y: startY - 40, width: 160, height: 80 };
          return n;
        }));
      }

      if (connStart.current) {
        connStart.current = null;
        drawingLine.current = null;
        setDrawingLineState(null);
      }
    };

    const ARROW_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
    const PAN_SPEED = 10;

    const animatePan = () => {
      const keys = arrowKeys.current;
      if (keys.size === 0) { arrowAnimRef.current = null; return; }
      const speed = shiftHeld.current ? PAN_SPEED / 3 : PAN_SPEED;
      let dx = 0, dy = 0;
      if (keys.has("ArrowLeft"))  dx += speed;
      if (keys.has("ArrowRight")) dx -= speed;
      if (keys.has("ArrowUp"))    dy += speed;
      if (keys.has("ArrowDown"))  dy -= speed;
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      arrowAnimRef.current = requestAnimationFrame(animatePan);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      const inText = tag === "TEXTAREA" || tag === "INPUT" ||
        (document.activeElement as HTMLElement)?.isContentEditable;

      if (e.key === "Shift") shiftHeld.current = true;

      // Hijack the browser's native "save page" shortcut — open the same Save
      // dialog the toolbar's Save button opens, regardless of what's focused.
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyS") {
        e.preventDefault();
        setSaveModalOpen(true);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ" && !inText) {
        e.preventDefault();
        undo();
        return;
      }

      if (!inText && ARROW_KEYS.includes(e.key)) {
        e.preventDefault();
        const nodeIds = selectedNodeIdsRef.current;
        const imageIds = selectedImageIdsRef.current;
        if (nodeIds.size > 0 || imageIds.size > 0) {
          // Move selected nodes/images; shift = jump, no shift = nudge
          const gs = globalSettingsRef.current;
          const dist = shiftHeld.current ? (gs.nodeMoveJump ?? 100) : (gs.nodeMoveStep ?? 4);
          let dx = 0, dy = 0;
          if (e.key === "ArrowLeft")  dx = -dist;
          if (e.key === "ArrowRight") dx =  dist;
          if (e.key === "ArrowUp")    dy = -dist;
          if (e.key === "ArrowDown")  dy =  dist;
          if (!e.repeat) pushHistory();
          if (nodeIds.size > 0) {
            setNodes(prev => prev.map(n =>
              nodeIds.has(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n
            ));
            // Also shift bend points of connections fully inside the selection
            setConnections(prev => prev.map(c => {
              if (!c.bends?.length || !nodeIds.has(c.fromId) || !nodeIds.has(c.toId)) return c;
              return { ...c, bends: c.bends.map(b => ({ x: b.x + dx, y: b.y + dy })) };
            }));
          }
          if (imageIds.size > 0) {
            setImages(prev => prev.map(im =>
              imageIds.has(im.id) ? { ...im, x: im.x + dx, y: im.y + dy } : im
            ));
          }
          return;
        }
        // No nodes/images selected → pan canvas
        arrowKeys.current.add(e.key);
        if (!arrowAnimRef.current) {
          arrowAnimRef.current = requestAnimationFrame(animatePan);
        }
        return;
      }

      if (!inText) {
        if (e.key === "Delete" || e.key === "Backspace") deleteSelected();
        if (e.key === "s") setToolState("select");
        if (e.key === "n") setToolState("box");
        if (e.key === "x") setToolState("arrow");
      }

      if (e.key === "Escape") {
        const now = Date.now();
        if (now - lastEscapeRef.current < 400) {
          setSidebarOpen(false);
          setGlobalSidebarOpen(false);
          setTopMenuOpen(false);
          setNewModalOpen(false);
          setSaveModalOpen(false);
          setLoadModalOpen(false);
          setImageModalOpen(false);
          setHelpModalOpen(false);
          lastEscapeRef.current = 0;
        } else {
          lastEscapeRef.current = now;
          if (inText) {
            (document.activeElement as HTMLTextAreaElement).blur();
          } else {
            setTool("select");
          }
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      arrowKeys.current.delete(e.key);
      if (e.key === "Shift") shiftHeld.current = false;
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      if (arrowAnimRef.current) cancelAnimationFrame(arrowAnimRef.current);
    };
  }, [deleteSelected, pushHistory, undo]);


  // ── Render ────────────────────────────────────────────────────────────────

  // Resize handles only shown when exactly one node is selected and nothing else.
  const soloNodeId =
    selectedNodeIds.size === 1 && selectedConnIds.size === 0
      ? selectedNodeIds.values().next().value
      : null;
  const soloImageId =
    selectedImageIds.size === 1 && selectedNodeIds.size === 0 && selectedConnIds.size === 0
      ? selectedImageIds.values().next().value
      : null;

  // Show endpoint-drag port hints on the two nodes that belong to the selected connection.
  const selectedConnEndpointNodeIds: Set<number> = (() => {
    if (selectedConnIds.size !== 1) return new Set();
    const conn = connections.find(c => c.id === selectedConnIds.values().next().value);
    return conn ? new Set([conn.fromId, conn.toId]) : new Set();
  })();

  // Sidebar data
  const sidebarNodes = nodes.filter(n => selectedNodeIds.has(n.id));
  const sidebarConns = connections.filter(c => selectedConnIds.has(c.id));
  const sidebarImages = images.filter(i => selectedImageIds.has(i.id));
  const singleConn = sidebarConns.length === 1 && sidebarNodes.length === 0 ? sidebarConns[0] : null;
  const connFromNode = singleConn ? nodes.find(n => n.id === singleConn.fromId) ?? null : null;
  const connToNode   = singleConn ? nodes.find(n => n.id === singleConn.toId)   ?? null : null;

  const getIsBehind = (c: ConnectionData) => c.behindNodes ?? !(globalSettings.synapsesAboveNodes ?? true);
  const behindConns = connections.filter(getIsBehind);
  const frontConns  = connections.filter(c => !getIsBehind(c));

  // CSS variable changes on an element don't always trigger Chrome to re-layout
  // the scrollbar track width. Toggling overflowY forces a full scrollbar layout pass.
  useEffect(() => {
    document.querySelectorAll<HTMLElement>("[data-noad-panel]").forEach(el => {
      const top = el.scrollTop;
      el.style.overflowY = "hidden";
      void el.offsetHeight;
      el.style.overflowY = "scroll";
      el.scrollTop = top;
    });
  }, [globalSettings.scrollbarWidth, globalSettings.scrollbarMode]);

  return (
    <div
      style={{
        width: "100vw", height: "100vh", background: globalSettings.canvasBg,
        position: "relative", overflow: "hidden", fontFamily: "sans-serif",
      }}
      onMouseDown={onRootMouseDown}
      onDoubleClick={e => {
        if (e.target === e.currentTarget) {
          setSidebarOpen(false);
          setGlobalSidebarOpen(false);
          setTopMenuOpen(false);
        }
      }}
    >
      {/* World — nodes and connections pan/zoom together */}
      <div
        ref={canvasRef}
        style={{
          width: "100%", height: "100%", position: "absolute",
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
          cursor: isPanning ? "grabbing" : CURSORS[tool],
        }}
        onMouseDown={onCanvasMouseDown}
        onDoubleClick={onCanvasDoubleClick}
      >
        {/* SVG layer: connections behind nodes */}
        {behindConns.length > 0 && (
          <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }}>
            {behindConns.map(conn => {
              const fromNode = nodes.find(n => n.id === conn.fromId);
              const toNode   = nodes.find(n => n.id === conn.toId);
              if (!fromNode || !toNode) return null;
              return (
                <Connection
                  key={conn.id}
                  conn={conn}
                  fromNode={fromNode}
                  toNode={toNode}
                  isSelected={selectedConnIds.has(conn.id)}
                  tool={tool}
                  globalSettings={globalSettings}
                  onMouseDown={e => onConnectionMouseDown(e, conn.id)}
                  onDoubleClick={e => onConnectionDoubleClick(e, conn.id)}
                  onBendMouseDown={(e, idx, nx, ny) => onBendMouseDown(e, conn.id, idx, nx, ny)}
                  onBendDoubleClick={(e, idx) => onBendDoubleClick(e, conn.id, idx)}
                />
              );
            })}
          </svg>
        )}

        {/* Images — sit behind text nodes as a backdrop layer */}
        {images.map(image => (
          <ImageNode
            key={image.id}
            image={image}
            isSelected={selectedImageIds.has(image.id)}
            showHandles={soloImageId === image.id}
            isPanning={isPanning}
            globalSettings={globalSettings}
            onMouseDown={e => onImageMouseDown(e, image.id)}
            onResizeMouseDown={(e, corner) => onImageResizeMouseDown(e, image.id, corner)}
            onEdgeResizeMouseDown={(e, side) => onImageEdgeResizeMouseDown(e, image.id, side)}
          />
        ))}

        {/* Nodes */}
        {nodes.map(node => (
          <Node
            key={node.id}
            node={node}
            isSelected={selectedNodeIds.has(node.id)}
            showHandles={soloNodeId === node.id}
            isEditing={editingId === node.id}
            isPanning={isPanning}
            tool={tool}
            globalSettings={globalSettings}
            isDrawingConnection={drawingLineState !== null}
            showConnectingPortHint={selectedConnEndpointNodeIds.has(node.id)}
            zoom={zoom}
            pan={pan}
            onMouseDown={e => onNodeMouseDown(e, node.id)}
            onDoubleClick={e => onNodeDoubleClick(e, node.id)}
            onResizeMouseDown={(e, corner) => onResizeMouseDown(e, node.id, corner)}
            onEdgeResizeMouseDown={(e, side) => onEdgeResizeMouseDown(e, node.id, side)}
            onPortMouseDown={(e, side) => onPortMouseDown(e, node.id, side)}
            onPortMouseUp={side => onPortMouseUp(node.id, side)}
            onTitleChange={title => updateNodeTitle(node.id, title)}
            onTitleMouseDown={() => {
              setSelectedNodeIds(new Set([node.id]));
              setSelectedConnIds(new Set());
              setSelectedImageIds(new Set());
            }}
            onTitleBlur={() => { titleEditPushedRef.current = null; }}
            onTextChange={text => updateNodeText(node.id, text)}
            onTextBlur={() => setEditingId(null)}
          />
        ))}

        {/* SVG layer: connections in front of nodes + drawing preview */}
        <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }}>
          {frontConns.map(conn => {
            const fromNode = nodes.find(n => n.id === conn.fromId);
            const toNode   = nodes.find(n => n.id === conn.toId);
            if (!fromNode || !toNode) return null;
            return (
              <Connection
                key={conn.id}
                conn={conn}
                fromNode={fromNode}
                toNode={toNode}
                isSelected={selectedConnIds.has(conn.id)}
                tool={tool}
                globalSettings={globalSettings}
                onMouseDown={e => onConnectionMouseDown(e, conn.id)}
                onDoubleClick={e => onConnectionDoubleClick(e, conn.id)}
                onBendMouseDown={(e, idx, nx, ny) => onBendMouseDown(e, conn.id, idx, nx, ny)}
                onBendDoubleClick={(e, idx) => onBendDoubleClick(e, conn.id, idx)}
              />
            );
          })}

          {/* In-progress connection preview */}
          {drawingLineState && (() => {
            const { x1, y1, x2, y2, fromSide } = drawingLineState;
            const d = buildCurvedPath(x1, y1, fromSide, x2, y2, oppositeSide(fromSide));
            return (
              <path d={d} stroke="#888" strokeWidth={1.5} fill="none" strokeDasharray="5,3" />
            );
          })()}
        </svg>

        {/* Marquee selection rectangle */}
        {selectionRect && selectionRect.w > 2 && selectionRect.h > 2 && (
          <div style={{
            position: "absolute",
            left: selectionRect.x, top: selectionRect.y,
            width: selectionRect.w, height: selectionRect.h,
            background: (globalSettings.selectionBg ?? "#378ADD") + "1a",
            borderWidth: "1.5px", borderStyle: "solid",
            borderColor: globalSettings.selectionBorderColor ?? "#378ADD",
            borderRadius: globalSettings.selectionBorderRadius ?? 4,
            pointerEvents: "none",
          }} />
        )}
      </div>

      <Toolbar
        tool={tool}
        onToolChange={setTool}
        onUndo={undo}
        onCopy={copySelected}
        onPaste={pasteClipboard}
        onDelete={deleteSelected}
        onImage={() => setImageModalOpen(true)}
        onNew={() => setNewModalOpen(true)}
        onSave={() => setSaveModalOpen(true)}
        onLoad={() => { setLoadFile(null); setLoadError(""); setLoadModalOpen(true); }}
        onExport={() => setExportModalOpen(true)}
        globalSettings={globalSettings}
      />

      <GlobalSidebar
        isOpen={globalSidebarOpen}
        onToggle={() => setGlobalSidebarOpen(v => !v)}
        settings={globalSettings}
        onUpdate={onUpdateGlobal}
      />

      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(v => !v)}
        globalSettings={globalSettings}
        selectedNodes={sidebarNodes}
        selectedConns={sidebarConns}
        selectedImages={sidebarImages}
        fromNode={connFromNode}
        toNode={connToNode}
        onUpdateNode={onUpdateNode}
        onUpdateConn={onUpdateConn}
        onUpdateImage={onUpdateImage}
        onUpdateAllImages={onUpdateAllImages}
        onUpdateAllNodes={onUpdateAllNodes}
        onUpdateAllConns={onUpdateAllConns}
        onSendToFront={onSendToFront}
        onSendToBack={onSendToBack}
        onSendImageToFront={onSendImageToFront}
        onSendImageToBack={onSendImageToBack}
      />

      <TopMenu
        isOpen={topMenuOpen}
        onToggle={() => setTopMenuOpen(v => !v)}
        nodeCount={nodes.length}
        connCount={connections.length}
        onClearCanvas={clearCanvas}
        globalSettings={globalSettings}
        onUpdate={onUpdateGlobal}
      />

      {/* ── New canvas dialog ────────────────────────────────────────────────── */}
      {newModalOpen && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.12)", pointerEvents: "auto",
          }}
        >
          <div style={{
            background: globalSettings.panelBg ?? "#fff",
            borderWidth: "1px", borderStyle: "solid", borderColor: globalSettings.panelBorderColor ?? "#e0e0e0",
            borderRadius: globalSettings.panelBorderRadius ?? 8,
            padding: "24px 28px", boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
            minWidth: 300, maxWidth: 380,
          }}>
            <div style={{
              fontWeight: 700, fontSize: 13,
              color: globalSettings.panelHeaderColor ?? globalSettings.panelTextColor ?? "#444",
              textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 16,
            }}>
              New Canvas
            </div>
            <div style={{ fontSize: 13, color: globalSettings.panelTextColor ?? "#444444", marginBottom: 20, lineHeight: 1.6 }}>
              Are you sure you want to create a new canvas? This will clear all your work.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => { clearCanvas(); setNewModalOpen(false); }}
                style={{
                  flex: 1, padding: "7px 0",
                  borderWidth: "1px", borderStyle: "solid",
                  borderColor: globalSettings.confirmBorderColor ?? "transparent",
                  borderRadius: globalSettings.fieldBorderRadius ?? 6,
                  background: globalSettings.confirmBg ?? "#378ADD", color: globalSettings.confirmTextColor ?? "#fff",
                  fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                }}
              >Confirm</button>
              <button
                onClick={() => setNewModalOpen(false)}
                style={{
                  flex: 1, padding: "7px 0",
                  borderWidth: "1px", borderStyle: "solid", borderColor: globalSettings.fieldBorderColor ?? "#e2e2e2",
                  borderRadius: globalSettings.fieldBorderRadius ?? 6,
                  background: globalSettings.fieldBg ?? "#f7f7f7", color: globalSettings.fieldTextColor ?? "#555",
                  fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                }}
              >Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Save dialog ──────────────────────────────────────────────────────── */}
      {saveModalOpen && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.12)", pointerEvents: "auto",
          }}
        >
          <div style={{
            background: globalSettings.panelBg ?? "#fff",
            borderWidth: "1px", borderStyle: "solid", borderColor: globalSettings.panelBorderColor ?? "#e0e0e0",
            borderRadius: globalSettings.panelBorderRadius ?? 8,
            padding: "24px 28px", boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
            minWidth: 300, maxWidth: 380,
            position: "relative",
          }}>
            <button
              onClick={() => setSaveModalOpen(false)}
              aria-label="Close"
              style={{
                position: "absolute", top: 10, right: 10,
                width: 24, height: 24, padding: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "none", background: "transparent",
                borderRadius: globalSettings.fieldBorderRadius ?? 6,
                color: globalSettings.panelTextColor ?? "#888",
                fontSize: 16, lineHeight: 1, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              ×
            </button>
            <div style={{
              fontWeight: 700, fontSize: 13,
              color: globalSettings.panelHeaderColor ?? globalSettings.panelTextColor ?? "#444",
              textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 16,
            }}>
              Save Canvas
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: (globalSettings.panelTextColor ?? "#444444") + "99", marginBottom: 4, letterSpacing: 0.2 }}>
                File name
              </div>
              <div style={{ display: "flex", alignItems: "stretch" }}>
                <input
                  value={saveFileName}
                  onChange={e => setSaveFileName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setSaveModalOpen(false); }}
                  autoFocus
                  style={{
                    flex: 1, padding: "8px 10px",
                    borderWidth: "1px 0 1px 1px", borderStyle: "solid",
                    borderColor: globalSettings.fieldBorderColor ?? "#e2e2e2",
                    borderRadius: `${globalSettings.fieldBorderRadius ?? 6}px 0 0 ${globalSettings.fieldBorderRadius ?? 6}px`,
                    fontSize: 13, color: globalSettings.fieldTextColor ?? "#222",
                    background: globalSettings.fieldBg ?? "#f7f7f7",
                    outline: "none", fontFamily: "inherit", minWidth: 0,
                  }}
                />
                <div style={{
                  padding: "8px 10px",
                  borderWidth: "1px", borderStyle: "solid", borderColor: globalSettings.fieldBorderColor ?? "#e2e2e2",
                  borderRadius: `0 ${globalSettings.fieldBorderRadius ?? 6}px ${globalSettings.fieldBorderRadius ?? 6}px 0`,
                  fontSize: 13, color: (globalSettings.panelTextColor ?? "#444444") + "88",
                  background: globalSettings.fieldBg ?? "#f7f7f7",
                  userSelect: "none", whiteSpace: "nowrap",
                }}>
                  .json
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleSave}
                style={{
                  flex: 1, padding: "7px 0",
                  borderWidth: "1px", borderStyle: "solid",
                  borderColor: globalSettings.confirmBorderColor ?? "transparent",
                  borderRadius: globalSettings.fieldBorderRadius ?? 6,
                  background: globalSettings.confirmBg ?? "#378ADD", color: globalSettings.confirmTextColor ?? "#fff",
                  fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                }}
              >Save</button>
              <button
                onClick={() => setSaveModalOpen(false)}
                style={{
                  flex: 1, padding: "7px 0",
                  borderWidth: "1px", borderStyle: "solid", borderColor: globalSettings.fieldBorderColor ?? "#e2e2e2",
                  borderRadius: globalSettings.fieldBorderRadius ?? 6,
                  background: globalSettings.fieldBg ?? "#f7f7f7", color: globalSettings.fieldTextColor ?? "#555",
                  fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                }}
              >Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Load dialog ──────────────────────────────────────────────────────── */}
      {loadModalOpen && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.12)", pointerEvents: "auto",
          }}
        >
          <div style={{
            background: globalSettings.panelBg ?? "#fff",
            borderWidth: "1px", borderStyle: "solid", borderColor: globalSettings.panelBorderColor ?? "#e0e0e0",
            borderRadius: globalSettings.panelBorderRadius ?? 8,
            padding: "24px 28px", boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
            minWidth: 300, maxWidth: 380,
          }}>
            <div style={{
              fontWeight: 700, fontSize: 13,
              color: globalSettings.panelHeaderColor ?? globalSettings.panelTextColor ?? "#444",
              textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 16,
            }}>
              Load Canvas
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: (globalSettings.panelTextColor ?? "#444444") + "99", marginBottom: 4, letterSpacing: 0.2 }}>
                Canvas file
              </div>
              <input
                ref={loadFileInputRef}
                type="file"
                accept=".json"
                style={{ display: "none" }}
                onChange={e => { setLoadFile(e.target.files?.[0] ?? null); setLoadError(""); }}
              />
              <div
                role="button"
                onClick={() => loadFileInputRef.current?.click()}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "10px 12px",
                  borderWidth: "1px", borderStyle: "solid",
                  borderColor: loadFile ? "#378ADD" : (globalSettings.fieldBorderColor ?? "#e2e2e2"),
                  borderRadius: globalSettings.fieldBorderRadius ?? 6,
                  background: globalSettings.fieldBg ?? "#f7f7f7",
                  cursor: "pointer", fontSize: 12, userSelect: "none",
                  color: loadFile ? (globalSettings.fieldTextColor ?? "#222") : (globalSettings.panelTextColor ?? "#444444") + "77",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M8 10.5V1.5" />
                  <path d="M4.5 5 8 1.5 11.5 5" />
                  <path d="M1.5 10.5v3a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-3" />
                </svg>
                <span>{loadFile ? loadFile.name : "Choose a file…"}</span>
              </div>
            </div>
            {loadError && (
              <div style={{ fontSize: 12, color: "#d44", marginBottom: 12, lineHeight: 1.5 }}>
                {loadError}
              </div>
            )}
            <div style={{ fontSize: 11, color: (globalSettings.panelTextColor ?? "#444444") + "66", marginBottom: 16, lineHeight: 1.5 }}>
              This will replace the current canvas.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleLoad}
                disabled={!loadFile}
                style={{
                  flex: 1, padding: "7px 0",
                  borderWidth: "1px", borderStyle: "solid",
                  borderColor: loadFile ? (globalSettings.confirmBorderColor ?? "transparent") : (globalSettings.fieldBorderColor ?? "#e2e2e2"),
                  borderRadius: globalSettings.fieldBorderRadius ?? 6,
                  background: loadFile ? (globalSettings.confirmBg ?? "#378ADD") : (globalSettings.fieldBorderColor ?? "#e2e2e2"),
                  color: loadFile ? (globalSettings.confirmTextColor ?? "#fff") : (globalSettings.panelTextColor ?? "#444444") + "77",
                  fontSize: 12, fontWeight: 600,
                  cursor: loadFile ? "pointer" : "default", fontFamily: "inherit",
                }}
              >Load</button>
              <button
                onClick={() => { setLoadModalOpen(false); setLoadFile(null); setLoadError(""); }}
                style={{
                  flex: 1, padding: "7px 0",
                  borderWidth: "1px", borderStyle: "solid", borderColor: globalSettings.fieldBorderColor ?? "#e2e2e2",
                  borderRadius: globalSettings.fieldBorderRadius ?? 6,
                  background: globalSettings.fieldBg ?? "#f7f7f7", color: globalSettings.fieldTextColor ?? "#555",
                  fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                }}
              >Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Export dialog ─────────────────────────────────────────────────────── */}
      {exportModalOpen && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.12)", pointerEvents: "auto",
          }}
        >
          <div style={{
            background: globalSettings.panelBg ?? "#fff",
            borderWidth: "1px", borderStyle: "solid", borderColor: globalSettings.panelBorderColor ?? "#e0e0e0",
            borderRadius: globalSettings.panelBorderRadius ?? 8,
            padding: "24px 28px", boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
            minWidth: 300, maxWidth: 380,
          }}>
            <div style={{
              fontWeight: 700, fontSize: 13,
              color: globalSettings.panelHeaderColor ?? globalSettings.panelTextColor ?? "#444",
              textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 16,
            }}>
              Export Canvas
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: (globalSettings.panelTextColor ?? "#444444") + "99", marginBottom: 4, letterSpacing: 0.2 }}>
                File name
              </div>
              <input
                type="text"
                value={exportFileName}
                onChange={e => setExportFileName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") handleExport();
                  if (e.key === "Escape") setExportModalOpen(false);
                }}
                style={{
                  width: "100%", padding: "8px 10px",
                  borderWidth: "1px", borderStyle: "solid", borderColor: globalSettings.fieldBorderColor ?? "#e2e2e2",
                  borderRadius: globalSettings.fieldBorderRadius ?? 6,
                  background: globalSettings.fieldBg ?? "#f7f7f7", color: globalSettings.fieldTextColor ?? "#222",
                  fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: (globalSettings.panelTextColor ?? "#444444") + "99", marginBottom: 4, letterSpacing: 0.2 }}>
                Scope
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {(["all", "selected"] as const).map(m => {
                  const active = exportMode === m;
                  const hl = globalSettings.highlightBg ?? "#378ADD";
                  const hlText = globalSettings.highlightTextColor ?? "#fff";
                  return (
                    <button
                      key={m}
                      onClick={() => setExportMode(m)}
                      style={{
                        flex: 1, padding: "6px 10px",
                        borderWidth: "1px", borderStyle: "solid",
                        borderColor: active ? hl : (globalSettings.fieldBorderColor ?? "#e2e2e2"),
                        borderRadius: globalSettings.fieldBorderRadius ?? 6,
                        background: active ? hl : (globalSettings.fieldBg ?? "#f7f7f7"),
                        color: active ? hlText : (globalSettings.fieldTextColor ?? "#444"),
                        fontSize: 12, fontWeight: active ? 600 : 400,
                        cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      {m === "all" ? "All items" : "Selected only"}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleExport}
                style={{
                  flex: 1, padding: "7px 0",
                  borderWidth: "1px", borderStyle: "solid",
                  borderColor: globalSettings.confirmBorderColor ?? "transparent",
                  borderRadius: globalSettings.fieldBorderRadius ?? 6,
                  background: globalSettings.confirmBg ?? "#378ADD", color: globalSettings.confirmTextColor ?? "#fff",
                  fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                }}
              >Export PDF</button>
              <button
                onClick={() => setExportModalOpen(false)}
                style={{
                  flex: 1, padding: "7px 0",
                  borderWidth: "1px", borderStyle: "solid", borderColor: globalSettings.fieldBorderColor ?? "#e2e2e2",
                  borderRadius: globalSettings.fieldBorderRadius ?? 6,
                  background: globalSettings.fieldBg ?? "#f7f7f7", color: globalSettings.fieldTextColor ?? "#555",
                  fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                }}
              >Cancel</button>
            </div>
          </div>
        </div>
      )}

      <ImageModal
        isOpen={imageModalOpen}
        onClose={() => setImageModalOpen(false)}
        globalSettings={globalSettings}
        onInsert={handleInsertImage}
      />

      <HelpModal
        isOpen={helpModalOpen}
        onClose={() => setHelpModalOpen(false)}
        globalSettings={globalSettings}
      />

      {/* Hint bar — fixed top-left, above all panels */}
      {(globalSettings.showHints ?? true) && (
        <div style={{
          position: "fixed", top: 8, left: 8,
          background: globalSettings.panelBg ?? "#fff",
          borderWidth: "1px", borderStyle: "solid", borderColor: globalSettings.panelBorderColor ?? "#eee",
          borderRadius: globalSettings.panelBorderRadius ?? 8,
          padding: "5px 12px", fontSize: 11,
          color: globalSettings.panelTextColor ?? "#888",
          pointerEvents: "none", zIndex: 9999,
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        }}>
          {HINTS[tool]}
        </div>
      )}
    </div>
  );
}
