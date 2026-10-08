"use client";

import { useState, useEffect, useRef } from "react";
import type { GlobalSettings, TabAlign } from "@/lib/canvasTypes";
import { ColorField } from "@/components/molecules/ColorField";
import { startMiddleDragAdjust } from "@/lib/dragAdjust";
import { useWheelAdjust } from "@/lib/useWheelAdjust";

const PANEL_W = 270;

export const FONT_OPTIONS = [
  { label: "System default",   value: "sans-serif" },
  { label: "Inter",            value: "var(--font-inter)" },
  { label: "DM Sans",          value: "var(--font-dm-sans)" },
  { label: "Lato",             value: "var(--font-lato)" },
  { label: "Nunito",           value: "var(--font-nunito)" },
  { label: "Poppins",          value: "var(--font-poppins)" },
  { label: "Raleway",          value: "var(--font-raleway)" },
  { label: "Roboto",           value: "var(--font-roboto)" },
  { label: "Merriweather",     value: "var(--font-merriweather)" },
  { label: "Playfair Display", value: "var(--font-playfair)" },
  { label: "Source Code Pro",  value: "var(--font-source-code)" },
];

type Align = "left" | "center" | "right";

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


function FontSizeField({ label, value, onChange, gs }: {
  label: string; value: number; onChange: (v: number) => void; gs: GlobalSettings;
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
      <Label>{label}</Label>
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

function FontDropdown({ label, value, onChange, gs }: {
  label: string; value: string; onChange: (v: string) => void; gs: GlobalSettings;
}) {
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selected = FONT_OPTIONS.find(o => o.value === value) ?? FONT_OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!btnRef.current?.contains(e.target as Node) &&
          !listRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open) {
      const r = btnRef.current?.getBoundingClientRect();
      if (r) setDropPos({ top: r.bottom + 2, left: r.left, width: r.width });
    }
    setOpen(v => !v);
  };

  return (
    <div style={{ marginBottom: 14 }}>
      <Label>{label}</Label>
      <button
        ref={btnRef}
        onMouseDown={handleToggle}
        style={{
          width: "100%", boxSizing: "border-box", padding: "8px 10px",
          borderWidth: "1px", borderStyle: "solid", borderColor: gs.fieldBorderColor ?? "#e2e2e2",
          borderRadius: gs.fieldBorderRadius ?? 6,
          fontSize: 13, color: gs.fieldTextColor ?? "#222",
          outline: "none", background: gs.fieldBg ?? "#f7f7f7",
          cursor: "pointer", textAlign: "left",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          fontFamily: selected.value,
        }}
      >
        <span>{selected.label}</span>
        <span style={{ fontFamily: "sans-serif", fontSize: 10, color: "#aaa", marginLeft: 6 }}>▾</span>
      </button>
      {open && dropPos && (
        <div
          ref={listRef}
          onMouseDown={e => e.stopPropagation()}
          style={{
            position: "fixed",
            top: dropPos.top, left: dropPos.left, width: dropPos.width,
            zIndex: 9999,
            background: gs.panelBg ?? "#fff",
            borderWidth: "1px", borderStyle: "solid", borderColor: gs.fieldBorderColor ?? "#e2e2e2",
            borderRadius: gs.fieldBorderRadius ?? 6,
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            maxHeight: 220, overflowY: "auto",
          }}
        >
          {FONT_OPTIONS.map(opt => (
            <div
              key={opt.value}
              onMouseDown={e => { e.stopPropagation(); onChange(opt.value); setOpen(false); }}
              style={{
                padding: "8px 10px",
                fontFamily: opt.value,
                fontSize: 13,
                color: gs.fieldTextColor ?? "#222",
                background: opt.value === value ? (gs.fieldBg ?? "#f0f0f0") : "transparent",
                cursor: "pointer",
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
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
  settings: GlobalSettings;
  onUpdate: (updates: Partial<GlobalSettings>) => void;
}

export default function GlobalSidebar({ isOpen, onToggle, settings, onUpdate }: Props) {
  const s = settings;
  const scrollMode = s.scrollbarMode ?? "auto";
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, height: "100vh",
      display: "flex", flexDirection: "row-reverse", alignItems: "stretch",
      zIndex: 200, pointerEvents: "none",
    }}>
      {/* Toggle tab */}
      <div
        role="button"
        onClick={onToggle}
        title={isOpen ? "Close panel" : "Open global settings"}
        style={{
          alignSelf: TAB_ALIGN_CSS[s.tabAlign ?? "center"],
          width: s.tabWidth ?? 44, height: s.tabHeight ?? 156,
          background: s.panelBg ?? "#fff",
          borderWidth: "1px 1px 1px 0", borderStyle: "solid", borderColor: s.panelBorderColor ?? "#e0e0e0",
          borderRadius: `0 ${s.panelBorderRadius ?? 6}px ${s.panelBorderRadius ?? 6}px 0`,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", boxShadow: "2px 0 8px rgba(0,0,0,0.07)",
          pointerEvents: "auto", fontSize: 13, color: s.panelTextColor ?? "#888",
          userSelect: "none",
        }}
      >
        {isOpen ? "‹" : "›"}
      </div>

      {/* Clip wrapper */}
      <div style={{
        width: isOpen ? PANEL_W : 0,
        flexShrink: 0,
        overflow: "hidden",
        transition: "width 0.22s cubic-bezier(0.4,0,0.2,1)",
        height: "100%",
      }}>
        <div style={{
          width: PANEL_W,
          height: "100%",
          background: s.panelBg ?? "#fff",
          borderRight: `1px solid ${s.panelBorderColor ?? "#e0e0e0"}`,
          boxShadow: isOpen ? "4px 0 24px rgba(0,0,0,0.07)" : "none",
          pointerEvents: "auto",
          display: "flex", flexDirection: "column",
        }}>
        <div
          className="scrollbar"
          data-noad-panel="true"
          style={{
            width: PANEL_W, flex: 1, minHeight: 0, overflowY: "scroll", overflowX: "hidden",
            padding: "22px 22px 22px 9px", boxSizing: "border-box",
            scrollbarWidth: scrollMode === "none" ? "none" : scrollMode === "thin" ? "thin" : "auto",
            "--scrollbar-width": scrollMode === "none" ? "0px" : scrollMode === "thin" ? "4px" : `${s.scrollbarWidth ?? 8}px`,
            "--scrollbar-track": s.scrollbarBg ?? "#e8e8e8",
            "--scrollbar-thumb": s.scrollbarBorderColor ?? "#bbbbbb",
            "--scrollbar-thumb-radius": `${s.scrollbarBorderRadius ?? 4}px`,
            "--scrollbar-track-radius": `${s.scrollbarBorderRadius ?? 4}px`,
            "--section-color": (s.panelTextColor ?? "#444444") + "66",
            "--label-color": (s.panelTextColor ?? "#444444") + "99",
          } as React.CSSProperties}
        >

          <div style={{
            fontWeight: 700, fontSize: 12, color: s.panelHeaderColor ?? s.panelTextColor ?? "#444",
            textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 16,
          }}>
            All Properties
          </div>

          <SectionHeading first>Canvas</SectionHeading>
          <ColorField label="Background" value={s.canvasBg} onChange={v => onUpdate({ canvasBg: v })} gs={s} />

          <Divider />

          <SectionHeading>Nodes</SectionHeading>
          <ColorField label="Background" value={s.boxBg} onChange={v => onUpdate({ boxBg: v })} gs={s} />
          <ColorField label="Border color" value={s.boxBorderColor} onChange={v => onUpdate({ boxBorderColor: v })} gs={s} />
          <StepperField label="Border thickness" value={s.boxBorderThickness} onChange={v => onUpdate({ boxBorderThickness: v })} min={0} max={20} step={0.5} gs={s} />
          <StepperField label="Rounded Corner" value={s.boxBorderRadius} onChange={v => onUpdate({ boxBorderRadius: v })} min={0} max={100} step={1} gs={s} />

          <Divider />
          <Divider />

          <SectionHeading>Synapses</SectionHeading>
          <ColorField label="Color" value={s.arrowColor} onChange={v => onUpdate({ arrowColor: v })} gs={s} />
          <StepperField label="Line thickness" value={s.lineThickness} onChange={v => onUpdate({ lineThickness: v })} min={0.5} max={20} step={0.5} gs={s} />
          <StepperField label="Synapse thickness" value={s.arrowSize} onChange={v => onUpdate({ arrowSize: v })} min={0.25} max={4} step={0.25} gs={s} />
          <div style={{ marginBottom: 14 }}>
            <Label>Default layer</Label>
            <div style={{
              display: "flex",
              borderWidth: "1px", borderStyle: "solid", borderColor: s.fieldBorderColor ?? "#e2e2e2",
              borderRadius: s.fieldBorderRadius ?? 6, overflow: "hidden",
            }}>
              <button
                onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onUpdate({ synapsesAboveNodes: true }); }}
                style={{
                  flex: 1, padding: "8px 0", border: "none",
                  background: (s.synapsesAboveNodes ?? true) ? (s.highlightBg ?? "#378ADD") : (s.fieldBg ?? "#f7f7f7"),
                  color: (s.synapsesAboveNodes ?? true) ? (s.highlightTextColor ?? "#fff") : (s.fieldTextColor ?? "#888"),
                  cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "inherit",
                }}
              >Front</button>
              <button
                onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onUpdate({ synapsesAboveNodes: false }); }}
                style={{
                  flex: 1, padding: "8px 0", border: "none",
                  borderLeftWidth: "1px", borderLeftStyle: "solid", borderLeftColor: s.fieldBorderColor ?? "#e2e2e2",
                  background: !(s.synapsesAboveNodes ?? true) ? (s.highlightBg ?? "#378ADD") : (s.fieldBg ?? "#f7f7f7"),
                  color: !(s.synapsesAboveNodes ?? true) ? (s.highlightTextColor ?? "#fff") : (s.fieldTextColor ?? "#888"),
                  cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "inherit",
                }}
              >Back</button>
            </div>
          </div>

          <Divider />

          <SectionHeading>Text defaults</SectionHeading>

          <ColorField label="Title color" value={s.boxTitleColor} onChange={v => onUpdate({ boxTitleColor: v })} gs={s} />
          <FontDropdown label="Title font" value={s.titleFont ?? "sans-serif"} onChange={v => onUpdate({ titleFont: v })} gs={s} />
          <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "flex-end" }}>
            <div style={{ flex: "0 0 72px" }}>
              <FontSizeField label="Title size" value={s.titleFontSize ?? 12} onChange={v => onUpdate({ titleFontSize: v })} gs={s} />
            </div>
            <div style={{ flex: 1 }}>
              <Label>Title align</Label>
              <AlignToggle value={s.titleAlign ?? "left"} onChange={v => onUpdate({ titleAlign: v })} gs={s} />
            </div>
          </div>

          <ColorField label="Content color" value={s.boxTextColor} onChange={v => onUpdate({ boxTextColor: v })} gs={s} />
          <FontDropdown label="Content font" value={s.textFont ?? "sans-serif"} onChange={v => onUpdate({ textFont: v })} gs={s} />
          <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "flex-end" }}>
            <div style={{ flex: "0 0 72px" }}>
              <FontSizeField label="Content size" value={s.textFontSize ?? 14} onChange={v => onUpdate({ textFontSize: v })} gs={s} />
            </div>
            <div style={{ flex: 1 }}>
              <Label>Content align</Label>
              <AlignToggle value={s.textAlign ?? "center"} onChange={v => onUpdate({ textAlign: v })} gs={s} />
            </div>
          </div>

          <Divider />

          <SectionHeading>Links</SectionHeading>
          <ColorField label="Text" value={s.linkColor ?? "#378ADD"} onChange={v => onUpdate({ linkColor: v })} gs={s} />

        </div>
        </div>
      </div>
    </div>
  );
}
