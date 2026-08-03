---
title: Architecture
description: CineFlow Suite application architecture and module boundaries.
---

# Architecture

CineFlow Suite is a cross-platform desktop application built around production workflows for filmmakers.

## Stack

- Tauri for the desktop shell and Rust backend
- React and TypeScript for the frontend
- Vite for the application build
- SQLite for local persistent data
- FFmpeg for media processing
- BRAW decode tooling for Blackmagic RAW workflows

## Modules

The top-level application is organized around:

- Modules overview
- Pre-production
- Production
- Post-production

Each module contains independent tools that share project, export, branding, and media-processing infrastructure where appropriate.

## Reliability Philosophy

The system must fail safely. If decoding, thumbnailing, export, or copy verification fails, the app should surface the error, allow retry where possible, and avoid crashing the desktop application.

