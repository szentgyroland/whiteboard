# Whiteboard — Project Planner

A lightweight, fast, locally-stored project planning app.

## Features

- **Mind Map view** — 2D canvas with pan & zoom, draggable idea bubbles, marquee multi-select, manual idea grouping bubbles, and bubble-to-bubble connections
- **Board view** — Jira-style Kanban columns (Backlog → To Do → In Progress → In Review → Done)
- **Multi-project** — unlimited projects, each with its own board and canvas
- **Import / export** — create projects from exported JSON files, export full projects (ideas, groups, and connections), and export an empty JSON blueprint for AI-assisted project creation
- **Ideas** — title, description, theme, priority (Low / Medium / High / Critical), status, deadline
- **Connections** — drag a port handle from one idea to another to link them; click a line to delete it
- **Local storage** — all data stored in your browser; no server required

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Usage

| Action | How |
|---|---|
| Create idea (canvas) | Double-click empty space, or click **Add Idea** |
| Move idea | Drag the card |
| Connect ideas | Hover a card → drag the small port circle to another card |
| Marquee select ideas | Right-drag on empty canvas |
| Group / ungroup / delete selected ideas | Use the top selection toolbar after marquee or click selection |
| Connect groups | Drag a port on one group bubble to another group bubble |
| Delete connection | Click the connection line |
| Edit idea | Double-click card, or select + click **Edit** |
| Import project | Click **New project** and choose a JSON file |
| Export blueprint | Click **New project** → **Export Blueprint** |
| Export project | Open **Edit Project** and click **Export JSON** |
| Pan canvas | Left-drag empty space, or Alt/middle-drag |
| Zoom canvas | Scroll wheel |

## Stack

- **React 18** + **Vite 5** — fast dev & tiny production build (~60 KB gzipped)
- **Zustand** — 1 KB state manager with `localStorage` persistence
- **Tailwind CSS** — utility-first styling, only used classes included
- No canvas libraries; connections are SVG paths, nodes are DOM elements
