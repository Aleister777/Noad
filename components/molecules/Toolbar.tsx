"use client";

import { useState } from "react";
import type { Tool, GlobalSettings } from "@/lib/canvasTypes";
import { TOOL_LABELS } from "@/lib/canvasTypes";

interface Props {
  tool: Tool;
  onToolChange: (t: Tool) => void;
  onUndo: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onImage: () => void;
  onNew: () => void;
  onSave: () => void;
  onLoad: () => void;
  onExport: () => void;
  globalSettings: GlobalSettings;
}

const TOOLS: Tool[] = ["select", "box", "arrow"];

function brighten(hex: string): string {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return hex;
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + 90);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + 90);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + 90);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function TBtn({ onClick, style, brightColor, children }: {
  onClick?: () => void;
  style: React.CSSProperties;
  brightColor: string;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ ...style, color: hovered ? brightColor : style.color, transition: "color 0.12s" }}
    >
      {children}
    </button>
  );
}

export default function Toolbar({ tool, onToolChange, onUndo, onCopy, onPaste, onDelete, onImage, onNew, onSave, onLoad, onExport, globalSettings: gs }: Props) {
  const r = gs.fieldBorderRadius ?? 8;
  const actionBtn = (color?: string): React.CSSProperties => ({
    padding: "7px 14px",
    borderWidth: "1px", borderStyle: "solid", borderColor: "transparent",
    borderRadius: r,
    fontSize: 13, fontWeight: 500, cursor: "pointer", background: "transparent",
    color: color ?? gs.fieldTextColor ?? "#444",
  });
  return (
    <div style={{
      position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
      background: gs.panelBg ?? "#fff",
      borderWidth: "1px", borderStyle: "solid", borderColor: gs.panelBorderColor ?? "#ddd",
      borderRadius: gs.panelBorderRadius ?? 12,
      padding: "8px 12px", display: "flex", gap: 6, alignItems: "center",
      boxShadow: "0 4px 20px rgba(0,0,0,0.08)", zIndex: 1000,
    }}>
      <TBtn onClick={onNew} style={actionBtn()} brightColor={brighten(gs.fieldTextColor ?? "#444444")}>New</TBtn>
      <div style={{ width: 1, height: 24, background: gs.fieldBorderColor ?? "#ddd", margin: "0 4px" }} />
      {TOOLS.map(t => (
        <TBtn
          key={t}
          onClick={() => onToolChange(t)}
          brightColor={brighten(gs.fieldTextColor ?? "#444444")}
          style={{
            padding: "7px 14px",
            borderWidth: "1px", borderStyle: "solid",
            borderColor: tool === t ? (gs.fieldBorderColor ?? "#aaa") : "transparent",
            borderRadius: r, fontSize: 13, fontWeight: 500, cursor: "pointer",
            background: tool === t ? (gs.fieldBg ?? "#f5f4f0") : "transparent",
            color: gs.fieldTextColor ?? "#444",
          }}
        >
          {TOOL_LABELS[t]}
        </TBtn>
      ))}
      <div style={{ width: 1, height: 24, background: gs.fieldBorderColor ?? "#ddd", margin: "0 4px" }} />
      <TBtn onClick={onUndo} style={actionBtn()} brightColor={brighten(gs.fieldTextColor ?? "#444444")}>Undo</TBtn>
      <div style={{ width: 1, height: 24, background: gs.fieldBorderColor ?? "#ddd", margin: "0 4px" }} />
      <TBtn onClick={onCopy} style={actionBtn()} brightColor={brighten(gs.fieldTextColor ?? "#444444")}>Copy</TBtn>
      <TBtn onClick={onPaste} style={actionBtn()} brightColor={brighten(gs.fieldTextColor ?? "#444444")}>Paste</TBtn>
      <div style={{ width: 1, height: 24, background: gs.fieldBorderColor ?? "#ddd", margin: "0 4px" }} />
      <TBtn onClick={onDelete} style={actionBtn("#c0392b")} brightColor={brighten("#c0392b")}>Delete</TBtn>
      <div style={{ width: 1, height: 24, background: gs.fieldBorderColor ?? "#ddd", margin: "0 4px" }} />
      <TBtn onClick={onImage} style={actionBtn()} brightColor={brighten(gs.fieldTextColor ?? "#444444")}>Image</TBtn>
      <div style={{ width: 1, height: 24, background: gs.fieldBorderColor ?? "#ddd", margin: "0 4px" }} />
      <TBtn
        onClick={onSave}
        brightColor={brighten(gs.fieldTextColor ?? "#444444")}
        style={{
          padding: "7px 14px",
          borderWidth: "1px", borderStyle: "solid", borderColor: "transparent",
          borderRadius: r,
          fontSize: 13, fontWeight: 500, cursor: "pointer", background: "transparent",
          color: gs.fieldTextColor ?? "#444",
        }}
      >
        Save
      </TBtn>
      <TBtn
        onClick={onLoad}
        brightColor={brighten(gs.fieldTextColor ?? "#444444")}
        style={{
          padding: "7px 14px",
          borderWidth: "1px", borderStyle: "solid", borderColor: "transparent",
          borderRadius: r,
          fontSize: 13, fontWeight: 500, cursor: "pointer", background: "transparent",
          color: gs.fieldTextColor ?? "#444",
        }}
      >
        Load
      </TBtn>
      <TBtn
        onClick={onExport}
        brightColor={brighten(gs.fieldTextColor ?? "#444444")}
        style={{
          padding: "7px 14px",
          borderWidth: "1px", borderStyle: "solid", borderColor: "transparent",
          borderRadius: r,
          fontSize: 13, fontWeight: 500, cursor: "pointer", background: "transparent",
          color: gs.fieldTextColor ?? "#444",
        }}
      >
        Export
      </TBtn>
    </div>
  );
}
