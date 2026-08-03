---
title: Release Readiness
description: Release validation notes for CineFlow Suite.
---

# Release Readiness

Release validation should cover both the desktop app and the documentation output.

## Desktop App Checks

- TypeScript build passes.
- Tauri packaging completes for the target platform.
- Sidecar binaries are present and executable.
- Media processing jobs complete as `done` or `failed`.
- Exported PDFs and images use the current CineFlow branding.
- Trial, licensing, and activation flows are checked.

## Documentation Checks

- `docs/astro.config.mjs` uses `site: "https://docs.alan-design.com"`.
- `docs/astro.config.mjs` uses `base: "/cineflow"`.
- Literal markdown body links or images that start with `/` include `/cineflow/`.
- `npm run build` succeeds from `docs/`.
- Built output is handed off from `docs/dist/` for placement under the shared hub.

