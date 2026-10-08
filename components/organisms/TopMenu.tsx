"use client";

import { useState, useEffect, useRef } from "react";
import type { GlobalSettings, TabAlign } from "@/lib/canvasTypes";
import { ColorField } from "@/components/molecules/ColorField";
import { startMiddleDragAdjust } from "@/lib/dragAdjust";
import { useWheelAdjust } from "@/lib/useWheelAdjust";

interface Props {
  isOpen: boolean;
  onToggle: () => void;
  nodeCount: number;
  connCount: number;
  onClearCanvas: () => void;
  globalSettings: GlobalSettings;
  onUpdate: (updates: Partial<GlobalSettings>) => void;
}

// ── Shared atoms ──────────────────────────────────────────────────────────────

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

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, color: "var(--label-color, #999)", marginBottom: 3, letterSpacing: 0.2 }}>
      {children}
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
  const r = gs.fieldBorderRadius ?? 6;
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
        borderRadius: r, overflow: "hidden",
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

function Checkbox({ label, checked, onChange, gs }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; gs: GlobalSettings;
}) {
  return (
    <label style={{
      display: "flex", alignItems: "center", gap: 8, marginBottom: 14,
      fontSize: 12, color: gs.fieldTextColor ?? "#444", cursor: "pointer", userSelect: "none",
    }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      {label}
    </label>
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
        style={{
          width: "100%", boxSizing: "border-box", padding: "8px 10px",
          borderWidth: "1px", borderStyle: "solid", borderColor: gs.fieldBorderColor ?? "#e2e2e2",
          borderRadius: gs.fieldBorderRadius ?? 6,
          fontSize: 13, color: gs.fieldTextColor ?? "#222",
          outline: "none", fontFamily: "inherit",
          background: gs.fieldBg ?? "#f7f7f7",
        }}
      />
    </div>
  );
}

const TAB_ALIGN_ICONS: Record<TabAlign, React.ReactNode> = {
  top: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <rect x="0" y="0" width="14" height="2" rx="1"/>
      <rect x="3" y="4" width="8" height="7" rx="1"/>
    </svg>
  ),
  center: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <rect x="3" y="2" width="8" height="10" rx="1"/>
      <rect x="0" y="6" width="2" height="2"/>
      <rect x="12" y="6" width="2" height="2"/>
    </svg>
  ),
  bottom: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <rect x="3" y="3" width="8" height="7" rx="1"/>
      <rect x="0" y="12" width="14" height="2" rx="1"/>
    </svg>
  ),
};

// ── TopMenu ───────────────────────────────────────────────────────────────────

