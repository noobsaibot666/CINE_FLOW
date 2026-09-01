import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Circle } from "lucide-react";
import { ProductionLookSetup, ProductionOnsetChecks, ProductionProject } from "../../types";
import { invokeGuarded } from "../../utils/tauri";
import { buildDefaultOnsetChecks, parseLookOutputs } from "./productionLogic";

interface OnSetCoachAppProps {
  project: ProductionProject;
  onBack?: () => void;
}

interface ToggleItem {
  id: string;
  label: string;
  done?: boolean;
  active?: boolean;
}

export function OnSetCoachApp({ project }: OnSetCoachAppProps) {
  const [setup, setSetup] = useState<ProductionLookSetup | null>(null);
  const [checks, setChecks] = useState<ProductionOnsetChecks | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void load();
  }, [project.id]);

  const load = async () => {
    setLoading(true);
    try {
      const [savedSetup, savedChecks] = await Promise.all([
        invokeGuarded<ProductionLookSetup | null>("production_get_look_setup", { projectId: project.id }),
        invokeGuarded<ProductionOnsetChecks | null>("production_get_onset_checks", { projectId: project.id }),
      ]);
      setSetup(savedSetup);
      setChecks(savedChecks ?? buildDefaultOnsetChecks(project.id));
    } finally {
      setLoading(false);
    }
  };

  const outputs = useMemo(() => parseLookOutputs(setup?.outputs_json), [setup?.outputs_json]);
  const readyState = useMemo<Record<string, boolean>>(() => checks ? JSON.parse(checks.ready_state_json) : {}, [checks]);
  const lightingChecks = useMemo<ToggleItem[]>(() => checks ? JSON.parse(checks.lighting_checks_json) : [], [checks]);
  const failureModes = useMemo<ToggleItem[]>(() => checks ? JSON.parse(checks.failure_modes_json) : [], [checks]);

  const recommendations = outputs?.recommendations ?? [];
  const camerasReady = recommendations.filter((item) => readyState[item.slot]).length;
  const lightingDone = lightingChecks.filter((item) => item.done).length;
  const warningsFlagged = failureModes.filter((item) => item.active).length;
  const allReady =
    recommendations.length > 0 &&
    camerasReady === recommendations.length &&
    lightingDone === lightingChecks.length &&
    warningsFlagged === 0;

  const persist = async (next: ProductionOnsetChecks) => {
    setSaving(true);
    setChecks(next);
    try {
      await invokeGuarded("production_save_onset_checks", { checks: next });
    } finally {
      setSaving(false);
    }
  };

  const resetChecks = async () => {
    const next = buildDefaultOnsetChecks(project.id);
    await persist({ ...next, updated_at: new Date().toISOString() });
  };

  const updateReady = async (slot: string) => {
    if (!checks) return;
    const nextState = { ...readyState, [slot]: !readyState[slot] };
    await persist({ ...checks, ready_state_json: JSON.stringify(nextState), updated_at: new Date().toISOString() });
  };

  const updateLightingCheck = async (id: string) => {
    if (!checks) return;
    const next = lightingChecks.map((item) => item.id === id ? { ...item, done: !item.done } : item);
    await persist({ ...checks, lighting_checks_json: JSON.stringify(next), updated_at: new Date().toISOString() });
  };

  const updateFailureMode = async (id: string) => {
    if (!checks) return;
    const next = failureModes.map((item) => item.id === id ? { ...item, active: !item.active } : item);
    await persist({ ...checks, failure_modes_json: JSON.stringify(next), updated_at: new Date().toISOString() });
  };

  if (loading || !checks) {
    return <div className="inline-loading-state" style={{ padding: 40 }}>Loading on-set coach…</div>;
  }

  return (
    <div className="scrollable-view" style={{ padding: 32, maxWidth: 1280, margin: "0 auto" }}>
      <div style={headerRowStyle}>
        <div style={headerMetaBlockStyle}>
          <div style={headerProjectNameStyle}>On-Set Coach — {project.name}</div>
          <p style={subtleStyle}>{project.client_name}</p>
          <p style={leadStyle}>
            Put each camera on scopes, confirm it hits the saved targets, then mark it ready.
            Work the lighting checklist and flag any failure mode you see on the monitor.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => void resetChecks()}
          disabled={saving}
        >
          {saving ? "Saving…" : "Reset all checks"}
        </button>
      </div>

      <div style={statusStripStyle}>
        <StatusChip label="Cameras ready" value={`${camerasReady} / ${recommendations.length}`} tone={recommendations.length > 0 && camerasReady === recommendations.length ? "good" : "neutral"} />
        <StatusChip label="Lighting checks" value={`${lightingDone} / ${lightingChecks.length}`} tone={lightingChecks.length > 0 && lightingDone === lightingChecks.length ? "good" : "neutral"} />
        <StatusChip label="Failure modes flagged" value={`${warningsFlagged}`} tone={warningsFlagged > 0 ? "bad" : "good"} />
        {allReady && <StatusChip label="" value="Cleared to roll" tone="good" />}
      </div>

      <SectionLabel step={1} title="Confirm each camera" hint="Read exposure and white balance off scopes, not a Rec.709 monitor." />
      <div
        style={{
          ...cameraGridStyle,
          // Keep every camera side by side for at-a-glance comparison — never
          // wrap the rig onto a second row.
          gridTemplateColumns: `repeat(${Math.max(1, recommendations.length)}, minmax(0, 1fr))`,
        }}
      >
        {recommendations.map((item) => {
          const ready = Boolean(readyState[item.slot]);
          return (
            <section key={item.slot} style={{ ...cardStyle, borderColor: ready ? "rgba(134,239,172,0.35)" : "rgba(255,255,255,0.11)" }}>
              <div style={cardHeaderRowStyle}>
                <div style={eyebrowStyle}>{item.slot} camera</div>
                <span style={ready ? readyPillStyle : pendingPillStyle}>
                  {ready ? <><Check size={11} strokeWidth={3} /> Ready</> : "Not ready"}
                </span>
              </div>
              <h3 style={cardTitleStyle}>{item.camera_label}</h3>

              <div style={specListStyle}>
                <SpecRow label="Exposure" value={item.exposure_target} />
                <SpecRow label="White balance" value={item.white_balance_rule} />
                <SpecRow label="Base ISO" value={item.iso_strategy} />
              </div>

              <button
                type="button"
                className={ready ? "btn btn-ghost btn-sm" : "btn btn-primary btn-sm"}
                style={{ width: "100%", marginTop: 14, ...(ready ? { color: "#86efac", borderColor: "rgba(134,239,172,0.35)" } : {}) }}
                onClick={() => void updateReady(item.slot)}
              >
                {ready ? "Ready ✓ — reopen" : "Mark camera ready"}
              </button>
            </section>
          );
        })}
      </div>

      <div style={checklistGridStyle}>
        <section style={cardStyle}>
          <SectionLabel step={2} title="Lighting checklist" hint={`${lightingDone} of ${lightingChecks.length} done`} compact />
          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            {lightingChecks.map((item) => {
              const done = item.done === true;
              return (
                <button key={item.id} type="button" onClick={() => void updateLightingCheck(item.id)} style={checkRowStyle(done)}>
                  {done
                    ? <CheckCircle2 size={16} style={{ color: "#86efac", flexShrink: 0 }} />
                    : <Circle size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
                  <span style={{ textAlign: "left", textDecoration: done ? "line-through" : "none", color: done ? "var(--text-secondary)" : "var(--text-primary)" }}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section style={cardStyle}>
          <SectionLabel step={3} title="Watch for these" hint="Tap any you spot on set" compact />
          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            {failureModes.map((item) => {
              const active = item.active === true;
              return (
                <button key={item.id} type="button" onClick={() => void updateFailureMode(item.id)} style={warningRowStyle(active)}>
                  <AlertTriangle size={15} style={{ color: active ? "#fca5a5" : "var(--text-muted)", flexShrink: 0 }} />
                  <span style={{ textAlign: "left", flex: 1, color: active ? "#fecaca" : "var(--text-primary)" }}>{item.label}</span>
                  <span style={active ? flaggedPillStyle : clearPillStyle}>{active ? "Flagged" : "Not seen"}</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatusChip({ label, value, tone }: { label: string; value: string; tone: "good" | "bad" | "neutral" }) {
  const color = tone === "good" ? "#86efac" : tone === "bad" ? "#fca5a5" : "var(--text-secondary)";
  const bg = tone === "good" ? "rgba(34,197,94,0.1)" : tone === "bad" ? "rgba(248,113,113,0.1)" : "rgba(255,255,255,0.05)";
  return (
    <div style={{ ...chipStyle, background: bg }}>
      {label && <span style={{ color: "var(--text-muted)", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>}
      <strong style={{ color, fontSize: "0.86rem" }}>{value}</strong>
    </div>
  );
}

function SectionLabel({ step, title, hint, compact = false }: { step: number; title: string; hint?: string; compact?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, margin: compact ? "0" : "28px 0 12px" }}>
      <span style={stepNumStyle}>{step}</span>
      <span style={{ fontSize: compact ? "0.8rem" : "0.95rem", fontWeight: 800, color: "var(--text-primary)", textTransform: compact ? "uppercase" : "none", letterSpacing: compact ? "0.08em" : "normal" }}>{title}</span>
      {hint && <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>· {hint}</span>}
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={specRowStyle}>
      <span style={specLabelStyle}>{label}</span>
      <span style={specValueStyle}>{value}</span>
    </div>
  );
}

const headerRowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 24, alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap" };
const headerMetaBlockStyle: React.CSSProperties = { display: "grid", gap: 6, minWidth: 0, maxWidth: 720 };
const headerProjectNameStyle: React.CSSProperties = { color: "var(--text-primary)", fontSize: "1.15rem", fontWeight: 800 };
const subtleStyle: React.CSSProperties = { margin: 0, color: "var(--text-muted)", fontSize: "0.82rem" };
const leadStyle: React.CSSProperties = { margin: "4px 0 0", color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: 1.5 };
const statusStripStyle: React.CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 4 };
const chipStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 2, padding: "8px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)" };
const cameraGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, alignItems: "stretch" };
const checklistGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16, marginTop: 28, alignItems: "start" };
const cardStyle: React.CSSProperties = { display: "flex", flexDirection: "column", padding: 18, borderRadius: 16, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.11)" };
const cardHeaderRowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" };
const eyebrowStyle: React.CSSProperties = { fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)", fontWeight: 800 };
const cardTitleStyle: React.CSSProperties = { margin: "6px 0 14px", fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary)" };
const readyPillStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 9px", borderRadius: 999, background: "rgba(34,197,94,0.14)", color: "#86efac", fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" };
const pendingPillStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", padding: "4px 9px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.14)", color: "var(--text-secondary)", fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" };
const specListStyle: React.CSSProperties = { display: "grid", gap: 8, flex: 1 };
const specRowStyle: React.CSSProperties = { display: "grid", gap: 3, padding: "10px 12px", borderRadius: 10, background: "rgba(0,0,0,0.28)", border: "1px solid rgba(255,255,255,0.05)" };
const specLabelStyle: React.CSSProperties = { fontSize: "0.64rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", fontWeight: 800 };
const specValueStyle: React.CSSProperties = { fontSize: "0.85rem", lineHeight: 1.4, color: "var(--text-secondary)" };
const stepNumStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: 999, background: "var(--color-accent)", color: "#0d0b1a", fontSize: "0.7rem", fontWeight: 800, flexShrink: 0 };
const checkRowStyle = (done: boolean): React.CSSProperties => ({ display: "flex", alignItems: "center", gap: 10, padding: "11px 13px", borderRadius: 11, border: "1px solid rgba(255,255,255,0.09)", background: done ? "rgba(34,197,94,0.07)" : "rgba(0,0,0,0.22)", cursor: "pointer", fontSize: "0.86rem" });
const warningRowStyle = (active: boolean): React.CSSProperties => ({ display: "flex", alignItems: "center", gap: 10, padding: "11px 13px", borderRadius: 11, border: `1px solid ${active ? "rgba(248,113,113,0.3)" : "rgba(255,255,255,0.09)"}`, background: active ? "rgba(248,113,113,0.1)" : "rgba(0,0,0,0.22)", cursor: "pointer", fontSize: "0.86rem" });
const flaggedPillStyle: React.CSSProperties = { padding: "3px 8px", borderRadius: 999, background: "rgba(248,113,113,0.18)", color: "#fca5a5", fontSize: "0.66rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 };
const clearPillStyle: React.CSSProperties = { padding: "3px 8px", borderRadius: 999, color: "var(--text-muted)", fontSize: "0.66rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 };
