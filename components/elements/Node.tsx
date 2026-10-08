"use client";

import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties } from "react";
import type { NodeData, Side, Tool, Corner, GlobalSettings } from "@/lib/canvasTypes";
import { parseRuns, serializeRuns, plainLength, runsFromEditable, buildEditableNodes } from "@/lib/richText";

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

function renderWithLinks(text: string, linkColor = "#378ADD"): React.ReactNode[] {
  const URL_RE = /https?:\/\/[^\s]+/g;
  const result: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = URL_RE.exec(text)) !== null) {
    if (match.index > lastIndex) result.push(text.slice(lastIndex, match.index));
    const url = match[0];
    result.push(
      <a
        key={match.index}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onMouseDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
        style={{ color: linkColor, textDecoration: "underline", cursor: "pointer", pointerEvents: "auto" }}
      >
        {url}
      </a>
    );
    lastIndex = match.index + url.length;
  }
  if (lastIndex < text.length) result.push(text.slice(lastIndex));
  return result;
}

// Renders a title/text string that may contain inline <b>/<i> runs (applied
// via Ctrl+B / Ctrl+I while editing), preserving URL-linkification per run.
function renderRuns(raw: string, linkColor: string): React.ReactNode[] {
  return parseRuns(raw).map((run, i) => {
    let content: React.ReactNode = renderWithLinks(run.text, linkColor);
    if (run.italic) content = <i>{content}</i>;
    if (run.bold) content = <b>{content}</b>;
    return <span key={i}>{content}</span>;
  });
}

