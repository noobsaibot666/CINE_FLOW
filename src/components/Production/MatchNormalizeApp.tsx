import React, { useEffect, useMemo, useState } from "react";
import { Download, Save } from "lucide-react";
import {
  ProductionCameraConfig,
  ProductionLookSetup,
  ProductionMatchLabRun,
  ProductionMatchLabRunSummary,
  ProductionMatchPresetPayload,
  ProductionPreset,
  ProductionProject,
} from "../../types";
import { exportProductionPdf } from "../../utils/ProductionExport";
import { invokeGuarded } from "../../utils/tauri";
import { buildMatchPresetPayload, parseLookOutputs } from "./productionLogic";

interface MatchNormalizeAppProps {
  project: ProductionProject;
  onBack?: () => void;
}

export function MatchNormalizeApp({ project }: MatchNormalizeAppProps) {
  const [cameraConfigs, setCameraConfigs] = useState<ProductionCameraConfig[]>([]);
  const [setup, setSetup] = useState<ProductionLookSetup | null>(null);
  const [heroSlot, setHeroSlot] = useState("A");
  const [presetName, setPresetName] = useState("");
  const [presets, setPresets] = useState<ProductionPreset[]>([]);
  const [matchLabRuns, setMatchLabRuns] = useState<ProductionMatchLabRunSummary[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<ProductionMatchLabRun | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, [project.id]);

  useEffect(() => {
    if (!selectedRunId) {
      setSelectedRun(null);
      return;
    }
    let cancelled = false;
    const loadRun = async () => {
      try {
        const run = await invokeGuarded<ProductionMatchLabRun | null>("production_matchlab_get_run", { runId: selectedRunId });
        if (cancelled) return;
        setSelectedRun(run);
        if (run?.hero_slot) {
          setHeroSlot(run.hero_slot);
        }
      } catch {
        if (!cancelled) setSelectedRun(null);
      }
    };
    void loadRun();
    return () => {
      cancelled = true;
    };
  }, [selectedRunId]);

  const load = async () => {
    setLoading(true);
    try {
      const [configs, savedSetup, savedPresets, savedRuns] = await Promise.all([
        invokeGuarded<ProductionCameraConfig[]>("list_production_camera_configs", { projectId: project.id }),
        invokeGuarded<ProductionLookSetup | null>("production_get_look_setup", { projectId: project.id }),
        invokeGuarded<ProductionPreset[]>("production_list_presets", { projectId: project.id }),
        invokeGuarded<ProductionMatchLabRunSummary[]>("production_matchlab_list_runs", { projectId: project.id }),
      ]);
      setCameraConfigs(configs);
      setSetup(savedSetup);
      setPresets(savedPresets);
      setMatchLabRuns(savedRuns);
      setSelectedRunId((current) => current ?? savedRuns[0]?.run_id ?? null);

      const savedOutputs = parseLookOutputs(savedSetup?.outputs_json);
      if (savedOutputs?.hero_slot && configs.some((config) => config.slot === savedOutputs.hero_slot)) {
        setHeroSlot(savedOutputs.hero_slot);
      } else if (configs[0]?.slot) {
        setHeroSlot(configs[0].slot);
      } else {
        setHeroSlot("A");
      }
    } catch (error) {
      console.error("Failed to load match & normalize state", error);
      setCameraConfigs([]);
      setSetup(null);
      setPresets([]);
      setMatchLabRuns([]);
      setSelectedRunId(null);
      setSelectedRun(null);
      setHeroSlot("A");
    } finally {
      setLoading(false);
    }
  };

  const outputs = useMemo(() => parseLookOutputs(setup?.outputs_json), [setup?.outputs_json]);
  const payload = useMemo<ProductionMatchPresetPayload>(() => buildMatchPresetPayload(heroSlot, cameraConfigs, outputs, selectedRun), [cameraConfigs, heroSlot, outputs, selectedRun]);

  const saveHeroPreference = async (slot: string) => {
    if (!setup) return;
    try {
      const currentOutputs = parseLookOutputs(setup.outputs_json) || {
        summary: "",
        recommendations: [],
        generated_at: "",
      };
      const nextOutputs = { ...currentOutputs, hero_slot: slot };
      const nextSetup = { ...setup, outputs_json: JSON.stringify(nextOutputs) };
      await invokeGuarded("production_save_look_setup", { setup: nextSetup });
      setSetup(nextSetup);
    } catch (e) {
      console.error("Failed to save hero preference", e);
    }
  };

  const handleHeroSelection = (slot: string) => {
    setHeroSlot(slot);
    void saveHeroPreference(slot);
  };

  const savePreset = async () => {
    if (!presetName.trim()) return;
    const now = new Date().toISOString();
    const preset: ProductionPreset = {
      id: `${project.id}:preset:${now}`,
      project_id: project.id,
      name: presetName.trim(),
      payload_json: JSON.stringify(payload),
      created_at: now,
      updated_at: now,
    };
    await invokeGuarded("production_save_preset", { preset });
    setPresets((prev) => [preset, ...prev]);
    setPresetName("");
  };

  const exportPreset = async () => {
    await exportProductionPdf({
      fileName: `${project.name}_MatchPreset.pdf`,
      title: "Match & Normalize Preset",
      subtitle: "Production",
      projectName: project.name,
      clientName: project.client_name,
      sections: [
        { title: `Hero Camera ${payload.hero_slot}`, lines: [payload.hero_summary] },
        ...payload.steps.map((step) => ({
          title: `${step.slot} Camera · ${step.camera_label}`,
          lines: step.evidence?.length ? [...step.checklist, ...step.evidence.map((item) => `Evidence: ${item}`)] : step.checklist,
        })),
      ],
    });
  };

  if (loading) {
    return <div className="inline-loading-state" style={{ padding: 40 }}>Loading match & normalize...</div>;
  }

  return (
    <div className="scrollable-view" style={{ padding: 32 }}>
      <div style={headerRowStyle}>
        <div style={headerMetaBlockStyle}>
          <div style={headerProjectNameStyle}>Project {project.name}</div>
          <p style={subtleStyle}>Client {project.client_name}</p>
          <p style={subtleHintStyle}>Choose the hero camera baseline and save a repeatable preset.</p>
        </div>
        <div style={headerActionsStyle}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void exportPreset()}><Download size={14} /> Export PDF</button>
        </div>
      </div>

      <section style={panelStyle}>
        <div style={panelTitleStyle}>Hero Camera</div>
        {matchLabRuns.length > 0 ? (
          <div style={runSelectRowStyle}>
            <label style={runSelectLabelStyle} htmlFor="match-normalize-run">Match Lab run</label>
            <select
              id="match-normalize-run"
              value={selectedRunId ?? ""}
              onChange={(event) => setSelectedRunId(event.target.value || null)}
              style={selectStyle}
            >
              <option value="">Setup checklist only</option>
              {matchLabRuns.map((run) => (
                <option key={run.run_id} value={run.run_id}>
                  Hero {run.hero_slot} · {formatRunDate(run.created_at)}
                </option>
              ))}
            </select>
            {selectedRun ? (
              <span style={runMetaStyle}>Selected run · Hero {selectedRun.hero_slot} · {formatRunDate(selectedRun.created_at)}</span>
            ) : null}
          </div>
        ) : null}
        {payload.evidence_summary ? <div style={evidenceSummaryStyle}>{payload.evidence_summary}</div> : null}
        <div style={heroRowStyle}>
          {cameraConfigs.map((config) => (
            <button
              key={config.slot}
              type="button"
              className={`btn btn-sm ${heroSlot === config.slot ? "btn-secondary" : "btn-ghost"}`}
              style={heroSlot === config.slot ? heroButtonActiveStyle : heroButtonStyle}
              onClick={() => handleHeroSelection(config.slot)}
            >
              {config.slot} · {config.brand || "Camera"} {config.model || ""}
            </button>
          ))}
        </div>
        <div style={heroSummaryStyle}>{payload.hero_summary}</div>
      </section>

      <section style={{ ...panelStyle, marginTop: 18 }}>
        <div style={panelTitleStyle}>Match Steps</div>
        <div style={stepGridStyle}>
          {payload.steps.map((step) => (
            <div key={step.slot} style={stepCardStyle}>
              <div style={sectionEyebrowStyle}>{step.slot} Camera</div>
              <h3 style={{ margin: "4px 0 10px" }}>{step.camera_label}</h3>
              <ul style={bulletListStyle}>
                {step.checklist.map((item) => <li key={item}>{item}</li>)}
              </ul>
              {step.evidence && step.evidence.length > 0 ? (
                <div style={evidenceListStyle}>
                  {step.evidence.map((item) => <div key={item} style={evidenceItemStyle}>{item}</div>)}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section style={{ ...panelStyle, marginTop: 18 }}>
        <div style={panelTitleStyle}>Save Look Profile Preset</div>
        <div style={saveRowStyle}>
          <input value={presetName} onChange={(event) => setPresetName(event.target.value)} placeholder="Preset name" style={inputStyle} />
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void savePreset()}><Save size={14} /> Save Preset</button>
        </div>
        {presets.length > 0 && (
          <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
            {presets.map((preset) => (
              <div key={preset.id} style={savedPresetRowStyle}>
                <span>{preset.name}</span>
                <span style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>{new Date(preset.updated_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const headerRowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 24, alignItems: "center", marginBottom: 20, flexWrap: "wrap" };
const headerMetaBlockStyle: React.CSSProperties = { display: "grid", gap: 4, minWidth: 0 };
const headerProjectNameStyle: React.CSSProperties = { color: "var(--text-primary)", fontSize: "0.98rem", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const subtleStyle: React.CSSProperties = { margin: 0, color: "var(--text-muted)", fontSize: "0.86rem" };
const subtleHintStyle: React.CSSProperties = { margin: 0, color: "var(--text-muted)", fontSize: "0.82rem" };
const headerActionsStyle: React.CSSProperties = { display: "flex", gap: 10, alignItems: "center", flexWrap: "nowrap", justifyContent: "flex-end" };
const panelStyle: React.CSSProperties = { padding: 18, borderRadius: 18, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)" };
const panelTitleStyle: React.CSSProperties = { marginBottom: 12, fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)", fontWeight: 800 };
const runSelectRowStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 };
const runSelectLabelStyle: React.CSSProperties = { color: "var(--text-muted)", fontSize: "0.74rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" };
const selectStyle: React.CSSProperties = { minWidth: 260, padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "var(--text-primary)" };
const runMetaStyle: React.CSSProperties = { color: "var(--text-secondary)", fontSize: "0.78rem", fontWeight: 700 };
const evidenceSummaryStyle: React.CSSProperties = { color: "var(--text-secondary)", padding: "9px 11px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)", marginBottom: 12, fontSize: "0.82rem" };
const heroRowStyle: React.CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 };
const heroButtonStyle: React.CSSProperties = { borderColor: "rgba(255,255,255,0.08)" };
const heroButtonActiveStyle: React.CSSProperties = { borderColor: "rgba(0,209,255,0.28)", color: "var(--color-accent)" };
const heroSummaryStyle: React.CSSProperties = { color: "var(--text-secondary)", padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" };
const sectionEyebrowStyle: React.CSSProperties = { fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", fontWeight: 800, marginBottom: 8 };
const stepGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, alignItems: "stretch" };
const stepCardStyle: React.CSSProperties = { padding: 14, borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" };
const bulletListStyle: React.CSSProperties = { margin: 0, paddingLeft: 18, color: "var(--text-secondary)", display: "grid", gap: 6 };
const evidenceListStyle: React.CSSProperties = { marginTop: 12, display: "grid", gap: 6 };
const evidenceItemStyle: React.CSSProperties = { color: "var(--text-muted)", fontSize: "0.74rem", lineHeight: 1.35, padding: "7px 9px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.018)" };
const saveRowStyle: React.CSSProperties = { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" };
const inputStyle: React.CSSProperties = { flex: 1, padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "var(--text-primary)" };
const savedPresetRowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 12px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" };

function formatRunDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}
