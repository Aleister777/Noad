"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { GlobalSettings } from "@/lib/canvasTypes";
import { ColorField } from "@/components/molecules/ColorField";

type Mode = "bw" | "gray" | "color";
type FillStrategy = "dominant" | "mean" | "median" | "spread";

interface Settings {
  mode: Mode;
  threshold: number;
  steps: number;
  fillStrategy: FillStrategy;
  colors: number;
  turdSize: number;
  alphaMax: number;
  invert: boolean;
  color: string;
  background: string;
}

const DEFAULT_SETTINGS: Settings = {
  mode: "gray",
  threshold: 128,
  steps: 4,
  fillStrategy: "dominant",
  colors: 6,
  turdSize: 2,
  alphaMax: 1,
  invert: false,
  color: "#000000",
  background: "transparent",
};

interface TraceResult {
  svg: string;
  naturalWidth: number;
  naturalHeight: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  globalSettings: GlobalSettings;
  onInsert: (result: TraceResult) => void;
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, color: "#999", marginBottom: 4, letterSpacing: 0.2 }}>
      {children}
    </div>
  );
}

function fieldStyle(gs: GlobalSettings): React.CSSProperties {
  return {
    width: "100%", boxSizing: "border-box", padding: "8px 10px",
    borderWidth: "1px", borderStyle: "solid", borderColor: gs.fieldBorderColor ?? "#e2e2e2",
    borderRadius: gs.fieldBorderRadius ?? 6,
    fontSize: 13, color: gs.fieldTextColor ?? "#222",
    outline: "none", fontFamily: "inherit",
    background: gs.fieldBg ?? "#f7f7f7",
  };
}

function NumField({ label, value, onChange, min, max, step, gs }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step?: number; gs: GlobalSettings;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <Label>{label} <span style={{ opacity: 0.5 }}>({value})</span></Label>
      <input
        type="range" min={min} max={max} step={step ?? 1} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        onMouseDown={e => e.stopPropagation()}
        style={{ width: "100%", accentColor: gs.highlightBg ?? "#378ADD" }}
      />
    </div>
  );
}

