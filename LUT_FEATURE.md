# LUT Preview Feature

This document outlines the implementation details and architecture of the newly added LUT Preview feature in Wrap Preview.

## Overview

The LUT Preview feature allows users to apply 3D LUTs (`.cube` format) to their projects. This provides a direct, non-destructive preview of the color grade applied to the clip thumbnails directly within the application, assisting in review, rating, and organization of footage.

Users can enable and disable the applied LUT on a per-clip basis. The current enabled state of the LUT is used not only in the application's timeline and clip lists but also propagates directly onto exported rich elements (such as Image and PDF contact sheets).

## Architecture & Data Flow

1. **Database Schema:**
   * A new global `project_settings` table stores the `lut_path`, `lut_name`, and `lut_hash` on a per-project basis.
   * A new `lut_enabled` field in the `clips` table allows toggling of LUTs per clip (0 = disabled, 1 = enabled).

2. **Backend Parsing & Application:**
   * **Parsing:** `.cube` files are parsed via a custom `Lut3D` parser in `src-tauri/src/lut.rs`. It reads dimensions and maps values into a standard float space.
   * **Application:** Uses Trilinear Interpolation to sample the 3D LUT space and apply it efficiently to each pixel of incoming thumbnails.

3. **Background Thumbnail Generation:**
   * When a LUT is loaded, the backend fires off a background job (`generate_lut_thumbnails`) running through `state.job_manager`.
   * Thumbnails are processed incrementally in batches (concurrency of 8) to avoid memory spikes. The new thumbnails are saved back to the cache with `lut_{hash}_{base_filename}.jpg`.

4. **Frontend Toggle & Rendering Logic:**
   * We skip regenerating URLs on the frontend and instead rely on dynamic path modification. If `clip.lut_enabled` is set and a `projectLut?.hash` is loaded into state, `FilmStrip` modifies the `asset://` url natively to target the new LUT thumbnail cache path dynamically. If for any reason the LUT failed to generate, the `onError` handler reverts the thumbnail back to the unmodified camera original.

## Commands

* `set_project_lut(project_id, file_path)`: Loads and commits a LUT to the project settings, triggering rendering.
* `remove_project_lut(project_id)`: Unsets the project LUT setting from the db.
* `set_clip_lut_enabled(clip_id, enabled)`: Sets the `lut_enabled` toggle for that clip.
* `generate_lut_thumbnails(project_id)`: Crawls cache directories reading original thumbnails and burning in LUT colors, producing shadow variants.
