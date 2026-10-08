"use client";

import { useState, useEffect, useRef } from "react";
import type { NodeData, ConnectionData, ImageNodeData, GlobalSettings, TabAlign, TextStyle } from "@/lib/canvasTypes";
import { ColorField } from "@/components/molecules/ColorField";
import { startMiddleDragAdjust } from "@/lib/dragAdjust";
import { useWheelAdjust } from "@/lib/useWheelAdjust";
import { plainText } from "@/lib/richText";

const PANEL_W = 270;

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, color: "var(--label-color, #999)", marginBottom: 3, letterSpacing: 0.2 }}>
      {children}
    </div>
  );
}

function SectionHeading({ children, first }: { children: React.ReactNode; first?: boolean }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, color: "var(--section-color, #bbb)",
      textTransform: "uppercase", letterSpacing: 1,
      marginBottom: 10, marginTop: first ? 0 : 16,
    }}>
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ borderTop: "1px solid #f0f0f0", marginTop: 6 }} />;
}

function inputStyle(gs: GlobalSettings): React.CSSProperties {
  return {
    width: "100%", boxSizing: "border-box", padding: "8px 10px",
    borderWidth: "1px", borderStyle: "solid", borderColor: gs.fieldBorderColor ?? "#e2e2e2",
    borderRadius: gs.fieldBorderRadius ?? 6,
    fontSize: 13, color: gs.fieldTextColor ?? "#222",
    outline: "none", fontFamily: "inherit",
    background: gs.fieldBg ?? "#f7f7f7",
  };
}

type Align = "left" | "center" | "right";