interface Props {
  node: NodeData;
  isSelected: boolean;
  showHandles: boolean;
  isEditing: boolean;
  isPanning: boolean;
  tool: Tool;
  globalSettings: GlobalSettings;
  onMouseDown: (e: React.MouseEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  isDrawingConnection: boolean;
  showConnectingPortHint: boolean;
  onResizeMouseDown: (e: React.MouseEvent, corner: Corner) => void;
  onEdgeResizeMouseDown: (e: React.MouseEvent, side: Side) => void;
  zoom: number;
  pan: { x: number; y: number };
  onPortMouseDown: (e: React.MouseEvent, side: Side) => void;
  onPortMouseUp: (side: Side) => void;
  onTitleChange: (title: string) => void;
  onTitleMouseDown: () => void;
  onTitleBlur?: () => void;
  onTextChange: (text: string) => void;
  onTextBlur: () => void;
}

const SIDES: Side[] = ["top", "bottom", "left", "right"];

function portHitStyle(side: Side, half: number): CSSProperties {
  if (side === "top")    return { top: -half,    left: "50%", transform: "translateX(-50%)" };
  if (side === "bottom") return { bottom: -half, left: "50%", transform: "translateX(-50%)" };
  if (side === "left")   return { left: -half,   top: "50%",  transform: "translateY(-50%)" };
  return                        { right: -half,  top: "50%",  transform: "translateY(-50%)" };
}

// Hit-area thickness for edge/corner resize handles is scaled up 2.25x (125% more
// than the original 20px/32px bands) so grabbing the outside edge of a node to
// resize it reliably wins over the node's own click-and-drag-to-move area.
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

const showPort = (tool: Tool, isSelected: boolean, isDrawingConnection: boolean, showConnectingPortHint: boolean, isHovered: boolean) =>
  isSelected || tool === "arrow" || tool === "box" || isDrawingConnection || showConnectingPortHint || isHovered;

export default function Node({
  node, isSelected, showHandles, isEditing, isPanning, tool, globalSettings,
  isDrawingConnection, showConnectingPortHint,
  onMouseDown, onDoubleClick, onResizeMouseDown, onEdgeResizeMouseDown,
  zoom, pan, onPortMouseDown, onPortMouseUp,
  onTitleChange, onTitleMouseDown, onTitleBlur,
  onTextChange, onTextBlur,
}: Props) {
  const [titleEditing, setTitleEditing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const titleRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // On edit start: hydrate real DOM nodes from the stored runs, focus, select all
  useEffect(() => {
    if (!titleEditing) return;
    const el = titleRef.current;
    if (!el) return;
    el.replaceChildren(...buildEditableNodes(parseRuns(node.title)));
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
  }, [titleEditing]); // eslint-disable-line react-hooks/exhaustive-deps

  // On edit start: hydrate content from stored runs, focus, caret to end
  useEffect(() => {
    if (!isEditing) return;
    const el = contentRef.current;
    if (!el) return;
    el.replaceChildren(...buildEditableNodes(parseRuns(node.text)));
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
  }, [isEditing]); // eslint-disable-line react-hooks/exhaustive-deps

  const syncTitle = () => {
    const el = titleRef.current;
    if (!el) return;
    onTitleChange(serializeRuns(runsFromEditable(el)));
  };
  const syncContent = () => {
    const el = contentRef.current;
    if (!el) return;
    onTextChange(serializeRuns(runsFromEditable(el)));
  };
  // Pasting into a contentEditable region can otherwise drag in arbitrary
  // foreign markup/styles from the clipboard; forcing plain text keeps
  // pasted content within the same bold/italic-only model as typed text.
  const forcePlainPaste = (sync: () => void) => (e: React.ClipboardEvent) => {
    e.preventDefault();
    document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
    sync();
  };

  const titleBaseStyle: CSSProperties = {
    position: "absolute",
    bottom: "calc(100% + 4px)",
    left: 0,
    minWidth: "100%",
    width: "max-content",
    boxSizing: "border-box",
    borderRadius: 3,
    background: "transparent",
    textAlign: node.titleAlign ?? globalSettings.titleAlign ?? "left",
    fontFamily: globalSettings.titleFont ?? "inherit",
    fontSize: node.titleFontSize ?? globalSettings.titleFontSize ?? 12,
    fontWeight: (node.titleStyle ?? "bold") === "bold" ? 700 : 400,
    fontStyle: (node.titleStyle ?? "bold") === "italic" ? "italic" : "normal",
    color: node.titleColor ?? globalSettings.boxTitleColor,
    padding: "2px 4px",
    userSelect: "none",
    whiteSpace: "nowrap",
    lineHeight: 1.4,
  };

  const PAD = 12;
  const textFillFontSize = (node.textFill && node.text)
    ? Math.min(500, Math.max(6, Math.sqrt(
        ((node.width - 2 * PAD) * (node.height - 2 * PAD)) /
        (plainLength(node.text) * 0.72)
      )))
    : null;

  const textFontSize = textFillFontSize ?? (node.textFontSize ?? globalSettings.textFontSize ?? 14);
  const textLineHeight = 1.5;

  const textBaseStyle: CSSProperties = {
    textAlign: node.textAlign ?? globalSettings.textAlign ?? "center",
    fontFamily: globalSettings.textFont ?? "sans-serif",
    fontSize: textFontSize,
    fontWeight: node.textStyle === "bold" ? 700 : 400,
    fontStyle: node.textStyle === "italic" ? "italic" : "normal",
    color: node.textColor ?? globalSettings.boxTextColor,
    lineHeight: textLineHeight,
    padding: PAD,
  };

  // Clamp displayed (non-editing) text to however many lines actually fit in the
  // node's current height, so overflow shows a trailing "…" instead of clipping mid-line.
  const maxTextLines = Math.max(1, Math.floor((node.height - 2 * PAD) / (textFontSize * textLineHeight)));

  // The actual editable elements (contentEditable title / textarea) are portaled to
  // document.body instead of living inside the pan/zoom-scaled canvas tree. Chromium
  // and Firefox have a long-standing bug where a text caret inside any ancestor with a
  // CSS `transform` (even an identity one) renders statically or vanishes entirely on
  // arrow-key navigation / selection changes. Portaling escapes that ancestor chain, so
  // position/size/font have to be converted to screen space manually here instead of
  // relying on the ancestor's transform to do it.
  const screenX = pan.x + node.x * zoom;
  const screenY = pan.y + node.y * zoom;
  const screenW = node.width * zoom;
  const screenH = node.height * zoom;

  return (
    <div
      style={{
        position: "absolute",
        left: node.x, top: node.y, width: node.width, height: node.height,
        background: node.bg ?? globalSettings.boxBg,
        border: (() => {
          const bc = node.borderColor ?? globalSettings.boxBorderColor;
          const hl = brightenHex(globalSettings.selectionHighlightColor ?? "#378ADD", globalSettings.selectionHighlightBrightness ?? 0.5);
          const col = isSelected ? hl : bc;
          return `${node.borderThickness ?? globalSettings.boxBorderThickness}px solid ${col}`;
        })(),
        borderRadius: node.borderRadius ?? globalSettings.boxBorderRadius,
        boxShadow: isSelected
          ? `0 0 0 3px ${brightenHex(globalSettings.selectionHighlightColor ?? "#378ADD", globalSettings.selectionHighlightBrightness ?? 0.5)}`
          : "0 2px 8px rgba(0,0,0,0.06)",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: isPanning ? "grabbing" : (isEditing ? "default" : "grab"),
        userSelect: "none",
      }}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Title display (not editing) */}
      {!titleEditing && (
        <div
          onMouseDown={e => {
            e.stopPropagation();
            if (tool !== "select" && tool !== "box") e.preventDefault();
            onTitleMouseDown();
          }}
          onClick={e => {
            e.stopPropagation();
            if (tool === "select" || tool === "box") setTitleEditing(true);
          }}
          onDoubleClick={e => e.stopPropagation()}
          style={{ ...titleBaseStyle, cursor: "default" }}
        >
          {node.title && renderRuns(node.title, globalSettings.linkColor ?? "#378ADD")}
        </div>
      )}

      {/* Title editor (editing) — portaled; see screenX/screenY comment above */}
      {titleEditing && createPortal(
        <div
          ref={titleRef}
          contentEditable="true"
          suppressContentEditableWarning
          onInput={syncTitle}
          onPaste={forcePlainPaste(syncTitle)}
          onBlur={() => { setTitleEditing(false); onTitleBlur?.(); }}
          onKeyDown={e => {
            e.stopPropagation();
            const key = e.key.toLowerCase();
            if ((e.ctrlKey || e.metaKey) && (key === "b" || key === "i")) {
              e.preventDefault();
              document.execCommand(key === "b" ? "bold" : "italic");
              syncTitle();
              return;
            }
            if (e.key === "Enter" || e.key === "Escape") {
              e.preventDefault();
              titleRef.current?.blur();
            }
          }}
          style={{
            position: "fixed",
            left: screenX,
            /* Anchored via translateY(-100%) (grows upward from its own rendered
             height) rather than `bottom`, since `bottom` on a fixed element is
             relative to the viewport, not this node — it would need a window
             resize listener to stay put. The 4px gap is scaled by zoom to match
             how it looked when the ancestor's CSS transform used to scale it.
            */
            top: screenY - 4 * zoom,
            transform: "translateY(-100%)",
            minWidth: screenW,
            width: "max-content",
            boxSizing: "border-box",
            background: "transparent",
            textAlign: node.titleAlign ?? globalSettings.titleAlign ?? "left",
            fontFamily: globalSettings.titleFont ?? "inherit",
            fontSize: (node.titleFontSize ?? globalSettings.titleFontSize ?? 12) * zoom,
            fontWeight: (node.titleStyle ?? "bold") === "bold" ? 700 : 400,
            fontStyle: (node.titleStyle ?? "bold") === "italic" ? "italic" : "normal",
            color: node.titleColor ?? globalSettings.boxTitleColor,
            padding: `${2 * zoom}px ${4 * zoom}px`,
            whiteSpace: "nowrap",
            lineHeight: 1.4,
            outline: `${1.5 * zoom}px solid rgba(55,138,221,0.5)`,
            outlineOffset: 2 * zoom,
            cursor: "text",
            userSelect: "text",
            zIndex: 150,
          }}
        />,
        document.body
      )}

      {/* Connection ports — larger invisible hit area so they're clickable when zoomed out */}
      {SIDES.map(side => {
        const hitSize = Math.min(Math.max(36, 20 / zoom), 60);
        const half = hitSize / 2;
        return (
          <div
            key={side}
            data-port="true"
            onMouseDown={e => onPortMouseDown(e, side)}
            onMouseUp={() => onPortMouseUp(side)}
            style={{
              position: "absolute", width: hitSize, height: hitSize,
              borderRadius: "50%", cursor: "crosshair", zIndex: 10,
              display: "flex", alignItems: "center", justifyContent: "center",
              ...portHitStyle(side, half),
            }}
          >
            <div style={{
              width: 13, height: 13, borderRadius: "50%",
              background: "#fff", border: "1.5px solid #378ADD",
              opacity: showPort(tool, isSelected, isDrawingConnection, showConnectingPortHint, isHovered) ? 1 : 0,
              transition: "opacity 0.15s",
              pointerEvents: "none",
            }} />
          </div>
        );
      })}

      {/* Text display (not editing) — renders URLs as clickable links */}
      {!isEditing && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            ...textBaseStyle,
            boxSizing: "border-box",
            overflow: "hidden",
            pointerEvents: "none",
          }}
        >
          {node.text
            ? (
              <div
                style={{
                  width: "100%",
                  wordBreak: "break-word",
                  whiteSpace: "pre-wrap",
                  overflow: "hidden",
                  display: "-webkit-box",
                  WebkitBoxOrient: "vertical",
                  WebkitLineClamp: maxTextLines,
                } as CSSProperties}
              >
                {renderRuns(node.text, globalSettings.linkColor ?? "#378ADD")}
              </div>
            )
            : <span style={{ color: "#bbb", pointerEvents: "none" }}>Type here...</span>
          }
        </div>
      )}

      {/* Text editor (editing) — portaled; see screenX/screenY comment above.
          contentEditable (not a textarea) so Ctrl+B/Ctrl+I can bold/italicize
          just the current selection. */}
      {isEditing && createPortal(
        <div
          ref={contentRef}
          contentEditable="true"
          suppressContentEditableWarning
          data-placeholder="Type here..."
          onInput={syncContent}
          onPaste={forcePlainPaste(syncContent)}
          onBlur={onTextBlur}
          onKeyDown={e => {
            const key = e.key.toLowerCase();
            if ((e.ctrlKey || e.metaKey) && (key === "b" || key === "i")) {
              e.preventDefault();
              document.execCommand(key === "b" ? "bold" : "italic");
              syncContent();
              return;
            }
            if (e.key === "Enter") {
              e.preventDefault();
              document.execCommand("insertText", false, "\n");
              syncContent();
              return;
            }
            if (e.key === "Tab") {
              e.preventDefault();
              document.execCommand("insertText", false, "\t");
              syncContent();
            }
          }}
          style={{
            position: "fixed",
            left: screenX,
            top: screenY,
            width: screenW,
            height: screenH,
            boxSizing: "border-box",
            border: "none", outline: "none",
            background: "transparent",
            overflow: "hidden",
            wordBreak: "break-word",
            whiteSpace: "pre-wrap",
            cursor: "text",
            zIndex: 150,
            textAlign: node.textAlign ?? globalSettings.textAlign ?? "center",
            fontFamily: globalSettings.textFont ?? "sans-serif",
            fontSize: textFontSize * zoom,
            fontWeight: node.textStyle === "bold" ? 700 : 400,
            fontStyle: node.textStyle === "italic" ? "italic" : "normal",
            color: node.textColor ?? globalSettings.boxTextColor,
            lineHeight: textLineHeight,
            padding: PAD * zoom,
          } as CSSProperties}
        />,
        document.body
      )}

      {/* Edge resize handles */}
      {!isEditing && EDGE_HANDLES.map(({ side, cursor, style }) => (
        <div
          key={`edge-${side}`}
          data-resize="true"
          onMouseDown={e => onEdgeResizeMouseDown(e, side)}
          style={{
            position: "absolute", zIndex: 5,
            cursor,
            pointerEvents: (tool === "select" || tool === "box") ? "auto" : "none",
            ...style,
          }}
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
