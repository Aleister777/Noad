"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

// ── Color math ───────────────────────────────────────────────────────────────

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

function hslToHex(h: number, s: number, l: number): string {
  const [r, g, b] = hslToRgb(h, s, l);
  return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
}

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  switch (max) {
    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
    case g: h = ((b - r) / d + 2) / 6; break;
    case b: h = ((r - g) / d + 4) / 6; break;
  }
  return [h * 360, s * 100, l * 100];
}

// ── Canvas rendering ─────────────────────────────────────────────────────────

const SIZE = 164;

function renderWheel(
  canvas: HTMLCanvasElement,
  lightness: number,
  markerH: number,
  markerS: number,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const cx = SIZE / 2, cy = SIZE / 2, r = SIZE / 2 - 2;
  const imageData = ctx.createImageData(SIZE, SIZE);
  const d = imageData.data;

  for (let py = 0; py < SIZE; py++) {
    for (let px = 0; px < SIZE; px++) {
      const dx = px - cx, dy = py - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= r) {
        const hue = ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360;
        const sat = (dist / r) * 100;
        const [red, grn, blu] = hslToRgb(hue, sat, lightness);
        const i = (py * SIZE + px) * 4;
        d[i] = red; d[i + 1] = grn; d[i + 2] = blu; d[i + 3] = 255;
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);

  // Marker ring
  const angle = markerH * Math.PI / 180;
  const md = (markerS / 100) * r;
  const mx = cx + Math.cos(angle) * md;
  const my = cy + Math.sin(angle) * md;
  ctx.beginPath(); ctx.arc(mx, my, 7, 0, Math.PI * 2);
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.beginPath(); ctx.arc(mx, my, 7, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 1; ctx.stroke();
}

// ── ColorWheelPicker ─────────────────────────────────────────────────────────

export function ColorWheelPicker({
  value,
  onChange,
  popupBg,
  popupBorderColor,
  popupBorderRadius,
  fieldBg,
  fieldBorderColor,
  fieldTextColor,
  fieldBorderRadius,
  iconBg,
  iconBorderRadius,
  confirmBg,
  confirmTextColor,
  confirmBorderColor,
}: {
  value: string;
  onChange: (hex: string) => void;
  popupBg?: string;
  popupBorderColor?: string;
  popupBorderRadius?: number;
  fieldBg?: string;
  fieldBorderColor?: string;
  fieldTextColor?: string;
  fieldBorderRadius?: number;
  iconBg?: string;
  iconBorderRadius?: number;
  confirmBg?: string;
  confirmTextColor?: string;
  confirmBorderColor?: string;
}) {
  const valid = /^#[0-9A-Fa-f]{6}$/.test(value);
  const safeHex = valid ? value.toLowerCase() : "#000000";

  const [open, setOpen] = useState(false);
  const [hsl, setHsl] = useState<[number, number, number]>(() => hexToHsl(safeHex));
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0, openLeft: true });
  const [mounted, setMounted] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const hslRef = useRef(hsl);
  const originalHexRef = useRef(safeHex);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { hslRef.current = hsl; }, [hsl]);

  // Only sync external value when popup is closed, so in-progress edits aren't clobbered
  useEffect(() => {
    if (!open && valid) setHsl(hexToHsl(value.toLowerCase()));
  }, [value, valid, open]);

  // Redraw wheel whenever it's open or hsl changes
  useEffect(() => {
    if (open && canvasRef.current) {
      renderWheel(canvasRef.current, hsl[2], hsl[0], hsl[1]);
    }
  }, [open, hsl]);

  const handleConfirm = useCallback(() => {
    setOpen(false);
  }, []);

  const handleCancel = useCallback(() => {
    onChange(originalHexRef.current);
    setHsl(hexToHsl(originalHexRef.current));
    setOpen(false);
  }, [onChange]);

  const openPopup = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const POPUP_W = 196 + 16;
    const POPUP_H = 320; // canvas(164) + lightness(39) + preview(40) + buttons(40) + padding(28) + buffer
    const GAP = 8;
    const vh = window.innerHeight;
    const openLeft = rect.left >= POPUP_W;
    const rawTop = rect.top + rect.height / 2;
    // Clamp so the popup (centered vertically via translateY(-50%)) stays inside the viewport
    const top = Math.max(GAP + POPUP_H / 2, Math.min(vh - GAP - POPUP_H / 2, rawTop));
    originalHexRef.current = safeHex;
    setHsl(hexToHsl(safeHex));
    setPopupPos({ top, left: openLeft ? rect.left : rect.right, openLeft });
    setOpen(true);
  }, [safeHex]);

  // Outside click → cancel; Escape → cancel
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (
        popupRef.current && !popupRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) handleCancel();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleCancel();
      if (e.key === "Enter") handleConfirm();
    };
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, handleCancel, handleConfirm]);

  const pickFromWheel = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = rect.width / 2, cy = rect.height / 2;
    const dx = clientX - rect.left - cx;
    const dy = clientY - rect.top - cy;
    const r = SIZE / 2 - 2;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clampedDist = Math.min(dist, r);
    const h = ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360;
    const s = (clampedDist / r) * 100;
    const l = hslRef.current[2];
    setHsl([h, s, l]);
    onChange(hslToHex(h, s, l));
  }, [onChange]);

  // Global drag tracking
  useEffect(() => {
    if (!open) return;
    const onMove = (e: MouseEvent) => { if (dragging.current) pickFromWheel(e.clientX, e.clientY); };
    const onUp = () => { dragging.current = false; };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [open, pickFromWheel]);

  const currentHex = hslToHex(hsl[0], hsl[1], hsl[2]);
  const pureHex = hslToHex(hsl[0], Math.max(hsl[1], 5), 50);

  const popup = (
    <div
      ref={popupRef}
      onMouseDown={e => e.stopPropagation()}
      style={{
        position: "fixed",
        top: popupPos.top,
        left: popupPos.left,
        transform: popupPos.openLeft
          ? "translate(-100%, -50%) translateX(-8px)"
          : "translate(8px, -50%)",
        background: popupBg ?? "#fff",
        borderWidth: "1px", borderStyle: "solid", borderColor: popupBorderColor ?? "transparent",
        borderRadius: popupBorderRadius != null ? Math.max(8, popupBorderRadius + 8) : 16,
        boxShadow: "0 8px 32px rgba(0,0,0,0.18), 0 1px 6px rgba(0,0,0,0.08)",
        padding: "14px 14px 14px",
        zIndex: 99999,
        width: 196,
        userSelect: "none",
      }}
    >
      {/* Color wheel */}
      <canvas
        ref={canvasRef}
        width={SIZE}
        height={SIZE}
        style={{
          display: "block",
          borderRadius: "50%",
          cursor: "crosshair",
          width: SIZE,
          height: SIZE,
          boxShadow: "0 0 0 1.5px #ddd",
          margin: "0 auto",
        }}
        onMouseDown={e => {
          dragging.current = true;
          pickFromWheel(e.clientX, e.clientY);
        }}
        onMouseMove={e => { if (dragging.current) pickFromWheel(e.clientX, e.clientY); }}
        onMouseUp={() => { dragging.current = false; }}
      />

      {/* Lightness slider */}
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 10, color: "#bbb", marginBottom: 5, letterSpacing: 0.3 }}>LIGHTNESS</div>
        <div style={{
          position: "relative", height: 12, borderRadius: 6,
          background: `linear-gradient(to right, #000 0%, ${pureHex} 50%, #fff 100%)`,
          boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.1)",
        }}>
          <input
            type="range"
            min={0} max={100} value={Math.round(hsl[2])}
            onChange={e => {
              const l = Number(e.target.value);
              setHsl([hsl[0], hsl[1], l]);
              onChange(hslToHex(hsl[0], hsl[1], l));
            }}
            style={{
              position: "absolute", inset: 0,
              width: "100%", height: "100%",
              opacity: 0, cursor: "pointer", margin: 0,
            }}
          />
          {/* Thumb */}
          <div style={{
            position: "absolute",
            top: "50%",
            left: `${hsl[2]}%`,
            transform: "translate(-50%, -50%)",
            width: 16, height: 16,
            borderRadius: "50%",
            background: currentHex,
            border: "2.5px solid #fff",
            boxShadow: "0 1px 4px rgba(0,0,0,0.28)",
            pointerEvents: "none",
          }} />
        </div>
      </div>

      {/* Preview + hex input */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
        <div style={{
          width: 28, height: 28, borderRadius: fieldBorderRadius ?? 8, flexShrink: 0,
          background: currentHex,
          boxShadow: "inset 0 0 0 1.5px rgba(0,0,0,0.10)",
        }} />
        <input
          type="text"
          value={currentHex}
          onChange={e => {
            const v = e.target.value.toLowerCase();
            if (/^#[0-9a-f]{6}$/.test(v)) {
              setHsl(hexToHsl(v));
              onChange(v);
            } else if (/^#[0-9a-f]{3}$/.test(v)) {
              const x = "#" + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
              setHsl(hexToHsl(x));
              onChange(x);
            }
          }}
          onMouseDown={e => e.stopPropagation()}
          maxLength={7}
          style={{
            flex: 1, fontFamily: "monospace", fontSize: 12,
            padding: "4px 8px", outline: "none",
            borderWidth: "1px", borderStyle: "solid",
            borderColor: fieldBorderColor ?? "#e2e2e2",
            borderRadius: fieldBorderRadius ?? 6,
            color: fieldTextColor ?? "#222",
            background: fieldBg ?? "#f7f7f7",
          }}
        />
      </div>

      {/* Confirm / Cancel */}
      <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
        <button
          onClick={handleConfirm}
          style={{
            flex: 1, padding: "8px 0",
            borderWidth: "1px", borderStyle: "solid",
            borderColor: confirmBorderColor ?? "transparent",
            borderRadius: fieldBorderRadius ?? 8,
            background: confirmBg ?? "#378ADD", color: confirmTextColor ?? "#fff",
            fontSize: 12, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit",
          }}
        >
          Confirm
        </button>
        <button
          onClick={handleCancel}
          style={{
            flex: 1, padding: "8px 0",
            borderWidth: "1px", borderStyle: "solid",
            borderColor: fieldBorderColor ?? "#e2e2e2",
            borderRadius: fieldBorderRadius ?? 8,
            background: fieldBg ?? "#f7f7f7",
            color: fieldTextColor ?? "#555",
            fontSize: 12, fontWeight: 500,
            cursor: "pointer", fontFamily: "inherit",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button
        ref={triggerRef}
        onMouseDown={e => e.stopPropagation()}
        onClick={e => {
          e.stopPropagation();
          if (open) handleCancel();
          else openPopup();
        }}
        title="Pick color"
        style={{
          width: 26, height: 26, padding: 0,
          border: "1.5px solid #ccc",
          borderRadius: iconBorderRadius != null ? iconBorderRadius : "50%",
          background: iconBg ?? "#f7f7f7",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
          flexShrink: 0,
          color: "#777",
          transition: "border-color 0.15s, background 0.15s",
        }}
      >
        <svg
          width="14" height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
          <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
          <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
          <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
        </svg>
      </button>
      {mounted && open && createPortal(popup, document.body)}
    </>
  );
}