function SegToggle<T extends string>({ options, value, onChange, gs }: {
  options: { v: T; label: string }[]; value: T; onChange: (v: T) => void; gs: GlobalSettings;
}) {
  const hl = gs.highlightBg ?? "#378ADD";
  const hlText = gs.highlightTextColor ?? "#fff";
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
      {options.map(({ v, label }) => {
        const active = value === v;
        return (
          <button
            key={v}
            onClick={() => onChange(v)}
            style={{
              flex: 1, padding: "7px 10px",
              borderWidth: "1px", borderStyle: "solid",
              borderColor: active ? hl : (gs.fieldBorderColor ?? "#e2e2e2"),
              borderRadius: gs.fieldBorderRadius ?? 6,
              background: active ? hl : (gs.fieldBg ?? "#f7f7f7"),
              color: active ? hlText : (gs.fieldTextColor ?? "#444"),
              fontSize: 12, fontWeight: active ? 600 : 400,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function SelectField({ label, value, options, onChange, gs }: {
  label: string; value: string; options: { v: string; label: string }[];
  onChange: (v: string) => void; gs: GlobalSettings;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <Label>{label}</Label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        onMouseDown={e => e.stopPropagation()}
        style={{ ...fieldStyle(gs), cursor: "pointer" }}
      >
        {options.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
      </select>
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

export default function ImageModal({ isOpen, onClose, globalSettings: gs, onInsert }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [result, setResult] = useState<TraceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  const reset = useCallback(() => {
    setFile(null);
    setPreviewUrl(null);
    setSettings(DEFAULT_SETTINGS);
    setResult(null);
    setError("");
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen, reset]);

  useEffect(() => {
    if (!file) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const myId = ++requestIdRef.current;
      setLoading(true);
      setError("");
      const form = new FormData();
      form.append("file", file);
      form.append("settings", JSON.stringify(settings));
      fetch("/api/trace", { method: "POST", body: form })
        .then(async r => {
          const data = await r.json();
          if (myId !== requestIdRef.current) return;
          if (!r.ok) { setError(data.error || "Tracing failed"); setResult(null); return; }
          setResult(data);
        })
        .catch(() => { if (myId === requestIdRef.current) { setError("Tracing failed"); setResult(null); } })
        .finally(() => { if (myId === requestIdRef.current) setLoading(false); });
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [file, settings]);

  const handleFileChange = (f: File | null) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setResult(null);
    setError("");
    setFile(f);
    setPreviewUrl(f ? URL.createObjectURL(f) : null);
  };

  const update = (partial: Partial<Settings>) => setSettings(prev => ({ ...prev, ...partial }));

  const handleInsert = () => {
    if (!result) return;
    onInsert(result);
    onClose();
  };

  if (!isOpen) return null;

  const panelText = gs.panelTextColor ?? "#444444";
  const fieldBorder = gs.fieldBorderColor ?? "#e2e2e2";

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.12)", pointerEvents: "auto",
    }}>
      <div style={{
        background: gs.panelBg ?? "#fff",
        borderWidth: "1px", borderStyle: "solid", borderColor: gs.panelBorderColor ?? "#e0e0e0",
        borderRadius: gs.panelBorderRadius ?? 8,
        padding: "24px 28px", boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
        width: 380, maxHeight: "88vh", overflowY: "auto",
      }}>
        <div style={{
          fontWeight: 700, fontSize: 13,
          color: gs.panelHeaderColor ?? panelText,
          textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 16,
        }}>
          Insert Image
        </div>

        {/* Upload field */}
        <div style={{ marginBottom: 16 }}>
          <Label>Image file</Label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,image/jpeg,image/png"
            style={{ display: "none" }}
            onChange={e => handleFileChange(e.target.files?.[0] ?? null)}
          />
          <div
            role="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: "10px 12px",
              borderWidth: "1px", borderStyle: "solid",
              borderColor: file ? (gs.highlightBg ?? "#378ADD") : fieldBorder,
              borderRadius: gs.fieldBorderRadius ?? 6,
              background: gs.fieldBg ?? "#f7f7f7",
              cursor: "pointer", fontSize: 12, userSelect: "none",
              color: file ? (gs.fieldTextColor ?? "#222") : panelText + "77",
            }}
          >
            {file ? file.name : "Choose a .jpg or .png file…"}
          </div>
        </div>

        {previewUrl && (
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <Label>Original</Label>
              <div style={{
                borderWidth: "1px", borderStyle: "solid", borderColor: fieldBorder,
                borderRadius: gs.fieldBorderRadius ?? 6, overflow: "hidden",
                background: "#f0f0f0", height: 120, display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="Original" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <Label>{loading ? "Tracing…" : "Traced"}</Label>
              <div style={{
                borderWidth: "1px", borderStyle: "solid", borderColor: fieldBorder,
                borderRadius: gs.fieldBorderRadius ?? 6, overflow: "hidden",
                background: "#f0f0f0", height: 120, display: "flex", alignItems: "center", justifyContent: "center",
                opacity: loading ? 0.5 : 1,
              }}>
                {result
                  ? <div style={{ width: "100%", height: "100%" }} dangerouslySetInnerHTML={{ __html: result.svg }} />
                  : <span style={{ fontSize: 11, color: "#aaa" }}>{loading ? "…" : "No preview yet"}</span>
                }
              </div>
            </div>
          </div>
        )}

        {error && (
          <div style={{ fontSize: 12, color: "#d44", marginBottom: 14, lineHeight: 1.5 }}>
            {error}
          </div>
        )}

        <SegToggle
          gs={gs}
          value={settings.mode}
          onChange={v => update({ mode: v })}
          options={[
            { v: "color", label: "Color" },
            { v: "gray", label: "Grayscale" },
            { v: "bw", label: "B & W" },
          ]}
        />

        {settings.mode === "bw" && (
          <>
            <NumField label="Threshold" value={settings.threshold} onChange={v => update({ threshold: v })} min={0} max={255} gs={gs} />
            <ColorField label="Fill color" value={settings.color} onChange={v => update({ color: v })} gs={gs} />
          </>
        )}
        {settings.mode === "gray" && (
          <>
            <NumField label="Levels" value={settings.steps} onChange={v => update({ steps: v })} min={2} max={8} gs={gs} />
            <SelectField
              label="Fill strategy" gs={gs} value={settings.fillStrategy}
              onChange={v => update({ fillStrategy: v as FillStrategy })}
              options={[
                { v: "dominant", label: "Dominant" }, { v: "mean", label: "Mean" },
                { v: "median", label: "Median" }, { v: "spread", label: "Spread" },
              ]}
            />
          </>
        )}
        {settings.mode === "color" && (
          <NumField label="Colors" value={settings.colors} onChange={v => update({ colors: v })} min={2} max={12} gs={gs} />
        )}

        <NumField label="Detail (speckle suppression)" value={settings.turdSize} onChange={v => update({ turdSize: v })} min={0} max={50} gs={gs} />
        <NumField label="Corner smoothing" value={settings.alphaMax} onChange={v => update({ alphaMax: v })} min={0} max={1.3} step={0.05} gs={gs} />
        {settings.mode !== "color" && (
          <Checkbox label="Invert" checked={settings.invert} onChange={v => update({ invert: v })} gs={gs} />
        )}
        <ColorField label="Background color" value={settings.background === "transparent" ? "#ffffff" : settings.background} onChange={v => update({ background: v })} gs={gs} />

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button
            onClick={handleInsert}
            disabled={!result}
            style={{
              flex: 1, padding: "7px 0",
              borderWidth: "1px", borderStyle: "solid",
              borderColor: result ? (gs.confirmBorderColor ?? "transparent") : fieldBorder,
              borderRadius: gs.fieldBorderRadius ?? 6,
              background: result ? (gs.confirmBg ?? "#378ADD") : fieldBorder,
              color: result ? (gs.confirmTextColor ?? "#fff") : panelText + "77",
              fontSize: 12, fontWeight: 600,
              cursor: result ? "pointer" : "default", fontFamily: "inherit",
            }}
          >Add to Canvas</button>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: "7px 0",
              borderWidth: "1px", borderStyle: "solid", borderColor: fieldBorder,
              borderRadius: gs.fieldBorderRadius ?? 6,
              background: gs.fieldBg ?? "#f7f7f7", color: gs.fieldTextColor ?? "#555",
              fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
            }}
          >Cancel</button>
        </div>
      </div>
    </div>
  );
}
