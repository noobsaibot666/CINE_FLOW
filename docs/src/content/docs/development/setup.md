---
title: Development Setup
description: Local development setup for CineFlow Suite and its documentation.
---

# Development Setup

## Application

From the repository root:

```bash
npm install
npm run dev
```

Run type checks with:

```bash
npm run lint
```

Build the desktop web bundle with:

```bash
npm run build
```

## Documentation

From the docs project:

```bash
cd docs
npm install
npm run build
```

The documentation build output is written to:

```text
docs/dist/
```

For the shared docs hub, place that output at:

```text
docs-site/dist/cineflow/
```

