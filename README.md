# LogSeeker

> **Work in Progress**
>
> This project is under active development. Features and APIs may change.

LogSeeker is a local, web-based log search application. It runs on your machine and lets you index and search `.log` / `.txt` files in configured directories via a browser.

- **Backend**: Rust (Rocket)
- **Full-text search**: Tantivy
- **Core model**: Project = multiple log directories (Sources) + configuration + index

---

## Table of Contents

- [Features](#features)
- [Use Cases](#use-cases)
- [Pros & Limitations](#pros--limitations)
- [Quick Start](#quick-start)
- [Common APIs (Dev)](#common-apis-dev)
- [Project Structure](#project-structure)
- [Roadmap](#roadmap)

---

## Features

### Implemented (MVP in progress)

- **Project management**
  - Create project
  - List projects
  - Persist configuration: `data/projects.json`
- **Index rebuild & status**
  - Full rebuild: recursively scan `.log/.txt` under configured directories
  - Multi-line event merging (stacktraces)
  - Timestamp parsing (default timezone: `+08:00`)
  - Status endpoint: running/idle/error, files scanned, events indexed

### Planned

- **Search**
  - AND / OR / NOT
  - Parentheses, phrases, and field filters
  - Results sorted by timestamp (descending)
  - Keyword highlighting
- **Project settings**
  - Add source directories (Option A: type the path string + validation)
  - One-click index rebuild with progress
- **Result details & context**
  - View full event content
  - View surrounding context lines
- **Incremental indexing & file watching**
  - Better experience for large files and continuously written logs

---

## Use Cases

- **Dev / QA troubleshooting**: quickly find errors, timeouts, and stack traces across large logs
- **Ops / local log analysis**: offline search without relying on cloud log platforms
- **Multi-project investigation**: isolate sources and indexes per service/directory

---

## Pros & Limitations

### Pros

- **Local-first**: binds to `127.0.0.1` by default
- **Performance & scalability**: Rust + Tantivy, suitable for large files and frequent queries
- **Project-based management**: multiple projects and sources with isolated configuration and indexes

### Limitations (current stage)

- **Work in progress**: features and APIs may change
- **MVP indexing strategy**: currently focused on full rebuild; incremental / rotation handling is planned
- **Timestamp-driven parsing**: lines not matching the timestamp pattern may be skipped in the MVP (will be improved)

---

## Quick Start

### 1) Start the backend

From the repository root (`LogSeeker/`):

```bash
cargo run -p logseeker-server
```

After startup, the server prints the local URL:

```text
LogSeeker: http://127.0.0.1:PORT
```

### 2) Start the frontend (dev mode)

From the `web/` directory:

```bash
npm install
npm run dev
```

> In dev mode, the frontend uses a Vite proxy for `/api/*`.

---

## Common APIs (Dev)

- Health check: `GET /api/health`
- List projects: `GET /api/projects`
- Create project: `POST /api/projects`
- Trigger indexing: `POST /api/projects/<id>/index/rebuild`
- Index status: `GET /api/projects/<id>/index/status`

---

## Project Structure

- `server/`: Rust backend (Rocket)
- `web/`: frontend app (React + Vite)
- `data/`: runtime data (project config, index directories, etc.)

---

## Roadmap

- **MVP**
  - Project management
  - Full rebuild indexing + multi-line event merging
  - Index status endpoint
- **v1**
  - Query syntax (AND/OR/NOT/parentheses/phrases/fields)
  - Time-desc results + highlighting
  - Details and context
- **v2**
  - Incremental indexing and file watching
  - More structured field extraction (level/thread/module, etc.)