function AlignToggle({ value, onChange, gs }: {
  value: Align; onChange: (v: Align) => void; gs: GlobalSettings;
}) {
  const opts: { v: Align; label: string }[] = [
    { v: "left", label: "L" }, { v: "center", label: "C" }, { v: "right", label: "R" },
  ];
  return (
    <div style={{
      display: "flex",
      borderWidth: "1px", borderStyle: "solid", borderColor: gs.fieldBorderColor ?? "#e2e2e2",
      borderRadius: gs.fieldBorderRadius ?? 6, overflow: "hidden",
    }}>
      {opts.map(({ v, label }, i) => (
        <button
          key={v}
          onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onChange(v); }}
          style={{
            flex: 1, padding: "8px 0", border: "none",
            borderLeftWidth: i > 0 ? "1px" : "0",
            borderLeftStyle: "solid",
            borderLeftColor: gs.fieldBorderColor ?? "#e2e2e2",
            background: value === v ? (gs.highlightBg ?? "#378ADD") : (gs.fieldBg ?? "#f7f7f7"),
            color: value === v ? (gs.highlightTextColor ?? "#fff") : (gs.fieldTextColor ?? "#888"),
            cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}


const STYLE_OPTS: { v: TextStyle; label: string }[] = [
  { v: "normal", label: "N" }, { v: "bold", label: "B" }, { v: "italic", label: "I" },
];

function StyleToggle({ value, onChange, gs }: {
  value: TextStyle; onChange: (v: TextStyle) => void; gs: GlobalSettings;
}) {
  return (
    <div style={{
      display: "flex",
      borderWidth: "1px", borderStyle: "solid", borderColor: gs.fieldBorderColor ?? "#e2e2e2",
      borderRadius: gs.fieldBorderRadius ?? 6, overflow: "hidden",
    }}>
      {STYLE_OPTS.map(({ v, label }, i) => (
        <button
          key={v}
          onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onChange(v); }}
          style={{
            flex: 1, padding: "8px 0", border: "none",
            borderLeftWidth: i > 0 ? "1px" : "0",
            borderLeftStyle: "solid",
            borderLeftColor: gs.fieldBorderColor ?? "#e2e2e2",
            background: value === v ? (gs.highlightBg ?? "#378ADD") : (gs.fieldBg ?? "#f7f7f7"),
            color: value === v ? (gs.highlightTextColor ?? "#fff") : (gs.fieldTextColor ?? "#888"),
            cursor: "pointer", fontSize: 12, fontFamily: "inherit",
            fontWeight: v === "bold" ? 700 : 400,
            fontStyle: v === "italic" ? "italic" : "normal",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function FontSizeField({ value, onChange, gs }: {
  value: number; onChange: (v: number) => void; gs: GlobalSettings;
}) {
  const [local, setLocal] = useState(String(value));
  useEffect(() => { setLocal(String(value)); }, [value]);
  const inputRef = useRef<HTMLInputElement>(null);
  useWheelAdjust(inputRef, deltaY => {
    const next = value + (deltaY < 0 ? 1 : -1);
    if (next >= 6) onChange(next);
  });
  return (
    <div>
      <Label>Font size</Label>
      <input
        ref={inputRef}
        type="number" min={6} value={local}
        onChange={e => { setLocal(e.target.value); const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 6) onChange(v); }}
        onFocus={e => e.target.select()}
        onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        onMouseDown={e => {
          if (e.button === 1) {
            const startValue = value;
            startMiddleDragAdjust(e, steps => { const next = startValue + steps; if (next >= 6) onChange(next); });
            return;
          }
          e.stopPropagation();
        }}
        style={{ ...inputStyle(gs), width: "100%" }}
      />
    </div>
  );
}

function NumField({ label, value, onChange, min, max, gs }: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; gs: GlobalSettings;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useWheelAdjust(inputRef, deltaY => onChange(value + (deltaY < 0 ? 1 : -1)));
  return (
    <div style={{ marginBottom: 14 }}>
      <Label>{label}</Label>
      <input
        ref={inputRef}
        type="number" min={min} max={max} value={Math.round(value)}
        onChange={e => { const n = parseFloat(e.target.value); if (!isNaN(n)) onChange(n); }}
        onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        onMouseDown={e => {
          if (e.button === 1) {
            const startValue = value;
            startMiddleDragAdjust(e, steps => {
              let next = startValue + steps;
              if (min !== undefined) next = Math.max(min, next);
              if (max !== undefined) next = Math.min(max, next);
              onChange(next);
            });
            return;
          }
          e.stopPropagation();
        }}
        style={inputStyle(gs)}
      />
    </div>
  );
}

function ReadRow({ label, value, gs }: { label: string; value: string; gs: GlobalSettings }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <Label>{label}</Label>
      <div style={{
        padding: "8px 10px",
        borderWidth: "1px", borderStyle: "solid", borderColor: gs.fieldBorderColor ?? "#e2e2e2",
        borderRadius: gs.fieldBorderRadius ?? 6,
        fontSize: 13, color: gs.fieldTextColor ?? "#555",
        background: gs.fieldBg ?? "#f7f7f7",
        lineHeight: 1.4, wordBreak: "break-word",
      }}>
        {value || <span style={{ color: "#ccc" }}>—</span>}
      </div>
    </div>
  );
}

function StepperField({ label, value, onChange, min, max, step, gs }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number; gs: GlobalSettings;
}) {
  const fmt = (v: number) => Number(v.toFixed(4)).toString();
  const [inputVal, setInputVal] = useState(() => fmt(value));
  useEffect(() => { setInputVal(fmt(value)); }, [value]);
  const scale = 1 / step;
  const valueRef = useRef(value);
  valueRef.current = value;
  const dec = () => onChange(Math.max(min, Math.round(valueRef.current * scale - 1) / scale));
  const inc = () => onChange(Math.min(max, Math.round(valueRef.current * scale + 1) / scale));
  const atMin = value <= min, atMax = value >= max;
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const startHold = (action: () => void) => {
    action();
    holdTimer.current = setTimeout(() => {
      holdInterval.current = setInterval(action, 60);
    }, 350);
  };
  const stopHold = () => {
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
    if (holdInterval.current) { clearInterval(holdInterval.current); holdInterval.current = null; }
  };
  useEffect(() => () => { stopHold(); }, []);
  const commit = () => {
    const n = parseFloat(inputVal);
    if (!isNaN(n)) onChange(Math.max(min, Math.min(max, n)));
    else setInputVal(fmt(value));
  };
  const stepInputRef = useRef<HTMLInputElement>(null);
  useWheelAdjust(stepInputRef, deltaY => {
    if (deltaY < 0) { if (!atMax) inc(); } else if (deltaY > 0) { if (!atMin) dec(); }
  });
  const btnStyle = (disabled: boolean): React.CSSProperties => ({
    width: 38, padding: 0, border: "none",
    background: gs.fieldBg ?? "#f7f7f7",
    opacity: disabled ? 0.3 : 1,
    cursor: disabled ? "default" : "pointer",
    fontSize: 16, color: gs.fieldTextColor ?? "#555",
    fontFamily: "inherit", lineHeight: 1, flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
  });
  return (
    <div style={{ marginBottom: 14 }}>
      <Label>{label}</Label>
      <div style={{
        display: "flex", alignItems: "stretch",
        borderWidth: "1px", borderStyle: "solid", borderColor: gs.fieldBorderColor ?? "#e2e2e2",
        borderRadius: gs.fieldBorderRadius ?? 6, overflow: "hidden",
      }}>
        <button
          onMouseDown={e => { e.preventDefault(); e.stopPropagation(); if (!atMin) startHold(dec); }}
          onMouseUp={stopHold} onMouseLeave={stopHold}
          disabled={atMin} style={btnStyle(atMin)}
        >−</button>
        <input
          ref={stepInputRef}
          type="text" value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === "Enter") { commit(); (e.target as HTMLInputElement).blur(); } if (e.key === "Escape") { setInputVal(fmt(value)); (e.target as HTMLInputElement).blur(); } }}
          onMouseDown={e => {
            if (e.button === 1) {
              const startValue = value;
              startMiddleDragAdjust(e, steps =>
                onChange(Math.max(min, Math.min(max, Number((startValue + steps * step).toFixed(4)))))
              );
              return;
            }
            e.stopPropagation();
          }}
          style={{
            flex: 1, border: "none", outline: "none",
            textAlign: "center", fontSize: 13, color: gs.fieldTextColor ?? "#222",
            fontFamily: "monospace", padding: "8px 4px",
            background: gs.fieldBg ?? "#fff", minWidth: 0,
          }}
        />
        <button
          onMouseDown={e => { e.preventDefault(); e.stopPropagation(); if (!atMax) startHold(inc); }}
          onMouseUp={stopHold} onMouseLeave={stopHold}
          disabled={atMax} style={btnStyle(atMax)}
        >+</button>
      </div>
    </div>
  );
}

const TAB_ALIGN_CSS: Record<TabAlign, React.CSSProperties["alignSelf"]> = {
  top:    "flex-start",
  center: "center",
  bottom: "flex-end",
};

interface Props {
  isOpen: boolean;
  onToggle: () => void;
  globalSettings: GlobalSettings;
  selectedNodes: NodeData[];
  selectedConns: ConnectionData[];
  selectedImages: ImageNodeData[];
  fromNode: NodeData | null;
  toNode: NodeData | null;
  onUpdateNode: (id: number, updates: Partial<NodeData>) => void;
  onUpdateConn: (id: number, updates: Partial<ConnectionData>) => void;
  onUpdateImage: (id: number, updates: Partial<ImageNodeData>) => void;
  onUpdateAllImages: (updates: Partial<ImageNodeData>) => void;
  onUpdateAllNodes: (updates: Partial<NodeData>) => void;
  onUpdateAllConns: (updates: Partial<ConnectionData>) => void;
  onSendToFront: (id: number) => void;
  onSendToBack: (id: number) => void;
  onSendImageToFront: (id: number) => void;
  onSendImageToBack: (id: number) => void;
}

export default function Sidebar({
  isOpen, onToggle, globalSettings,
  selectedNodes, selectedConns, selectedImages, fromNode, toNode,
  onUpdateNode, onUpdateConn, onUpdateImage, onUpdateAllNodes, onUpdateAllConns,
  onSendToFront, onSendToBack, onSendImageToFront, onSendImageToBack,
}: Props) {
  const selectedNode = selectedNodes.length === 1 ? selectedNodes[0] : null;
  const selectedConn = selectedConns.length === 1 && selectedNodes.length === 0 ? selectedConns[0] : null;
  const selectedImage = selectedImages.length === 1 && selectedNodes.length === 0 && selectedConns.length === 0 ? selectedImages[0] : null;
  const gs = globalSettings;
  return (
    <div style={{
      position: "fixed", top: 0, right: 0, height: "100vh",
      display: "flex", flexDirection: "row", alignItems: "stretch",
      zIndex: 200, pointerEvents: "none",
    }}>
      {/* Toggle tab */}
      <div
        role="button"
        onClick={onToggle}
        title={isOpen ? "Close panel" : "Open properties"}
        style={{
          alignSelf: TAB_ALIGN_CSS[gs.tabAlign ?? "center"],
          width: gs.tabWidth ?? 44, height: gs.tabHeight ?? 156,
          background: gs.panelBg ?? "#fff",
          borderWidth: "1px 0 1px 1px", borderStyle: "solid", borderColor: gs.panelBorderColor ?? "#e0e0e0",
          borderRadius: `${gs.panelBorderRadius ?? 6}px 0 0 ${gs.panelBorderRadius ?? 6}px`,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", boxShadow: "-2px 0 8px rgba(0,0,0,0.07)",
          pointerEvents: "auto", fontSize: 13, color: gs.panelTextColor ?? "#888",
          userSelect: "none",
        }}
      >
        {isOpen ? "›" : "‹"}
      </div>

      {/* Clip wrapper — animates width, clips horizontal overflow during slide */}
      <div style={{
        width: isOpen ? PANEL_W : 0,
        flexShrink: 0,
        overflow: "hidden",
        transition: "width 0.22s cubic-bezier(0.4,0,0.2,1)",
        height: "100%",
      }}>
        {/* Inner panel — full width, no overflow:hidden so child scrollbar works */}
        <div style={{
          width: PANEL_W,
          height: "100%",
          background: gs.panelBg ?? "#fff",
          borderLeft: `1px solid ${gs.panelBorderColor ?? "#e0e0e0"}`,
          boxShadow: isOpen ? "-4px 0 24px rgba(0,0,0,0.07)" : "none",
          pointerEvents: "auto",
          display: "flex", flexDirection: "column",
        }}>
        <div
          className="scrollbar"
          data-noad-panel="true"
          style={(() => {
            const scrollMode = gs.scrollbarMode ?? "auto";
            return {
              width: PANEL_W, flex: 1, minHeight: 0, overflowY: "scroll", overflowX: "hidden",
              padding: "22px 22px 22px 18px", boxSizing: "border-box",
              scrollbarWidth: scrollMode === "none" ? "none" : scrollMode === "thin" ? "thin" : "auto",
              "--scrollbar-width": scrollMode === "none" ? "0px" : scrollMode === "thin" ? "4px" : `${gs.scrollbarWidth ?? 8}px`,
              "--scrollbar-track": gs.scrollbarBg ?? "#e8e8e8",
              "--scrollbar-thumb": gs.scrollbarBorderColor ?? "#bbbbbb",
              "--scrollbar-thumb-radius": `${gs.scrollbarBorderRadius ?? 4}px`,
              "--scrollbar-track-radius": `${gs.scrollbarBorderRadius ?? 4}px`,
              "--section-color": (gs.panelTextColor ?? "#444444") + "66",
              "--label-color": (gs.panelTextColor ?? "#444444") + "99",
            } as React.CSSProperties;
          })()}
        >

          <div style={{
            fontWeight: 700, fontSize: 12, color: gs.panelHeaderColor ?? gs.panelTextColor ?? "#444",
            textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 16,
          }}>
            Selection Properties
          </div>

          {/* ── Node ──────────────────────────────────────────────────────── */}
          {selectedNode && (() => {
            const n = selectedNode;
            const upd = (u: Partial<NodeData>) => onUpdateNode(n.id, u);
            return (
              <>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#bbb", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 12 }}>
                  Node #{n.id}
                </div>

                <SectionHeading first>Title</SectionHeading>
                <div style={{ marginBottom: 10 }}>
                  <input
                    type="text" value={n.title}
                    onChange={e => upd({ title: e.target.value })}
                    onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    onMouseDown={e => e.stopPropagation()}
                    placeholder="—"
                    style={inputStyle(gs)}
                  />
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "flex-end" }}>
                  <div style={{ flex: "0 0 72px" }}>
                    <FontSizeField value={n.titleFontSize ?? gs.titleFontSize ?? 12} onChange={v => upd({ titleFontSize: v })} gs={gs} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <Label>Align</Label>
                    <AlignToggle value={n.titleAlign ?? gs.titleAlign ?? "left"} onChange={v => upd({ titleAlign: v })} gs={gs} />
                  </div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <Label>Style</Label>
                  <StyleToggle value={n.titleStyle ?? "bold"} onChange={v => upd({ titleStyle: v })} gs={gs} />
                </div>
                <ColorField label="Color" value={n.titleColor ?? gs.boxTitleColor ?? "#444444"} onChange={v => upd({ titleColor: v })} gs={gs} />

                <Divider />

                <SectionHeading>Content</SectionHeading>
                <div style={{ marginBottom: 10 }}>
                  <textarea
                    value={n.text}
                    onChange={e => upd({ text: e.target.value })}
                    onMouseDown={e => e.stopPropagation()}
                    rows={3}
                    style={{ ...inputStyle(gs), resize: "vertical", lineHeight: 1.5, height: "auto" }}
                  />
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "flex-end" }}>
                  <div style={{ flex: "0 0 72px" }}>
                    <FontSizeField value={n.textFontSize ?? gs.textFontSize ?? 14} onChange={v => upd({ textFontSize: v })} gs={gs} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <Label>Align</Label>
                    <AlignToggle value={n.textAlign ?? gs.textAlign ?? "center"} onChange={v => upd({ textAlign: v })} gs={gs} />
                  </div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <Label>Style</Label>
                  <StyleToggle value={n.textStyle ?? "normal"} onChange={v => upd({ textStyle: v })} gs={gs} />
                </div>
                <ColorField label="Color" value={n.textColor ?? gs.boxTextColor ?? "#1a1a1a"} onChange={v => upd({ textColor: v })} gs={gs} />
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: "var(--label-color, #999)", marginBottom: 3, letterSpacing: 0.2 }}>Text fill</div>
                  <button
                    onMouseDown={e => e.stopPropagation()}
                    onClick={() => upd({ textFill: !n.textFill })}
                    style={{
                      width: "100%", padding: "6px 0",
                      borderRadius: gs.fieldBorderRadius ?? 6,
                      borderWidth: 1, borderStyle: "solid",
                      borderColor: n.textFill ? (gs.confirmBg ?? "#378ADD") : (gs.fieldBorderColor ?? "#e2e2e2"),
                      background: n.textFill ? ((gs.confirmBg ?? "#378ADD") + "22") : "transparent",
                      color: n.textFill ? (gs.confirmBg ?? "#378ADD") : (gs.fieldTextColor ?? "#444"),
                      fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    {n.textFill ? "On" : "Off"}
                  </button>
                </div>

                <Divider />

                <SectionHeading>Node Style</SectionHeading>
                <ColorField label="Background" value={n.bg ?? gs.boxBg} onChange={v => upd({ bg: v })} gs={gs} />
                <ColorField label="Border color" value={n.borderColor ?? gs.boxBorderColor} onChange={v => upd({ borderColor: v })} gs={gs} />
                <StepperField label="Border thickness" value={n.borderThickness ?? gs.boxBorderThickness} onChange={v => upd({ borderThickness: v })} min={0} max={20} step={0.5} gs={gs} />
                <StepperField label="Rounded Corner" value={n.borderRadius ?? gs.boxBorderRadius} onChange={v => upd({ borderRadius: v })} min={0} max={100} step={1} gs={gs} />

                <Divider />

                <SectionHeading>Position & Size</SectionHeading>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 10px" }}>
                  <NumField label="X" value={n.x} onChange={v => upd({ x: v })} gs={gs} />
                  <NumField label="Y" value={n.y} onChange={v => upd({ y: v })} gs={gs} />
                  <NumField label="Width" value={n.width} onChange={v => upd({ width: Math.max(80, v) })} min={80} gs={gs} />
                  <NumField label="Height" value={n.height} onChange={v => upd({ height: Math.max(40, v) })} min={40} gs={gs} />
                </div>

                <Divider />

                <SectionHeading>Layer</SectionHeading>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onMouseDown={e => { e.preventDefault(); e.stopPropagation(); }}
                    onClick={() => onSendToFront(n.id)}
                    style={{
                      flex: 1, padding: "7px 0",
                      borderWidth: "1px", borderStyle: "solid", borderColor: gs.fieldBorderColor ?? "#e2e2e2",
                      borderRadius: gs.fieldBorderRadius ?? 6,
                      background: gs.fieldBg ?? "#f7f7f7", color: gs.fieldTextColor ?? "#555",
                      fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                    }}
                  >To Front</button>
                  <button
                    onMouseDown={e => { e.preventDefault(); e.stopPropagation(); }}
                    onClick={() => onSendToBack(n.id)}
                    style={{
                      flex: 1, padding: "7px 0",
                      borderWidth: "1px", borderStyle: "solid", borderColor: gs.fieldBorderColor ?? "#e2e2e2",
                      borderRadius: gs.fieldBorderRadius ?? 6,
                      background: gs.fieldBg ?? "#f7f7f7", color: gs.fieldTextColor ?? "#555",
                      fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                    }}
                  >To Back</button>
                </div>
              </>
            );
          })()}

          {/* ── Connection ────────────────────────────────────────────────── */}
          {selectedConn && !selectedNode && (
            <>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#bbb", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 12 }}>
                Connection #{selectedConn.id}
              </div>

              <div style={{ marginBottom: 14 }}>
                <Label>Arrowheads</Label>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onMouseDown={e => { e.preventDefault(); e.stopPropagation(); }}
                    onClick={() => onUpdateConn(selectedConn.id, { arrowStart: !selectedConn.arrowStart })}
                    title="Toggle start arrowhead"
                    style={{
                      flex: 1, padding: "6px 0",
                      borderWidth: "1px", borderStyle: "solid", borderColor: gs.fieldBorderColor ?? "#e2e2e2",
                      borderRadius: gs.fieldBorderRadius ?? 6,
                      fontSize: 18, cursor: "pointer", fontFamily: "inherit",
                      background: selectedConn.arrowStart ? (gs.highlightBg ?? "#378ADD") : (gs.fieldBg ?? "#f7f7f7"),
                      color: selectedConn.arrowStart ? (gs.highlightTextColor ?? "#fff") : (gs.fieldTextColor ?? "#888"),
                      fontWeight: 700, lineHeight: 1,
                    }}
                  >&#8592;</button>
                  <button
                    onMouseDown={e => { e.preventDefault(); e.stopPropagation(); }}
                    onClick={() => onUpdateConn(selectedConn.id, { arrowEnd: !selectedConn.arrowEnd })}
                    title="Toggle end arrowhead"
                    style={{
                      flex: 1, padding: "6px 0",
                      borderWidth: "1px", borderStyle: "solid", borderColor: gs.fieldBorderColor ?? "#e2e2e2",
                      borderRadius: gs.fieldBorderRadius ?? 6,
                      fontSize: 18, cursor: "pointer", fontFamily: "inherit",
                      background: selectedConn.arrowEnd ? (gs.highlightBg ?? "#378ADD") : (gs.fieldBg ?? "#f7f7f7"),
                      color: selectedConn.arrowEnd ? (gs.highlightTextColor ?? "#fff") : (gs.fieldTextColor ?? "#888"),
                      fontWeight: 700, lineHeight: 1,
                    }}
                  >&#8594;</button>
                </div>
              </div>

              <Divider />
              <SectionHeading>Style</SectionHeading>
              <ColorField label="Color" value={selectedConn.color ?? gs.arrowColor} onChange={v => onUpdateConn(selectedConn.id, { color: v })} gs={gs} />
              <StepperField label="Line thickness" value={selectedConn.lineThickness ?? gs.lineThickness} onChange={v => onUpdateConn(selectedConn.id, { lineThickness: v })} min={0.5} max={20} step={0.5} gs={gs} />
              <StepperField label="Arrow size" value={selectedConn.arrowSize ?? gs.arrowSize} onChange={v => onUpdateConn(selectedConn.id, { arrowSize: v })} min={0.25} max={4} step={0.05} gs={gs} />

              <div style={{ marginBottom: 14 }}>
                <Label>Layer</Label>
                <div style={{
                  display: "flex",
                  borderWidth: "1px", borderStyle: "solid", borderColor: gs.fieldBorderColor ?? "#e2e2e2",
                  borderRadius: gs.fieldBorderRadius ?? 6, overflow: "hidden",
                }}>
                  {([
                    { label: "Front", isBehind: false },
                    { label: "Back",  isBehind: true },
                  ] as { label: string; isBehind: boolean }[]).map(({ label, isBehind }, i) => {
                    const effBehind = selectedConn.behindNodes !== undefined
                      ? selectedConn.behindNodes
                      : !(gs.synapsesAboveNodes ?? true);
                    const active = isBehind ? effBehind : !effBehind;
                    return (
                      <button
                        key={label}
                        onMouseDown={e => { e.preventDefault(); e.stopPropagation(); }}
                        onClick={() => onUpdateConn(selectedConn.id, { behindNodes: isBehind })}
                        style={{
                          flex: 1, padding: "8px 0", border: "none",
                          borderLeftWidth: i > 0 ? "1px" : "0",
                          borderLeftStyle: "solid",
                          borderLeftColor: gs.fieldBorderColor ?? "#e2e2e2",
                          background: active ? (gs.highlightBg ?? "#378ADD") : (gs.fieldBg ?? "#f7f7f7"),
                          color: active ? (gs.highlightTextColor ?? "#fff") : (gs.fieldTextColor ?? "#888"),
                          cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "inherit",
                        }}
                      >{label}</button>
                    );
                  })}
                </div>
              </div>

              <Divider />
              <SectionHeading>Nodes</SectionHeading>
              <ReadRow
                label="From"
                value={fromNode ? `Node #${fromNode.id}${fromNode.title ? ` · ${plainText(fromNode.title).slice(0, 20)}` : ""} (${selectedConn.fromSide})` : `Node #${selectedConn.fromId} (${selectedConn.fromSide})`}
                gs={gs}
              />
              <ReadRow
                label="To"
                value={toNode ? `Node #${toNode.id}${toNode.title ? ` · ${plainText(toNode.title).slice(0, 20)}` : ""} (${selectedConn.toSide})` : `Node #${selectedConn.toId} (${selectedConn.toSide})`}
                gs={gs}
              />
              <ReadRow label="Waypoints" value={String(selectedConn.bends?.length ?? 0)} gs={gs} />
            </>
          )}

          {/* ── Image ─────────────────────────────────────────────────────── */}
          {selectedImage && (() => {
            const im = selectedImage;
            const upd = (u: Partial<ImageNodeData>) => onUpdateImage(im.id, u);
            return (
              <>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#bbb", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 12 }}>
                  Image #{im.id}
                </div>

                <SectionHeading first>Position & Size</SectionHeading>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 10px" }}>
                  <NumField label="X" value={im.x} onChange={v => upd({ x: v })} gs={gs} />
                  <NumField label="Y" value={im.y} onChange={v => upd({ y: v })} gs={gs} />
                  <NumField label="Width" value={im.width} onChange={v => upd({ width: Math.max(20, v) })} min={20} gs={gs} />
                  <NumField label="Height" value={im.height} onChange={v => upd({ height: Math.max(20, v) })} min={20} gs={gs} />
                </div>

                <Divider />

                <SectionHeading>Layer</SectionHeading>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onMouseDown={e => { e.preventDefault(); e.stopPropagation(); }}
                    onClick={() => onSendImageToFront(im.id)}
                    style={{
                      flex: 1, padding: "7px 0",
                      borderWidth: "1px", borderStyle: "solid", borderColor: gs.fieldBorderColor ?? "#e2e2e2",
                      borderRadius: gs.fieldBorderRadius ?? 6,
                      background: gs.fieldBg ?? "#f7f7f7", color: gs.fieldTextColor ?? "#555",
                      fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                    }}
                  >To Front</button>
                  <button
                    onMouseDown={e => { e.preventDefault(); e.stopPropagation(); }}
                    onClick={() => onSendImageToBack(im.id)}
                    style={{
                      flex: 1, padding: "7px 0",
                      borderWidth: "1px", borderStyle: "solid", borderColor: gs.fieldBorderColor ?? "#e2e2e2",
                      borderRadius: gs.fieldBorderRadius ?? 6,
                      background: gs.fieldBg ?? "#f7f7f7", color: gs.fieldTextColor ?? "#555",
                      fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                    }}
                  >To Back</button>
                </div>
              </>
            );
          })()}

          {/* ── Multi-image edit ─────────────────────────────────────────── */}
          {selectedImages.length > 1 && selectedNodes.length === 0 && selectedConns.length === 0 && (
            <div style={{ fontSize: 11, fontWeight: 600, color: "#bbb", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 12 }}>
              {selectedImages.length} images selected
            </div>
          )}

          {/* ── Multi-node edit ───────────────────────────────────────── */}
          {selectedNodes.length > 1 && selectedConns.length === 0 && (() => {
            const rep = selectedNodes[0];
            return (
              <>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#bbb", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 12 }}>
                  {selectedNodes.length} nodes selected
                </div>
                <SectionHeading first>Node Style</SectionHeading>
                <ColorField label="Background" value={rep.bg ?? gs.boxBg} onChange={v => onUpdateAllNodes({ bg: v })} gs={gs} />
                <ColorField label="Border color" value={rep.borderColor ?? gs.boxBorderColor} onChange={v => onUpdateAllNodes({ borderColor: v })} gs={gs} />
                <StepperField label="Border thickness" value={rep.borderThickness ?? gs.boxBorderThickness} onChange={v => onUpdateAllNodes({ borderThickness: v })} min={0} max={20} step={0.5} gs={gs} />
                <StepperField label="Rounded Corner" value={rep.borderRadius ?? gs.boxBorderRadius} onChange={v => onUpdateAllNodes({ borderRadius: v })} min={0} max={100} step={1} gs={gs} />
                <Divider />
                <SectionHeading>Title</SectionHeading>
                <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "flex-end" }}>
                  <div style={{ flex: "0 0 72px" }}>
                    <FontSizeField value={rep.titleFontSize ?? gs.titleFontSize ?? 12} onChange={v => onUpdateAllNodes({ titleFontSize: v })} gs={gs} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <Label>Align</Label>
                    <AlignToggle value={rep.titleAlign ?? gs.titleAlign ?? "left"} onChange={v => onUpdateAllNodes({ titleAlign: v })} gs={gs} />
                  </div>
                </div>
                <ColorField label="Title color" value={rep.titleColor ?? gs.boxTitleColor ?? "#444444"} onChange={v => onUpdateAllNodes({ titleColor: v })} gs={gs} />
                <Divider />
                <SectionHeading>Content</SectionHeading>
                <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "flex-end" }}>
                  <div style={{ flex: "0 0 72px" }}>
                    <FontSizeField value={rep.textFontSize ?? gs.textFontSize ?? 14} onChange={v => onUpdateAllNodes({ textFontSize: v })} gs={gs} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <Label>Align</Label>
                    <AlignToggle value={rep.textAlign ?? gs.textAlign ?? "center"} onChange={v => onUpdateAllNodes({ textAlign: v })} gs={gs} />
                  </div>
                </div>
                <ColorField label="Content color" value={rep.textColor ?? gs.boxTextColor ?? "#1a1a1a"} onChange={v => onUpdateAllNodes({ textColor: v })} gs={gs} />
              </>
            );
          })()}

          {/* ── Multi-connection edit ──────────────────────────────────── */}
          {selectedConns.length > 1 && selectedNodes.length === 0 && (() => {
            const rep = selectedConns[0];
            return (
              <>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#bbb", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 12 }}>
                  {selectedConns.length} connections selected
                </div>
                <div style={{ marginBottom: 14 }}>
                  <Label>Arrowheads</Label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onMouseDown={e => { e.preventDefault(); e.stopPropagation(); }}
                      onClick={() => onUpdateAllConns({ arrowStart: !rep.arrowStart })}
                      title="Toggle start arrowhead"
                      style={{
                        flex: 1, padding: "6px 0",
                        borderWidth: "1px", borderStyle: "solid", borderColor: gs.fieldBorderColor ?? "#e2e2e2",
                        borderRadius: gs.fieldBorderRadius ?? 6,
                        fontSize: 18, cursor: "pointer", fontFamily: "inherit",
                        background: rep.arrowStart ? "#378ADD" : (gs.fieldBg ?? "#f7f7f7"),
                        color: rep.arrowStart ? "#fff" : (gs.fieldTextColor ?? "#888"),
                        fontWeight: 700, lineHeight: 1,
                      }}
                    >&#8592;</button>
                    <button
                      onMouseDown={e => { e.preventDefault(); e.stopPropagation(); }}
                      onClick={() => onUpdateAllConns({ arrowEnd: !rep.arrowEnd })}
                      title="Toggle end arrowhead"
                      style={{
                        flex: 1, padding: "6px 0",
                        borderWidth: "1px", borderStyle: "solid", borderColor: gs.fieldBorderColor ?? "#e2e2e2",
                        borderRadius: gs.fieldBorderRadius ?? 6,
                        fontSize: 18, cursor: "pointer", fontFamily: "inherit",
                        background: rep.arrowEnd ? "#378ADD" : (gs.fieldBg ?? "#f7f7f7"),
                        color: rep.arrowEnd ? "#fff" : (gs.fieldTextColor ?? "#888"),
                        fontWeight: 700, lineHeight: 1,
                      }}
                    >&#8594;</button>
                  </div>
                </div>
                <SectionHeading>Style</SectionHeading>
                <ColorField label="Color" value={rep.color ?? gs.arrowColor} onChange={v => onUpdateAllConns({ color: v })} gs={gs} />
                <StepperField label="Line thickness" value={rep.lineThickness ?? gs.lineThickness} onChange={v => onUpdateAllConns({ lineThickness: v })} min={0.5} max={20} step={0.5} gs={gs} />
                <StepperField label="Arrow size" value={rep.arrowSize ?? gs.arrowSize} onChange={v => onUpdateAllConns({ arrowSize: v })} min={0.25} max={4} step={0.05} gs={gs} />
                <div style={{ marginBottom: 14 }}>
                  <Label>Layer</Label>
                  <div style={{
                    display: "flex",
                    borderWidth: "1px", borderStyle: "solid", borderColor: gs.fieldBorderColor ?? "#e2e2e2",
                    borderRadius: gs.fieldBorderRadius ?? 6, overflow: "hidden",
                  }}>
                    {([
                      { label: "Front", isBehind: false },
                      { label: "Back",  isBehind: true },
                    ] as { label: string; isBehind: boolean }[]).map(({ label, isBehind }, i) => {
                      const effBehind = rep.behindNodes !== undefined
                        ? rep.behindNodes
                        : !(gs.synapsesAboveNodes ?? true);
                      const active = isBehind ? effBehind : !effBehind;
                      return (
                        <button
                          key={label}
                          onMouseDown={e => { e.preventDefault(); e.stopPropagation(); }}
                          onClick={() => onUpdateAllConns({ behindNodes: isBehind })}
                          style={{
                            flex: 1, padding: "8px 0", border: "none",
                            borderLeftWidth: i > 0 ? "1px" : "0",
                            borderLeftStyle: "solid",
                            borderLeftColor: gs.fieldBorderColor ?? "#e2e2e2",
                            background: active ? (gs.highlightBg ?? "#378ADD") : (gs.fieldBg ?? "#f7f7f7"),
                            color: active ? (gs.highlightTextColor ?? "#fff") : (gs.fieldTextColor ?? "#888"),
                            cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "inherit",
                          }}
                        >{label}</button>
                      );
                    })}
                  </div>
                </div>
              </>
            );
          })()}

          {!selectedNode && !selectedConn && !selectedImage &&
            selectedNodes.length === 0 && selectedConns.length === 0 && selectedImages.length === 0 && (
            <div style={{ fontSize: 12, color: "#bbb", lineHeight: 1.7 }}>
              Select a node, connection, or image to view its properties.
            </div>
          )}

        </div>
        </div> {/* inner panel */}
      </div> {/* clip wrapper */}
    </div>
  );
}
