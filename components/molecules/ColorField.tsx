"use client";

import { useState, useEffect } from "react";
import type { GlobalSettings } from "@/lib/canvasTypes";
import { ColorWheelPicker } from "@/components/atoms/ColorWheelPicker";

export function ColorField({ label, value, onChange, gs }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  gs: GlobalSettings;
}) {
  const [hex, setHex] = useState(value);
  useEffect(() => { setHex(value); }, [value]);
  const safe = /^#[0-9A-Fa-f]{6}$/.test(value) ? value : "#000000";
  const r = gs.fieldBorderRadius ?? 6;

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, color: "var(--label-color, #999)", marginBottom: 3, letterSpacing: 0.2 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <ColorWheelPicker
          value={safe} onChange={onChange}
          popupBg={gs.panelBg} popupBorderColor={gs.panelBorderColor} popupBorderRadius={gs.panelBorderRadius}
          fieldBg={gs.fieldBg} fieldBorderColor={gs.fieldBorderColor}
          fieldTextColor={gs.fieldTextColor} fieldBorderRadius={gs.fieldBorderRadius}
          iconBg={gs.colorPickerBg} iconBorderRadius={gs.colorPickerBorderRadius}
          confirmBg={gs.confirmBg} confirmTextColor={gs.confirmTextColor} confirmBorderColor={gs.confirmBorderColor}
        />
        <input
          type="text" value={hex} maxLength={7}
          onChange={e => {
            const v = e.target.value;
            setHex(v);
            if (/^#[0-9A-Fa-f]{6}$/.test(v)) {
              onChange(v);
            } else if (/^#[0-9A-Fa-f]{3}$/.test(v)) {
              onChange("#" + v[1] + v[1] + v[2] + v[2] + v[3] + v[3]);
            }
          }}
          onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          onMouseDown={e => e.stopPropagation()}
          style={{
            flex: 1, minWidth: 0, fontFamily: "monospace", fontSize: 12,
            padding: "8px 10px", outline: "none",
            borderWidth: "1px", borderStyle: "solid", borderColor: gs.fieldBorderColor ?? "#e2e2e2",
            borderRadius: r, color: gs.fieldTextColor ?? "#222", background: gs.fieldBg ?? "#f7f7f7",
          }}
        />
      </div>
    </div>
  );
}
