import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { jsPDF } from "jspdf";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type {
  ShotListEquipmentItem,
  ShotListEquipmentSection,
  ShotListProject,
  ShotListRow,
} from "../types";
import { getShotListIconComponent } from "../modules/PreProduction/ShotListConfig";

// Layout grid (A4 @ ~300dpi). Geometry is unchanged from the previous
// version — only the visual language was refined: near-monochrome palette,
// hairline rules instead of heavy borders/shadows, lighter type, and icons
// pared back to one small glyph per shot / per inventory section.
const EXPORT_PAGE_WIDTH = 2480;
const EXPORT_PAGE_HEIGHT = 3508;
const EXPORT_MARGIN_X = 120;
const EXPORT_SAFE_Y = 180;

const COLORS = {
  PAGE_BG: "#f4f4f5", // zinc-100, soft neutral paper
  CARD_BG: "#ffffff",
  INK: "#18181b",     // zinc-900 — headings and values
  BODY: "#3f3f46",    // zinc-700 — descriptions
  MUTED: "#71717a",   // zinc-500 — labels, secondary
  FAINT: "#a1a1aa",   // zinc-400 — footer, hints
  HAIRLINE: "#e4e4e7", // zinc-200 — card borders
  RULE: "#d4d4d8",    // zinc-300 — internal dividers
  GLYPH: "#52525b",   // zinc-600 — the few icons that remain
} as const;

const CAMERA_SETUP_DELIMITER = "__SLCAM__";
const LOCATION_TIME_DELIMITER = "__SLTIME__";
// Minimal wordmark: dark rounded square, no colour.
const LOGO_DATA_URL =
  "data:image/svg+xml;base64," +
  btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none">' +
      '<rect x="6" y="6" width="52" height="52" rx="14" fill="#18181b"/>' +
      '<rect x="40" y="18" width="7" height="28" rx="3.5" fill="#a1a1aa"/>' +
      "</svg>",
  );

interface ShotListExportPayload {
  project: ShotListProject;
  rows: ShotListRow[];
  sections: ShotListEquipmentSection[];
  items: ShotListEquipmentItem[];
  appVersion?: string;
  brandName?: string;
  clientName?: string;
}

interface RowLayoutInfo {
  row: ShotListRow;
  height: number;
  descriptionLines: string[];
  setups: string[];
}

const iconCacheMap = new Map<string, Promise<string>>();