export default function TopMenu({
  isOpen, onToggle, nodeCount, connCount,
  onClearCanvas, globalSettings: gs, onUpdate,
}: Props) {
  const [confirmClear, setConfirmClear] = useState(false);
  useEffect(() => { if (!isOpen) setConfirmClear(false); }, [isOpen]);

  const r    = gs.panelBorderRadius ?? 6;
  const bg   = gs.panelBg ?? "#ffffff";
  const bord = gs.panelBorderColor ?? "#e0e0e0";
  const txt     = gs.panelTextColor ?? "#444444";
  const hdrTxt  = gs.panelHeaderColor ?? txt;
  const fr   = gs.fieldBorderRadius ?? 6;

  return (
    // Anchored to the top edge — panel drops DOWN, tab sits below it
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0,
      display: "flex", flexDirection: "column",
      zIndex: 210, pointerEvents: "none",
    }}>

      {/* ── Centered column: panel + toggle tab ─────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", filter: confirmClear ? "blur(4px)" : "none", transition: "filter 0.15s" }}>

        {/* Sliding panel — scrollable, drops DOWN with the tab */}
        <div
          className="scrollbar"
          data-noad-panel="true"
          style={(() => {
            const scrollMode = gs.scrollbarMode ?? "auto";
            return {
              width: "30vw",
              maxHeight: isOpen ? 600 : 0,
              overflowY: "scroll",
              overflowX: "hidden",
              transition: "max-height 0.22s cubic-bezier(0.4,0,0.2,1), box-shadow 0.22s",
              background: bg,
              boxShadow: isOpen ? "0 4px 24px rgba(0,0,0,0.07)" : "0 4px 24px rgba(0,0,0,0)",
              pointerEvents: "auto",
              boxSizing: "border-box",
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
            padding: "14px 22px 20px",
            borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 0, borderLeftWidth: 1,
            borderStyle: "solid", borderColor: bord,
          }}>

            <div style={{
              fontWeight: 700, fontSize: 12, color: hdrTxt,
              textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              Look and Feel
            </div>

            {/* Compact overview */}
            <div style={{ fontSize: 10, color: "#bbb", marginBottom: 14, display: "flex", gap: 12 }}>
              <span><span style={{ fontWeight: 700, color: "#888" }}>{nodeCount}</span> nodes</span>
              <span><span style={{ fontWeight: 700, color: "#888" }}>{connCount}</span> connections</span>
            </div>

            {/* Canvas background */}
            <SectionHeading first>Canvas</SectionHeading>
            <ColorField label="Background" value={gs.canvasBg} onChange={v => onUpdate({ canvasBg: v })} gs={gs} />

            {/* Panel styling */}
            <SectionHeading>Panels</SectionHeading>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
              <ColorField label="Background" value={gs.panelBg ?? "#ffffff"} onChange={v => onUpdate({ panelBg: v })} gs={gs} />
              <ColorField label="Border" value={gs.panelBorderColor ?? "#e0e0e0"} onChange={v => onUpdate({ panelBorderColor: v })} gs={gs} />
              <ColorField label="Header text" value={gs.panelHeaderColor ?? gs.panelTextColor ?? "#444444"} onChange={v => onUpdate({ panelHeaderColor: v })} gs={gs} />
              <ColorField label="Text" value={gs.panelTextColor ?? "#444444"} onChange={v => onUpdate({ panelTextColor: v })} gs={gs} />
              <StepperField label="Rounded Corner" value={gs.panelBorderRadius ?? 6} onChange={v => onUpdate({ panelBorderRadius: v })} min={0} max={24} step={1} gs={gs} />
              <div />
              <ColorField label="Color picker bg" value={gs.colorPickerBg ?? "#f7f7f7"} onChange={v => onUpdate({ colorPickerBg: v })} gs={gs} />
              <StepperField label="Color picker radius" value={gs.colorPickerBorderRadius ?? 13} onChange={v => onUpdate({ colorPickerBorderRadius: v })} min={0} max={13} step={1} gs={gs} />
              <ColorField label="Highlight bg" value={gs.highlightBg ?? "#378ADD"} onChange={v => onUpdate({ highlightBg: v })} gs={gs} />
              <ColorField label="Highlight text" value={gs.highlightTextColor ?? "#ffffff"} onChange={v => onUpdate({ highlightTextColor: v })} gs={gs} />
              <ColorField label="Confirm/Save bg" value={gs.confirmBg ?? "#378ADD"} onChange={v => onUpdate({ confirmBg: v })} gs={gs} />
              <ColorField label="Confirm/Save text" value={gs.confirmTextColor ?? "#ffffff"} onChange={v => onUpdate({ confirmTextColor: v })} gs={gs} />
              <ColorField label="Confirm/Save border" value={gs.confirmBorderColor ?? "#378ADD"} onChange={v => onUpdate({ confirmBorderColor: v })} gs={gs} />
            </div>

            {/* Field / element styling */}
            <SectionHeading>Fields</SectionHeading>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
              <ColorField label="Background" value={gs.fieldBg ?? "#f7f7f7"} onChange={v => onUpdate({ fieldBg: v })} gs={gs} />
              <ColorField label="Border" value={gs.fieldBorderColor ?? "#e2e2e2"} onChange={v => onUpdate({ fieldBorderColor: v })} gs={gs} />
              <ColorField label="Text" value={gs.fieldTextColor ?? "#222222"} onChange={v => onUpdate({ fieldTextColor: v })} gs={gs} />
              <StepperField label="Rounded Corner" value={gs.fieldBorderRadius ?? 6} onChange={v => onUpdate({ fieldBorderRadius: v })} min={0} max={24} step={1} gs={gs} />
            </div>

            {/* Scrollbars */}
            <SectionHeading>Scrollbars</SectionHeading>
            <div style={{ marginBottom: 14 }}>
              <Label>Width</Label>
              <div style={{
                display: "flex",
                borderWidth: "1px", borderStyle: "solid", borderColor: gs.fieldBorderColor ?? "#e2e2e2",
                borderRadius: fr, overflow: "hidden",
              }}>
                {(["auto", "thin", "none"] as const).map((mode, i) => (
                  <button
                    key={mode}
                    onMouseDown={e => { e.preventDefault(); e.stopPropagation(); }}
                    onClick={() => {
                      const widthMap = { auto: gs.scrollbarWidth ?? 8, thin: 4, none: 0 };
                      onUpdate({ scrollbarMode: mode, scrollbarWidth: widthMap[mode] });
                    }}
                    style={{
                      flex: 1, padding: "8px 0", border: "none",
                      borderLeftWidth: i > 0 ? "1px" : "0",
                      borderLeftStyle: "solid",
                      borderLeftColor: gs.fieldBorderColor ?? "#e2e2e2",
                      background: (gs.scrollbarMode ?? "auto") === mode ? (gs.highlightBg ?? "#378ADD") : (gs.fieldBg ?? "#f7f7f7"),
                      color: (gs.scrollbarMode ?? "auto") === mode ? (gs.highlightTextColor ?? "#fff") : (gs.fieldTextColor ?? "#888"),
                      cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit",
                      textTransform: "capitalize",
                    }}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
              <StepperField label="Radius" value={gs.scrollbarBorderRadius ?? 4} onChange={v => onUpdate({ scrollbarBorderRadius: v })} min={0} max={12} step={1} gs={gs} />
              <div />
              <ColorField label="Background" value={gs.scrollbarBg ?? "#e8e8e8"} onChange={v => onUpdate({ scrollbarBg: v })} gs={gs} />
              <ColorField label="Thumb" value={gs.scrollbarBorderColor ?? "#bbbbbb"} onChange={v => onUpdate({ scrollbarBorderColor: v })} gs={gs} />
            </div>

            {/* Selection */}
            <SectionHeading>Selection</SectionHeading>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
              <ColorField label="Fill" value={gs.selectionBg ?? "#378ADD"} onChange={v => onUpdate({ selectionBg: v })} gs={gs} />
              <ColorField label="Border" value={gs.selectionBorderColor ?? "#378ADD"} onChange={v => onUpdate({ selectionBorderColor: v })} gs={gs} />
              <StepperField label="Radius" value={gs.selectionBorderRadius ?? 4} onChange={v => onUpdate({ selectionBorderRadius: v })} min={0} max={32} step={1} gs={gs} />
              <div />
              <ColorField label="Highlighted color" value={gs.selectionHighlightColor ?? "#378ADD"} onChange={v => onUpdate({ selectionHighlightColor: v })} gs={gs} />
              <StepperField label="Highlighted brightness" value={gs.selectionHighlightBrightness ?? 0.5} onChange={v => onUpdate({ selectionHighlightBrightness: v })} min={0} max={1} step={0.05} gs={gs} />
            </div>

            {/* Sidebar tabs */}
            <SectionHeading>Sidebar tabs</SectionHeading>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
              <NumField label="Width" value={gs.tabWidth ?? 44} onChange={v => onUpdate({ tabWidth: Math.max(16, Math.min(120, v)) })} min={16} max={120} gs={gs} />
              <NumField label="Height" value={gs.tabHeight ?? 156} onChange={v => onUpdate({ tabHeight: Math.max(20, Math.min(400, v)) })} min={20} max={400} gs={gs} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <Label>Position</Label>
              <div style={{ display: "flex", gap: 6 }}>
                {(["top", "center", "bottom"] as TabAlign[]).map(v => (
                  <button
                    key={v}
                    title={v.charAt(0).toUpperCase() + v.slice(1)}
                    onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onUpdate({ tabAlign: v }); }}
                    style={{
                      flex: 1, padding: "7px 0",
                      borderWidth: "1px", borderStyle: "solid", borderColor: gs.fieldBorderColor ?? "#e2e2e2",
                      borderRadius: fr,
                      background: (gs.tabAlign ?? "center") === v ? (gs.highlightBg ?? "#378ADD") : (gs.fieldBg ?? "#f7f7f7"),
                      color: (gs.tabAlign ?? "center") === v ? (gs.highlightTextColor ?? "#fff") : (gs.fieldTextColor ?? "#aaa"),
                      cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    {TAB_ALIGN_ICONS[v]}
                  </button>
                ))}
              </div>
            </div>
            <Checkbox
              label="Properties Opens Automatically"
              checked={gs.propertiesAutoOpen ?? true}
              onChange={v => onUpdate({ propertiesAutoOpen: v })}
              gs={gs}
            />

            {/* Nodes */}
            <SectionHeading>Nodes</SectionHeading>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
              <StepperField label="Nudge px" value={gs.nodeMoveStep ?? 4} onChange={v => onUpdate({ nodeMoveStep: v })} min={1} max={100} step={1} gs={gs} />
              <StepperField label="Jump px" value={gs.nodeMoveJump ?? 100} onChange={v => onUpdate({ nodeMoveJump: v })} min={1} max={1000} step={10} gs={gs} />
            </div>

            {/* Hints */}
            <SectionHeading>Hints</SectionHeading>
            <button
              onMouseDown={e => { e.preventDefault(); e.stopPropagation(); }}
              onClick={() => onUpdate({ showHints: !(gs.showHints ?? true) })}
              style={{
                width: "100%", padding: "9px 0",
                borderWidth: "1px", borderStyle: "solid",
                borderColor: (gs.showHints ?? true) ? gs.fieldBorderColor ?? "#e2e2e2" : "#bbb",
                borderRadius: fr,
                background: (gs.showHints ?? true) ? (gs.highlightBg ?? "#378ADD") : (gs.fieldBg ?? "#f7f7f7"),
                color: (gs.showHints ?? true) ? (gs.highlightTextColor ?? "#fff") : (gs.fieldTextColor ?? "#888"),
                fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              {(gs.showHints ?? true) ? "Hints: ON" : "Hints: OFF"}
            </button>

            {/* Controls */}
            <SectionHeading>Controls</SectionHeading>
            <StepperField label="Zoom speed" value={gs.zoomSpeed ?? 1.12} onChange={v => onUpdate({ zoomSpeed: v })} min={1.01} max={2.0} step={0.01} gs={gs} />

            {/* Actions */}
            <SectionHeading>Actions</SectionHeading>
            <button
              onMouseDown={e => { e.preventDefault(); e.stopPropagation(); }}
              onClick={() => setConfirmClear(true)}
              style={{
                width: "100%", padding: "9px 0",
                borderWidth: "1px", borderStyle: "solid", borderColor: "#ffd0d0",
                borderRadius: fr, background: "#fff5f5", color: "#d44",
                fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Clear canvas
            </button>

          </div>
        </div>

        {/* Toggle tab — below panel, so it drops down and rolls up with it */}
        <div
          role="button"
          onClick={onToggle}
          title={isOpen ? "Close menu" : "Open menu"}
          style={{
            width: gs.tabHeight ?? 156, height: gs.tabWidth ?? 44,
            background: bg,
            borderTopWidth: isOpen ? 0 : 1,
            borderRightWidth: 1,
            borderBottomWidth: 1,
            borderLeftWidth: 1,
            borderStyle: "solid",
            borderColor: bord,
            borderTopLeftRadius: isOpen ? 0 : r,
            borderTopRightRadius: isOpen ? 0 : r,
            borderBottomLeftRadius: r,
            borderBottomRightRadius: r,
            transition: "border-top-left-radius 0.22s cubic-bezier(0.4,0,0.2,1), border-top-right-radius 0.22s cubic-bezier(0.4,0,0.2,1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
            pointerEvents: "auto", fontSize: 13, color: txt, userSelect: "none",
          }}
        >
          {isOpen ? "▲" : "▼"}
        </div>

      </div>

      {/* Centered confirmation modal — outside the blur wrapper so it stays sharp */}
      {confirmClear && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.12)",
            pointerEvents: "auto",
          }}
        >
          <div style={{
            background: bg,
            borderWidth: "1px", borderStyle: "solid", borderColor: bord,
            borderRadius: r,
            padding: "22px 24px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
            minWidth: 260,
            maxWidth: 340,
          }}>
            <div style={{ fontSize: 13, color: txt, marginBottom: 16, lineHeight: 1.6 }}>
              This will clear all nodes and synapses. Are you sure?
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onMouseDown={e => { e.preventDefault(); e.stopPropagation(); }}
                onClick={() => { onClearCanvas(); setConfirmClear(false); }}
                style={{
                  flex: 1, padding: "7px 0", border: "none",
                  borderRadius: fr, background: "#d44", color: "#fff",
                  fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                }}
              >Yes, clear</button>
              <button
                onMouseDown={e => { e.preventDefault(); e.stopPropagation(); }}
                onClick={() => setConfirmClear(false)}
                style={{
                  flex: 1, padding: "7px 0",
                  borderWidth: "1px", borderStyle: "solid", borderColor: gs.fieldBorderColor ?? "#e2e2e2",
                  borderRadius: fr, background: gs.fieldBg ?? "#f7f7f7", color: gs.fieldTextColor ?? "#555",
                  fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                }}
              >Cancel</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
