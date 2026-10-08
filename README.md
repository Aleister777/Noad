# Noad

Noad is a node-based brainstorming canvas. Jot ideas down as **Nodes**, connect related ideas with **Synapses**, and drop in traced images — then pan, zoom, and freely rearrange everything on an infinite canvas.

## Getting Started

**Prerequisites:** [Node.js](https://nodejs.org/) 18.18 or later, and npm.

Clone the repository and install dependencies:

```bash
git clone <repository-url>
cd noad
npm install
```

Run the app in development mode:

```bash
npm run dev
```

Then open [http://localhost:3434](http://localhost:3434) in your browser.

To build and run a production version instead:

```bash
npm run build
npm start
```

## Features

- **Infinite canvas** — pan and zoom freely; zoom out indefinitely until content disappears
- **Nodes** — resizable, styleable sticky notes with rich text (bold/italic) titles and content
- **Synapses** — curved, bendable connections between Nodes with optional arrowheads
- **Images** — import a photo or drawing and trace it into a scalable SVG image
- **Fully customizable look and feel** — colors, fonts, borders, scrollbars, and more, both globally and per-object
- **Save / Load** — export and import your canvas as a `.json` file
- **Export** — render the canvas (or just your selection) to a printable SVG/PDF

## Nodes

A Node is a resizable sticky note with a title and body text. Pick the Node tool and click (or click-drag) on the canvas to place one, then double-click it to start typing. Drag its edges or corners to resize it, and drag its body to move it.

## Synapses

A Synapse is a connection between two Nodes. Pick the Synapse tool (or just drag from a Node's blue port) and drop it on another Node's port to link them. Double-click a synapse to add a bend point, and drag its arrowheads or bends to reshape the path.

## Images

Use the Image button on the toolbar to import an image and convert it to an SVG image, then drop it onto the canvas like any other element.

## Properties & Styling

Select a Node, Synapse, or Image to edit its properties in the panel on the right. Use the top and left panels to change canvas-wide defaults — colors, fonts, borders, and more.

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `S` | Switch to the Select tool |
| `N` | Switch to the Node tool |
| `X` | Switch to the Synapse tool |
| `Delete` / `Backspace` | Delete the current selection |
| `Ctrl`/`Cmd` + `Z` | Undo |
| `Ctrl`/`Cmd` + `C` | Copy the current selection |
| `Ctrl`/`Cmd` + `V` / `P` | Paste at the cursor's position |
| `Ctrl`/`Cmd` + `S` | Open the Save dialog |
| `Ctrl`/`Cmd` + `B` | Toggle bold while editing text |
| `Ctrl`/`Cmd` + `I` | Toggle italic while editing text |
| Arrow keys | Nudge the selection, or pan the canvas if nothing is selected |
| `Shift` + Arrow keys | Jump the selection (or pan faster) in larger steps |
| `Ctrl`/`Cmd` + click | Add or remove a Node/Image from the selection |
| Scroll wheel | Zoom the canvas, or adjust a hovered number field |
| Middle-click + drag | Pan the canvas, or scrub-adjust a hovered number field |
| `Escape` | Return to the Select tool; press twice to close open panels |

> This in-app help is also available any time from the **New** button, and its source data lives at [`public/help.json`](public/help.json).