/** SVG icon → raster data URL. Thin stroke, single grey. */
async function getRasterIconUrl(name: string, size = 48, color: string = COLORS.GLYPH): Promise<string> {
  const key = `${name}:${size}:${color}`;
  if (!iconCacheMap.has(key)) {
    iconCacheMap.set(key, (async () => {
      try {
        const Icon = getShotListIconComponent(name);
        const svg = renderToStaticMarkup(createElement(Icon, { size: size - 12, color, strokeWidth: 1.9 }));
        const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><g transform="translate(6, 6)">${svg}</g></svg>`;
        const blob = new Blob([fullSvg], { type: "image/svg+xml" });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        return await new Promise<string>((res) => {
          img.onload = () => {
            const cv = document.createElement("canvas");
            cv.width = size * 2; cv.height = size * 2;
            const ctx = cv.getContext("2d")!; ctx.scale(2, 2);
            ctx.drawImage(img, 0, 0, size, size);
            URL.revokeObjectURL(url);
            res(cv.toDataURL("image/png"));
          };
          img.onerror = () => res("");
          img.src = url;
        });
      } catch { return ""; }
    })());
  }
  return iconCacheMap.get(key)!;
}

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = (text || "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let cur = words[0];
  for (let i = 1; i < words.length; i++) {
    const w = words[i];
    if (ctx.measureText(`${cur} ${w}`).width < maxW) cur += ` ${w}`;
    else { lines.push(cur); cur = w; }
  }
  lines.push(cur);
  return lines;
}

function solveProductionLayout(ctx: CanvasRenderingContext2D, rows: ShotListRow[]): RowLayoutInfo[][] {
  const pages: RowLayoutInfo[][] = [];
  let currentBatch: RowLayoutInfo[] = [];
  let cy = 350;
  const limit = EXPORT_PAGE_HEIGHT - (EXPORT_SAFE_Y + 150);

  for (const row of rows) {
    ctx.font = "400 38px Inter, sans-serif";
    const dLines = wrapCanvasText(ctx, row.description || "Action description not defined.", EXPORT_PAGE_WIDTH - 400);
    const setups = (row.camera_lens || "").split("\n").filter(s => s.trim().length > 0);
    const h = 220 + (dLines.length * 56) + 280 + (setups.length > 0 ? 120 + (setups.length * 104) : 0) + 60;

    if (cy + h > limit && currentBatch.length > 0) {
      pages.push(currentBatch); currentBatch = []; cy = 350;
    }
    currentBatch.push({ row, height: h, descriptionLines: dLines, setups });
    cy += h + 60;
  }
  if (currentBatch.length > 0) pages.push(currentBatch);
  return pages;
}

function drawExportFooter(ctx: CanvasRenderingContext2D, appName: string, pageLabel: string, canvasHeight: number) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = COLORS.FAINT;
  ctx.font = "400 20px Inter, sans-serif";
  ctx.fillText(
    `${appName}   ·   ${pageLabel}   ·   © Alan Alves. All rights reserved.`,
    EXPORT_PAGE_WIDTH / 2,
    canvasHeight - 64,
  );
  ctx.restore();
}

async function renderHeader(ctx: CanvasRenderingContext2D, payload: ShotListExportPayload, title: string, pageLabel: string) {
  const mx = EXPORT_MARGIN_X;
  const right = EXPORT_PAGE_WIDTH - mx;

  const logo = await safeLoad(LOGO_DATA_URL);
  if (logo) ctx.drawImage(logo, mx, 96, 84, 84);

  ctx.textAlign = "left";
  ctx.fillStyle = COLORS.MUTED;
  ctx.font = "500 20px Inter, sans-serif";
  ctx.fillText("PRODUCTION PORTAL", mx + 116, 116);

  ctx.fillStyle = COLORS.INK;
  ctx.font = "600 68px Inter, sans-serif";
  ctx.fillText(trimText(ctx, title, EXPORT_PAGE_WIDTH - 900), mx + 116, 178);

  ctx.fillStyle = COLORS.MUTED;
  ctx.font = "400 24px Inter, sans-serif";
  ctx.fillText(payload.clientName || payload.brandName || "Wrap Studio", mx + 116, 212);

  // Right-aligned meta: day / status, then page.
  ctx.textAlign = "right";
  ctx.fillStyle = COLORS.MUTED;
  ctx.font = "500 18px Inter, sans-serif";
  ctx.fillText("DAY / STATUS", right, 108);
  ctx.fillStyle = COLORS.INK;
  ctx.font = "500 28px Inter, sans-serif";
  ctx.fillText(trimText(ctx, payload.project.day_label || "Day 01", 620), right, 144);

  ctx.fillStyle = COLORS.MUTED;
  ctx.font = "400 22px Inter, sans-serif";
  ctx.fillText(`Page ${pageLabel}`, right, 196);
  ctx.textAlign = "left";

  // Single hairline rule under the header.
  ctx.strokeStyle = COLORS.RULE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(mx, 250);
  ctx.lineTo(right, 250);
  ctx.stroke();
}

async function exportProductionPage(payload: ShotListExportPayload, items: RowLayoutInfo[], idx: number, total: number, targetH?: number) {
  const cn = document.createElement("canvas");
  cn.width = EXPORT_PAGE_WIDTH; cn.height = targetH || EXPORT_PAGE_HEIGHT;
  const ctx = cn.getContext("2d")!;
  ctx.fillStyle = COLORS.PAGE_BG; ctx.fillRect(0, 0, cn.width, cn.height);
  await renderHeader(ctx, payload, "Production Shot List", `${idx + 1}/${total}`);

  let y = 350;
  for (const info of items) {
    const rw = EXPORT_PAGE_WIDTH - EXPORT_MARGIN_X * 2;
    const mx = EXPORT_MARGIN_X;

    // Plain card: white, hairline border, whisper shadow.
    ctx.shadowColor = "rgba(0,0,0,0.05)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
    ctx.fillStyle = COLORS.CARD_BG; roundRect(ctx, mx, y, rw, info.height, 20, true, false);
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.strokeStyle = COLORS.HAIRLINE; ctx.lineWidth = 2; roundRect(ctx, mx, y, rw, info.height, 20, false, true);

    // Shot number + one small capture glyph.
    ctx.fillStyle = COLORS.INK; ctx.font = "700 56px Inter, sans-serif";
    ctx.fillText(`${info.row.sort_order}`.padStart(2, "0"), mx + 80, y + 92);
    const mIcoData = await getRasterIconUrl(info.row.capture_type === "photo" ? "photo" : "video", 44, COLORS.GLYPH);
    const mIco = await safeLoad(mIcoData);
    if (mIco) ctx.drawImage(mIco, mx + 176, y + 52, 44, 44);

    ctx.fillStyle = COLORS.INK; ctx.font = "600 54px Inter, sans-serif";
    const titleText = [info.row.shot_number || "SHOT", info.row.scene].filter(Boolean).join(" — ");
    ctx.fillText(trimText(ctx, titleText, rw - 480), mx + 250, y + 92);

    ctx.fillStyle = COLORS.MUTED; ctx.font = "500 28px Inter, sans-serif";
    const movement = (info.setups[0] || "").split(CAMERA_SETUP_DELIMITER)[5] || "Static";
    const subline = `${info.row.shot_type || "Medium"}  ·  ${movement}`;
    ctx.fillText(trimText(ctx, subline, rw - 400), mx + 250, y + 140);

    ctx.fillStyle = COLORS.BODY; ctx.font = "400 38px Inter, sans-serif";
    info.descriptionLines.forEach((line, i) => ctx.fillText(line, mx + 80, y + 225 + i * 58));

    const gy = y + 245 + (info.descriptionLines.length * 58);
    const cw = (rw - 180) / 3;
    const drawMetaCell = (c: number, r: number, lbl: string, val: string) => {
      const gx = mx + 80 + c * cw; const gcy = gy + r * 115;
      ctx.fillStyle = COLORS.MUTED; ctx.font = "500 18px Inter, sans-serif";
      ctx.fillText(lbl.toUpperCase(), gx, gcy - 22);
      ctx.fillStyle = COLORS.INK; ctx.font = "500 32px Inter, sans-serif";
      ctx.fillText(trimText(ctx, val || "—", cw - 40), gx, gcy + 22);
    };

    drawMetaCell(0, 0, "Location / Timing", getFormattedLoc(info.row));
    drawMetaCell(1, 0, "Scene Group", info.row.scene || "Intro");
    drawMetaCell(2, 0, "Talent", info.row.talent_subjects || "—");
    drawMetaCell(0, 1, "Props", info.row.props_details || "—");
    drawMetaCell(1, 1, "Audio Notes", info.row.audio_notes || "—");
    drawMetaCell(2, 1, "Lighting", info.row.lighting_notes || "—");

    if (info.setups.length > 0) {
      const sy = y + 490 + (info.descriptionLines.length * 58);
      ctx.fillStyle = COLORS.MUTED; ctx.font = "500 18px Inter, sans-serif";
      ctx.fillText("CAMERA REGISTRATIONS", mx + 80, sy - 12);
      ctx.strokeStyle = COLORS.RULE; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(mx + 80, sy + 4); ctx.lineTo(mx + rw - 100, sy + 4); ctx.stroke();

      for (let si = 0; si < info.setups.length; si++) {
        const parts = info.setups[si].split(CAMERA_SETUP_DELIMITER).map(v => v.trim());
        const by = sy + 60 + si * 104;
        if (si > 0) {
          ctx.strokeStyle = COLORS.HAIRLINE; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(mx + 80, by - 52); ctx.lineTo(mx + rw - 100, by - 52); ctx.stroke();
        }
        ctx.fillStyle = COLORS.INK; ctx.font = "600 26px Inter, sans-serif";
        ctx.fillText(`CAM 0${si + 1}`, mx + 80, by + 8);
        const drawSub = (ox: number, sl: string, sv: string, sw: number) => {
          ctx.fillStyle = COLORS.MUTED; ctx.font = "500 15px Inter, sans-serif";
          ctx.fillText(sl.toUpperCase(), mx + ox, by - 16);
          ctx.fillStyle = COLORS.INK; ctx.font = "500 25px Inter, sans-serif";
          ctx.fillText(trimText(ctx, sv || "—", sw), mx + ox, by + 18);
        };
        drawSub(300, "Body", parts[0], 360);
        drawSub(720, "Lens", parts[1], 360);
        drawSub(1140, "Media", parts[3], 260);
        drawSub(1460, "Support", parts[4], 260);
        drawSub(1780, "Movement", parts[5], 260);
      }
    }
    y += info.height + 60;
  }
  drawExportFooter(ctx, payload.brandName || "CineFlow Suite", `${idx + 1}/${total}`, targetH || EXPORT_PAGE_HEIGHT);
  return cn;
}

export async function exportShotListPdf(payload: ShotListExportPayload) {
  try {
    const p = await save({ filters: [{ name: "PDF Export", extensions: ["pdf"] }], defaultPath: `${payload.project.title}_Shot_List.pdf` });
    if (!p) return false;
    const dummy = document.createElement("canvas"); dummy.width = 1; dummy.height = 1;
    const layouts = solveProductionLayout(dummy.getContext("2d")!, payload.rows);
    const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
    for (let i = 0; i < layouts.length; i++) {
        if (i > 0) doc.addPage();
        const cn = await exportProductionPage(payload, layouts[i], i, layouts.length);
        doc.addImage(cn.toDataURL("image/png"), "PNG", 0, 0, 210, 297);
    }
    if (payload.sections.length > 0) {
      const inv = await renderInventory(payload);
      for (const ic of inv) { doc.addPage(); doc.addImage(ic.toDataURL("image/png"), "PNG", 0, 0, 210, 297); }
    }
    await writeFile(p, new Uint8Array(doc.output("arraybuffer")));
    return true;
  } catch (e) { return false; }
}

export async function exportShotListImage(payload: ShotListExportPayload) {
  try {
    const p = await save({ filters: [{ name: "Image Export", extensions: ["png"] }], defaultPath: `${payload.project.title}_Shot_List.png` });
    if (!p) return false;
    const dummy = document.createElement("canvas"); dummy.width = 1; dummy.height = 1;
    const layouts = solveProductionLayout(dummy.getContext("2d")!, payload.rows);
    const totalH = layouts.length * EXPORT_PAGE_HEIGHT;
    const finalCn = document.createElement("canvas");
    finalCn.width = EXPORT_PAGE_WIDTH; finalCn.height = totalH;
    const fctx = finalCn.getContext("2d")!;
    fctx.fillStyle = COLORS.PAGE_BG; fctx.fillRect(0, 0, finalCn.width, finalCn.height);
    for (let i = 0; i < layouts.length; i++) {
        const pageCn = await exportProductionPage(payload, layouts[i], i, layouts.length);
        fctx.drawImage(pageCn, 0, i * EXPORT_PAGE_HEIGHT);
    }
    const bin = atob(finalCn.toDataURL("image/png").split(",")[1]);
    const b = new Uint8Array(bin.length);
    for (let l = 0; l < bin.length; l++) b[l] = bin.charCodeAt(l);
    await writeFile(p, b);
    return true;
  } catch (e) { return false; }
}

function getFormattedLoc(r: ShotListRow) {
  if (r.location || r.timing) return [r.location, r.timing].filter(Boolean).join(" / ") || "—";
  const p = (r.location_time || "").split(LOCATION_TIME_DELIMITER).map(s => s.trim());
  return [p[0], p[1] && p[2] ? `${p[1]}-${p[2]}` : p[1] || p[2]].filter(Boolean).join(" / ") || "—";
}

async function safeLoad(u: string): Promise<HTMLImageElement | null> {
  const i = new Image(); i.src = u;
  return new Promise(res => { i.onload = () => res(i); i.onerror = () => res(null); });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, f: boolean, s: boolean) {
  const r2 = Math.min(r, w/2, h/2); ctx.beginPath(); ctx.moveTo(x+r2, y); ctx.arcTo(x+w, y, x+w, y+h, r2); ctx.arcTo(x+w, y+h, x, y+h, r2); ctx.arcTo(x, y+h, x, y, r2); ctx.arcTo(x, y, x+w, y, r2); ctx.closePath();
  if (f) ctx.fill(); if (s) ctx.stroke();
}

function trimText(ctx: CanvasRenderingContext2D, t: string, m: number) {
  if (ctx.measureText(t || "—").width <= m) return t || "—";
  let s = t || "—"; while (s.length > 1 && ctx.measureText(`${s}…`).width > m) s = s.slice(0, -1);
  return `${s}…`;
}

async function renderInventory(p: ShotListExportPayload) {
  const pgs: HTMLCanvasElement[] = [];
  let cy = 350; let col = 0; const gap = 60; const cw = (EXPORT_PAGE_WIDTH - EXPORT_MARGIN_X * 2 - gap) / 2;
  const offs = [EXPORT_MARGIN_X, EXPORT_MARGIN_X + cw + gap];
  const setupBase = async (pg: number) => createExportCanvas(p, "Equipment Inventory", `${pg + 1}/?`);

  let res = await setupBase(0); let canvas = res.cn; let ctx = res.ctx;
  for (const s of p.sections) {
    const its = p.items.filter(i => i.section_id === s.id).sort((a,b) => a.sort_order - b.sort_order);
    if (!its.length) continue;
    const h = 150 + its.length * 84;
    if (cy + h > EXPORT_PAGE_HEIGHT - 240) {
      if (col === 0) { col = 1; cy = 350; }
      else {
        drawExportFooter(ctx, p.brandName || "CineFlow Suite", `${pgs.length + 1}`, EXPORT_PAGE_HEIGHT);
        pgs.push(canvas); res = await setupBase(pgs.length);
        canvas = res.cn; ctx = res.ctx; cy = 350; col = 0;
      }
    }
    const x = offs[col];

    ctx.shadowColor = "rgba(0,0,0,0.05)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
    ctx.fillStyle = COLORS.CARD_BG; roundRect(ctx, x, cy, cw, h, 20, true, false);
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.strokeStyle = COLORS.HAIRLINE; ctx.lineWidth = 2; roundRect(ctx, x, cy, cw, h, 20, false, true);

    const icoData = await getRasterIconUrl(s.icon_name, 40, COLORS.GLYPH);
    const img = await safeLoad(icoData); if (img) ctx.drawImage(img, x + 40, cy + 44, 40, 40);
    ctx.fillStyle = COLORS.INK; ctx.font = "600 34px Inter, sans-serif";
    ctx.fillText(trimText(ctx, s.section_name, cw - 140), x + 96, cy + 72);
    ctx.strokeStyle = COLORS.RULE; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + 40, cy + 104); ctx.lineTo(x + cw - 40, cy + 104); ctx.stroke();

    let iy = cy + 150;
    for (let k = 0; k < its.length; k++) {
      const i = its[k];
      if (k > 0) {
        ctx.strokeStyle = COLORS.HAIRLINE; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x + 40, iy - 18); ctx.lineTo(x + cw - 40, iy - 18); ctx.stroke();
      }
      ctx.fillStyle = COLORS.INK; ctx.font = "500 26px Inter, sans-serif";
      ctx.fillText(trimText(ctx, i.item_name, cw - 96), x + 40, iy + 14);
      const meta = [i.camera_label, i.media_type, i.capacity_value ? `${i.capacity_value}${i.capacity_unit}` : "", i.notes]
        .filter(Boolean).join("  ·  ");
      if (meta) {
        ctx.fillStyle = COLORS.MUTED; ctx.font = "400 19px Inter, sans-serif";
        ctx.fillText(trimText(ctx, meta, cw - 96), x + 40, iy + 46);
      }
      iy += 84;
    }
    cy += h + 40;
  }
  drawExportFooter(ctx, p.brandName || "CineFlow Suite", `${pgs.length + 1}`, EXPORT_PAGE_HEIGHT);
  pgs.push(canvas);
  return pgs;
}

async function createExportCanvas(p: ShotListExportPayload, t: string, pl: string) {
  const cn = document.createElement("canvas");
  cn.width = EXPORT_PAGE_WIDTH; cn.height = EXPORT_PAGE_HEIGHT;
  const ctx = cn.getContext("2d")!;
  ctx.fillStyle = COLORS.PAGE_BG; ctx.fillRect(0, 0, EXPORT_PAGE_WIDTH, EXPORT_PAGE_HEIGHT);
  await renderHeader(ctx, p, t, pl);
  return { cn, ctx };
}
