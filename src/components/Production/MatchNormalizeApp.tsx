import React, { useEffect, useMemo, useState } from "react";
import { Download, Info, Save } from "lucide-react";
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
import { buildMatchPresetPayload, formatConfidenceLabel, parseLookOutputs } from "./productionLogic";

interface MatchNormalizeAppProps {
  project: ProductionProject;
  onBack?: () => void;
}

const METHOD_STEPS = [
  "Normalise exposure first — match on zebra or waveform, not a Rec.709 monitor.",
  "Then align kelvin and tint, before touching contrast or saturation.",
  "Confirm sharpening, NR and detail processing are off.",
  "Keep every camera in the same monitoring class as the hero.",
];

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
        if (run?.hero_slot) setHeroSlot(run.hero_slot);
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
  const hasRun = Boolean(selectedRun);

  const saveHeroPreference = async (slot: string) => {
    if (!setup) return;
    try {
      const currentOutputs = parseLookOutputs(setup.outputs_json) || { summary: "", recommendations: [], generated_at: "" };
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
          lines: [
            `Trust: ${step.trust_label ?? "Not scored"}`,
            ...(step.trust_reasons ?? []).map((item) => `Trust reason: ${item}`),
            ...step.checklist,
            ...(step.evidence ?? []).map((item) => `Evidence: ${item}`),
          ],
        })),
      ],
    });
  };

  if (loading) {
    return <div className="inline-loading-state" style={{ padding: 40 }}>Loading match &amp; normalize…</div>;
  }

  return (
    <div className="scrollable-view" style={{ padding: 32, maxWidth: 1180, margin: "0 auto" }}>
      <div style={headerRowStyle}>
        <div style={headerMetaBlockStyle}>
          <div style={headerProjectNameStyle}>Match &amp; Normalize — {project.name}</div>
          <p style={subtleStyle}>{project.client_name}</p>
          <p style={leadStyle}>Pick the hero camera, bring the others onto its baseline, then save the preset the whole package works from.</p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => void exportPreset()}>
          <Download size={14} /> Export PDF
        </button>
      </div>

      {/* 1 — Hero */}
      <SectionLabel step={1} title="Hero camera baseline" />
      <section style={cardStyle}>
        {matchLabRuns.length > 0 && (
          <div style={runSelectRowStyle}>
            <label style={fieldLabelStyle} htmlFor="mn-run">Baseline data</label>
            <select
              id="mn-run"
              value={selectedRunId ?? ""}
              onChange={(event) => setSelectedRunId(event.target.value || null)}
              style={selectStyle}
            >
              <option value="">Look setup guidance (no measured run)</option>
              {matchLabRuns.map((run) => (
                <option key={run.run_id} value={run.run_id}>Match Lab · hero {run.hero_slot} · {formatRunDate(run.created_at)}</option>
              ))}
            </select>
          </div>
        )}

        {!hasRun && (
          <div style={infoNoteStyle}>
            <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>No Match Lab run selected — the steps below are the generic method from the look setup. Run <strong>Camera Match Lab</strong> for measured exposure and white-balance deltas per camera.</span>
          </div>
        )}

        <div style={heroRowStyle}>
          {cameraConfigs.map((config) => {
            const active = heroSlot === config.slot;
            return (
              <button
                key={config.slot}
                type="button"
                className={active ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}
                onClick={() => handleHeroSelection(config.slot)}
              >
                {config.slot} · {config.brand || "Camera"} {config.model || ""}
              </button>
            );
          })}
        </div>
        <div style={heroSummaryStyle}>{payload.hero_summary}</div>
      </section>

      {/* 2 — Match steps */}
      <SectionLabel step={2} title={`Bring each camera onto hero ${payload.hero_slot}`} />
      {!hasRun && (
        <section style={{ ...cardStyle, marginBottom: 14 }}>
          <div style={panelTitleStyle}>The method — same for every camera</div>
          <ol style={methodListStyle}>
            {METHOD_STEPS.map((step, i) => <li key={i}>{step}</li>)}
          </ol>
        </section>
      )}
      <div style={stepGridStyle}>
        {payload.steps.map((step) => (
          <div key={step.slot} style={stepCardStyle}>
            <div style={stepHeaderStyle}>
              <div>
                <div style={eyebrowStyle}>{step.slot} camera</div>
                <h3 style={stepTitleStyle}>{step.camera_label}</h3>
              </div>
              {step.confidence_score != null && (
                <span style={confidenceBadgeStyle}>{formatConfidenceLabel(step.confidence_score)}</span>
              )}
            </div>

            {hasRun ? (
              <>
                {step.trust_label && (
                  <div style={trustPanelStyle}>
                    <span style={trustLabelStyle}>{step.trust_label}</span>
                    {(step.trust_reasons ?? []).slice(0, 2).map((reason) => (
                      <span key={reason} style={trustReasonStyle}>{reason}</span>
                    ))}
                  </div>
                )}
                <div style={{ display: "grid", gap: 6 }}>
                  {step.checklist.map((item) => (
                    <div key={item} style={measuredRowStyle}>{item}</div>
                  ))}
                </div>
                {step.evidence && step.evidence.length > 0 && (
                  <details style={{ marginTop: 10 }}>
                    <summary style={evidenceSummaryToggleStyle}>Evidence ({step.evidence.length})</summary>
                    <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                      {step.evidence.map((item) => <div key={item} style={evidenceItemStyle}>{item}</div>)}
                    </div>
                  </details>
                )}
              </>
            ) : (
              <div style={noDataRowStyle}>Follow the method above. Run Camera Match Lab for measured deltas on this camera.</div>
            )}
          </div>
        ))}
      </div>

      {/* 3 — Preset */}
      <SectionLabel step={3} title="Save the look profile preset" />
      <section style={cardStyle}>
        <div style={saveRowStyle}>
          <input value={presetName} onChange={(event) => setPresetName(event.target.value)} placeholder="Preset name (e.g. Day1_Interior_A-hero)" style={inputStyle} />
          <button type="button" className="btn btn-primary btn-sm" onClick={() => void savePreset()} disabled={!presetName.trim()}>
            <Save size={14} /> Save preset
          </button>
        </div>
        {presets.length > 0 && (
          <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
            {presets.map((preset) => (
              <div key={preset.id} style={savedPresetRowStyle}>
                <span style={{ fontWeight: 600 }}>{preset.name}</span>
                <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>{new Date(preset.updated_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SectionLabel({ step, title }: { step: number; title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "26px 0 12px" }}>
      <span style={stepNumStyle}>{step}</span>
      <span style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--text-primary)" }}>{title}</span>
    </div>
  );
}

function formatRunDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

const headerRowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 24, alignItems: "flex-start", marginBottom: 4, flexWrap: "wrap" };
const headerMetaBlockStyle: React.CSSProperties = { display: "grid", gap: 6, minWidth: 0, maxWidth: 680 };
const headerProjectNameStyle: React.CSSProperties = { color: "var(--text-primary)", fontSize: "1.15rem", fontWeight: 800 };
const subtleStyle: React.CSSProperties = { margin: 0, color: "var(--text-muted)", fontSize: "0.82rem" };
const leadStyle: React.CSSProperties = { margin: "4px 0 0", color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: 1.5 };
const cardStyle: React.CSSProperties = { padding: 18, borderRadius: 16, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.11)" };
const panelTitleStyle: React.CSSProperties = { marginBottom: 10, fontSize: "0.74rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)", fontWeight: 800 };
const stepNumStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: 999, background: "var(--color-accent)", color: "#0d0b1a", fontSize: "0.7rem", fontWeight: 800, flexShrink: 0 };
const runSelectRowStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 };
const fieldLabelStyle: React.CSSProperties = { color: "var(--text-muted)", fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" };
const selectStyle: React.CSSProperties = { minWidth: 300, padding: "9px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.28)", color: "var(--text-primary)" };
const infoNoteStyle: React.CSSProperties = { display: "flex", gap: 8, alignItems: "flex-start", color: "var(--text-secondary)", padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(165,146,255,0.25)", background: "rgba(165,146,255,0.06)", marginBottom: 14, fontSize: "0.83rem", lineHeight: 1.45 };
const heroRowStyle: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 };
const heroSummaryStyle: React.CSSProperties = { color: "var(--text-secondary)", padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.24)", fontSize: "0.88rem", lineHeight: 1.5 };
const methodListStyle: React.CSSProperties = { margin: 0, paddingLeft: 20, color: "var(--text-secondary)", display: "grid", gap: 7, fontSize: "0.88rem", lineHeight: 1.5 };
const stepGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14, alignItems: "start" };
const stepCardStyle: React.CSSProperties = { padding: 16, borderRadius: 14, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.1)" };
const stepHeaderStyle: React.CSSProperties = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 12 };
const eyebrowStyle: React.CSSProperties = { fontSize: "0.66rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)", fontWeight: 800 };
const stepTitleStyle: React.CSSProperties = { margin: "4px 0 0", fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" };
const confidenceBadgeStyle: React.CSSProperties = { flexShrink: 0, padding: "4px 9px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.14)", color: "var(--text-secondary)", fontSize: "0.66rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em" };
const trustPanelStyle: React.CSSProperties = { display: "grid", gap: 5, marginBottom: 10, padding: "9px 11px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.09)", background: "rgba(0,0,0,0.22)" };
const trustLabelStyle: React.CSSProperties = { color: "rgba(196,181,253,0.95)", fontSize: "0.74rem", fontWeight: 800 };
const trustReasonStyle: React.CSSProperties = { color: "var(--text-muted)", fontSize: "0.72rem", lineHeight: 1.4 };
const measuredRowStyle: React.CSSProperties = { color: "var(--text-secondary)", fontSize: "0.82rem", lineHeight: 1.45, padding: "9px 11px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.22)" };
const noDataRowStyle: React.CSSProperties = { color: "var(--text-muted)", fontSize: "0.82rem", lineHeight: 1.45 };
const evidenceSummaryToggleStyle: React.CSSProperties = { cursor: "pointer", color: "var(--text-secondary)", fontSize: "0.76rem", fontWeight: 700 };
const evidenceItemStyle: React.CSSProperties = { color: "var(--text-muted)", fontSize: "0.74rem", lineHeight: 1.4, padding: "7px 9px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.05)", background: "rgba(0,0,0,0.2)" };
const saveRowStyle: React.CSSProperties = { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" };
const inputStyle: React.CSSProperties = { flex: 1, minWidth: 220, padding: "11px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.28)", color: "var(--text-primary)" };
const savedPresetRowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 12px", borderRadius: 12, background: "rgba(0,0,0,0.22)", border: "1px solid rgba(255,255,255,0.07)" };
