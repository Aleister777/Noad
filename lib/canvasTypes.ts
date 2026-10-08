export type Side = "top" | "bottom" | "left" | "right";

export type TabAlign = "top" | "center" | "bottom";

export interface GlobalSettings {
  canvasBg: string;
  boxBg: string;
  boxBorderColor: string;
  boxBorderThickness: number;
  boxTitleColor: string;
  boxTextColor: string;
  boxBorderRadius: number;
  arrowColor: string;
  lineThickness: number;
  arrowSize: number;
  tabWidth: number;
  tabHeight: number;
  tabAlign: TabAlign;
  panelBg: string;
  panelBorderColor: string;
  panelTextColor: string;
  panelHeaderColor?: string;
  panelBorderRadius: number;
  fieldBg: string;
  fieldBorderColor: string;
  fieldTextColor: string;
  fieldBorderRadius: number;
  scrollbarWidth?: number;
  scrollbarBg?: string;
  scrollbarBorderColor?: string;
  scrollbarBorderRadius?: number;
  selectionBg?: string;
  selectionBorderColor?: string;
  selectionBorderRadius?: number;
  selectionHighlightColor?: string;
  selectionHighlightBrightness?: number;
  showHints?: boolean;
  titleFont?: string;
  titleFontSize?: number;
  titleAlign?: "left" | "center" | "right";
  textFont?: string;
  textFontSize?: number;
  textAlign?: "left" | "center" | "right";
  scrollbarMode?: "auto" | "thin" | "none";
  vectorSize?: number;
  nodeMoveStep?: number;
  nodeMoveJump?: number;
  synapsesAboveNodes?: boolean;
  colorPickerBg?: string;
  colorPickerBorderRadius?: number;
  highlightBg?: string;
  highlightTextColor?: string;
  zoomSpeed?: number;
  linkColor?: string;
  confirmBg?: string;
  confirmTextColor?: string;
  confirmBorderColor?: string;
  propertiesAutoOpen?: boolean;
}

export const DEFAULT_GLOBAL: GlobalSettings = {
  canvasBg: "#f5f4f0",
  boxBg: "#ffffff",
  boxBorderColor: "#cccccc",
  boxBorderThickness: 1.5,
  boxTitleColor: "#444444",
  boxTextColor: "#1a1a1a",
  boxBorderRadius: 12,
  arrowColor: "#888888",
  lineThickness: 1.5,
  arrowSize: 0.75,
  tabWidth: 44,
  tabHeight: 156,
  tabAlign: "center",
  panelBg: "#ffffff",
  panelBorderColor: "#e0e0e0",
  panelTextColor: "#444444",
  panelBorderRadius: 6,
  fieldBg: "#f7f7f7",
  fieldBorderColor: "#e2e2e2",
  fieldTextColor: "#222222",
  fieldBorderRadius: 6,
  scrollbarWidth: 8,
  scrollbarBg: "#e8e8e8",
  scrollbarBorderColor: "#bbbbbb",
  scrollbarBorderRadius: 4,
  selectionBg: "#378ADD",
  selectionBorderColor: "#378ADD",
  selectionBorderRadius: 4,
  selectionHighlightColor: "#378ADD",
  selectionHighlightBrightness: 0.5,
  showHints: true,
  titleFont: "sans-serif",
  titleFontSize: 12,
  titleAlign: "left",
  textFont: "sans-serif",
  textFontSize: 14,
  textAlign: "center",
  scrollbarMode: "auto",
  vectorSize: 5,
  nodeMoveStep: 4,
  nodeMoveJump: 100,
  synapsesAboveNodes: true,
  propertiesAutoOpen: true,
};
export type TextStyle = "normal" | "bold" | "italic";

export type Tool = "select" | "box" | "arrow";
export const TOOL_LABELS: Record<Tool, string> = { select: "Select", box: "Node", arrow: "Synapse" };
export type Corner = "tl" | "tr" | "bl" | "br";

export interface NodeData {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  titleFontSize?: number;
  titleAlign?: "left" | "center" | "right";
  titleColor?: string;
  titleStyle?: TextStyle;
  text: string;
  textFontSize?: number;
  textAlign?: "left" | "center" | "right";
  textColor?: string;
  textStyle?: TextStyle;
  textFill?: boolean;
  bg?: string;
  borderColor?: string;
  borderThickness?: number;
  borderRadius?: number;
}

export interface ImageNodeData {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  svg: string;
  naturalWidth: number;
  naturalHeight: number;
}

export interface ConnectionData {
  id: number;
  fromId: number;
  fromSide: Side;
  toId: number;
  toSide: Side;
  arrowStart?: boolean;
  arrowEnd?: boolean;
  bends?: { x: number; y: number }[];
  color?: string;
  lineThickness?: number;
  arrowSize?: number;
  behindNodes?: boolean;
}
