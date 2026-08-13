import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, FolderOpen, X } from "lucide-react";
import { openPath } from "@tauri-apps/plugin-opener";
import { invokeGuarded } from "../utils/tauri";
import { AppInfo, V12ReadinessReport } from "../types";

interface SettingsPanelProps {
  open: boolean;
  info: AppInfo | null;
  onClose: () => void;
}

export function SettingsPanel({ open, info, onClose }: SettingsPanelProps) {
  const [cacheDir, setCacheDir] = useState<string>("");
  const [readiness, setReadiness] = useState<V12ReadinessReport | null>(null);
  const formatStatus = (s?: string | null) => (s || "Unavailable").replace(/_/g, " ");

  useEffect(() => {
    if (open) {
      invokeGuarded<string>("get_cache_dir")
        .then(setCacheDir)
        .catch((e) => console.error("get_cache_dir failed", e));
      invokeGuarded<V12ReadinessReport>("production_get_v12_readiness_report")
        .then(setReadiness)
        .catch((e) => console.error("production_get_v12_readiness_report failed", e));
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="jobs-drawer-backdrop" onClick={onClose}>
      <div className="about-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "520px" }}>
        <div className="jobs-header">
          <h3>Settings</h3>
          <button className="btn-link" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="about-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)", gap: "12px 24px" }}>
          <div><strong>Version</strong><p>{info?.version ?? "—"}</p></div>
          <div><strong>Platform</strong><p>{info?.arch ?? "—"}</p></div>
          <div><strong>BRAW Bridge</strong><p>{info?.braw_bridge_active ? "Active" : "Not Detected"}</p></div>
          <div><strong>LibRaw Bridge</strong><p>{info?.libraw_bridge_active ? "Frame Decode" : formatStatus(info?.libraw_bridge_status)}</p></div>
          <div><strong>OCIO Config</strong><p>{formatStatus(info?.ocio_config_status)} · {formatStatus(info?.ocio_config_source)}</p></div>
          <div><strong>OCIO Processor</strong><p>{info?.ocio_processor_active ? "Active" : formatStatus(info?.ocio_processor_status)}</p></div>
        </div>

        <div style={{ marginTop: 20 }}>
          <strong style={{ fontSize: 11, opacity: 0.6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            V1.2 RAW / OCIO Readiness
          </strong>
          <div style={{ marginTop: 8, padding: "10px 12px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, background: "rgba(0,0,0,0.1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 12, opacity: 0.78 }}>
                {readiness ? `${readiness.ready_count}/${readiness.total_count} checks ready` : "Checking readiness..."}
              </span>
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                color: readiness?.release_ready ? "#9be7b0" : "#ffd37a",
                whiteSpace: "nowrap",
              }}>
                {readiness?.release_ready ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                {readiness?.release_ready ? "Release ready" : "Blocked"}
              </span>
            </div>
            <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
              {(readiness?.items ?? []).map((item) => (
                <div key={item.id} title={item.detail} style={{ display: "grid", gridTemplateColumns: "18px 1fr", alignItems: "center", gap: 6 }}>
                  {item.status === "ready" ? (
                    <CheckCircle2 size={13} color="#9be7b0" />
                  ) : (
                    <AlertTriangle size={13} color="#ffd37a" />
                  )}
                  <span style={{ fontSize: 11, opacity: item.status === "ready" ? 0.72 : 0.9, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <strong style={{ fontSize: 11, opacity: 0.6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Storage
          </strong>
          <div style={{ marginTop: 8, padding: "10px 12px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, background: "rgba(0,0,0,0.1)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, opacity: 0.7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                {cacheDir || "Loading…"}
              </span>
              <button
                className="btn btn-secondary btn-xs"
                title="Open cache folder"
                disabled={!cacheDir}
                onClick={() => openPath(cacheDir).catch(() => {})}
              >
                <FolderOpen size={12} style={{ marginRight: 4 }} />
                Open Folder
              </button>
            </div>
            <p style={{ fontSize: 11, opacity: 0.45, marginTop: 6, marginBottom: 0 }}>
              Thumbnails, proxies, and temporary files are stored here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
