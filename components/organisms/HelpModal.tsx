"use client";

import { useEffect, useState } from "react";
import type { GlobalSettings } from "@/lib/canvasTypes";

interface HelpSection {
  heading: string;
  body: string;
}

interface HelpShortcut {
  keys: string;
  description: string;
}

interface HelpContent {
  title: string;
  about: string;
  sections: HelpSection[];
  shortcuts: HelpShortcut[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  globalSettings: GlobalSettings;
}

export default function HelpModal({ isOpen, onClose, globalSettings: gs }: Props) {
  const [content, setContent] = useState<HelpContent | null>(null);

  useEffect(() => {
    if (!isOpen || content) return;
    fetch("/help.json")
      .then(r => r.json())
      .then(setContent)
      .catch(() => {});
  }, [isOpen, content]);

  if (!isOpen) return null;

  const panelText = gs.panelTextColor ?? "#444444";
  const fieldBorder = gs.fieldBorderColor ?? "#e2e2e2";

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.12)", pointerEvents: "auto",
    }}>
      <div
        data-noad-panel="true"
        style={{
          background: gs.panelBg ?? "#fff",
          borderWidth: "1px", borderStyle: "solid", borderColor: gs.panelBorderColor ?? "#e0e0e0",
          borderRadius: gs.panelBorderRadius ?? 8,
          padding: "24px 28px", boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
          width: 420, maxHeight: "82vh", overflowY: "auto",
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute", top: 10, right: 10,
            width: 24, height: 24, padding: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "none", background: "transparent",
            borderRadius: gs.fieldBorderRadius ?? 6,
            color: panelText, fontSize: 16, lineHeight: 1, cursor: "pointer", fontFamily: "inherit",
          }}
        >
          ×
        </button>

        {!content ? (
          <div style={{ fontSize: 13, color: panelText }}>Loading…</div>
        ) : (
          <>
            <div style={{
              fontWeight: 700, fontSize: 15, color: gs.panelHeaderColor ?? panelText,
              marginBottom: 14, paddingRight: 24,
            }}>
              {content.title}
            </div>

            <div style={{ fontSize: 13, color: panelText, lineHeight: 1.6, marginBottom: 18 }}>
              {content.about}
            </div>

            {content.sections.map(s => (
              <div key={s.heading} style={{ marginBottom: 16 }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: panelText + "99",
                  textTransform: "uppercase", letterSpacing: 1, marginBottom: 6,
                }}>
                  {s.heading}
                </div>
                <div style={{ fontSize: 13, color: panelText, lineHeight: 1.6 }}>
                  {s.body}
                </div>
              </div>
            ))}

            <div style={{ borderTop: `1px solid ${fieldBorder}`, marginTop: 4, paddingTop: 14 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: panelText + "99",
                textTransform: "uppercase", letterSpacing: 1, marginBottom: 8,
              }}>
                Keyboard Shortcuts
              </div>
              {content.shortcuts.map(sc => (
                <div key={sc.keys} style={{
                  display: "flex", justifyContent: "space-between", gap: 12,
                  fontSize: 12, color: panelText, lineHeight: 1.9,
                }}>
                  <span style={{ color: panelText + "99" }}>{sc.description}</span>
                  <span style={{
                    fontFamily: "monospace", fontSize: 11, whiteSpace: "nowrap",
                    background: gs.fieldBg ?? "#f7f7f7", border: `1px solid ${fieldBorder}`,
                    borderRadius: 4, padding: "1px 6px", flexShrink: 0,
                  }}>
                    {sc.keys}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={onClose}
              style={{
                width: "100%", padding: "8px 0", marginTop: 20,
                borderWidth: "1px", borderStyle: "solid",
                borderColor: gs.confirmBorderColor ?? "transparent",
                borderRadius: gs.fieldBorderRadius ?? 6,
                background: gs.confirmBg ?? "#378ADD", color: gs.confirmTextColor ?? "#fff",
                fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Got it
            </button>
          </>
        )}
      </div>
    </div>
  );
}
