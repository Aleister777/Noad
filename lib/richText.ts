/*
 Minimal inline rich-text support for node titles/content: a title or text
 string may contain literal <b>...</b> / <i>...</i> markers around runs the
 user explicitly bolded/italicized (via Ctrl+B / Ctrl+I while editing). This
 is a closed 4-token whitelist, not an HTML parser — anything that isn't
 exactly one of these four tokens is literal text, escaped on the way in and
 decoded on the way out, so a user typing a literal "<b>" can never be
 misread as a tag and no other markup can ever be produced or interpreted.
 `title`/`text` stay plain `string` everywhere else in the app (SVG export,
 the Sidebar's own plain title/content fields, canvas-state.json) — only the
 canvas node's own display/edit surfaces understand this format.
*/
export interface TextRun {
  text: string;
  bold: boolean;
  italic: boolean;
}

function escapeLiteral(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function unescapeLiteral(s: string): string {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

const TOKEN_RE = /(<\/?[bi]>)/g;

export function parseRuns(raw: string): TextRun[] {
  const runs: TextRun[] = [];
  let bold = false, italic = false, buf = "";
  const flush = () => {
    if (buf) runs.push({ text: unescapeLiteral(buf), bold, italic });
    buf = "";
  };
  for (const token of raw.split(TOKEN_RE)) {
    if (token === "<b>") { flush(); bold = true; }
    else if (token === "</b>") { flush(); bold = false; }
    else if (token === "<i>") { flush(); italic = true; }
    else if (token === "</i>") { flush(); italic = false; }
    else if (token) { buf += token; }
  }
  flush();
  return runs;
}

export function serializeRuns(runs: TextRun[]): string {
  return runs
    .filter(r => r.text.length > 0)
    .map(r => {
      let t = escapeLiteral(r.text);
      if (r.italic) t = `<i>${t}</i>`;
      if (r.bold) t = `<b>${t}</b>`;
      return t;
    })
    .join("");
}

// Plain rendered text, with formatting markers stripped — used anywhere that
// only cares about the actual characters (SVG export, node-fill autosizing,
// the connection panel's "From"/"To" node-title preview).
export function plainText(raw: string): string {
  return parseRuns(raw).map(r => r.text).join("");
}

export function plainLength(raw: string): number {
  return plainText(raw).length;
}

function isBoldEl(el: Element): boolean {
  return el.tagName === "B" || el.tagName === "STRONG";
}
function isItalicEl(el: Element): boolean {
  return el.tagName === "I" || el.tagName === "EM";
}

// Walks a live contentEditable element after an edit and flattens it back
// into runs, based on real <b>/<strong>/<i>/<em> ancestor tags — not computed
// style, which would also pick up the field's own ambient bold/italic
// default (set via the "Style" toggle) and incorrectly bake it into every
// run as an explicit override.
export function runsFromEditable(root: HTMLElement): TextRun[] {
  const runs: TextRun[] = [];
  let curBold = false, curItalic = false, buf = "";
  const flush = () => {
    if (buf) runs.push({ text: buf, bold: curBold, italic: curItalic });
    buf = "";
  };
  const append = (text: string, bold: boolean, italic: boolean) => {
    if (bold !== curBold || italic !== curItalic) flush();
    curBold = bold; curItalic = italic;
    buf += text;
  };
  const walk = (node: Node, bold: boolean, italic: boolean) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node as Text).data;
      if (text) append(text, bold, italic);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    if (el.tagName === "BR") { append("\n", bold, italic); return; }
    const childBold = bold || isBoldEl(el);
    const childItalic = italic || isItalicEl(el);
    el.childNodes.forEach(child => walk(child, childBold, childItalic));
  };
  root.childNodes.forEach(child => walk(child, false, false));
  flush();
  return runs;
}

// Builds real DOM nodes (never innerHTML/dangerouslySetInnerHTML) for
// hydrating a contentEditable element from stored runs when edit mode starts.
export function buildEditableNodes(runs: TextRun[]): Node[] {
  const nodes: Node[] = [];
  for (const run of runs) {
    const lines = run.text.split("\n");
    lines.forEach((line, i) => {
      if (i > 0) nodes.push(document.createElement("br"));
      if (!line) return;
      let node: Node = document.createTextNode(line);
      if (run.italic) { const el = document.createElement("i"); el.appendChild(node); node = el; }
      if (run.bold) { const el = document.createElement("b"); el.appendChild(node); node = el; }
      nodes.push(node);
    });
  }
  return nodes;
}
