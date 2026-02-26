import { useState, useEffect } from "react";
import { X, Settings2 } from "lucide-react";

interface SettingsPanelProps {
    open: boolean;
    projectId: string | null;
    onClose: () => void;
    onSettingsSaved: () => void;
}

export function SettingsPanel({ open, projectId, onClose, onSettingsSaved }: SettingsPanelProps) {
    const [customShotSizes, setCustomShotSizes] = useState("");
    const [customMovements, setCustomMovements] = useState("");

    useEffect(() => {
        if (open && projectId) {
            const savedShots = localStorage.getItem(`wp_custom_shots_${projectId}`);
            const savedMoves = localStorage.getItem(`wp_custom_moves_${projectId}`);
            setCustomShotSizes(savedShots || "");
            setCustomMovements(savedMoves || "");
        }
    }, [open, projectId]);

    const handleSave = () => {
        if (!projectId) return;
        localStorage.setItem(`wp_custom_shots_${projectId}`, customShotSizes);
        localStorage.setItem(`wp_custom_moves_${projectId}`, customMovements);
        onSettingsSaved();
        onClose();
    };

    if (!open) return null;
    return (
        <div className="jobs-drawer-backdrop" onClick={onClose}>
            <div className="about-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
                <div className="jobs-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Settings2 size={16} />
                        <h3>Project Settings</h3>
                    </div>
                    <button className="btn-link" onClick={onClose}><X size={16} /></button>
                </div>

                <div style={{ marginTop: 16 }}>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.5 }}>
                        Define custom taxonomy tags for this project. Separate multiple tags with commas.
                    </p>

                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: "block", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 8, fontWeight: 600 }}>Custom Shot Sizes</label>
                        <textarea
                            value={customShotSizes}
                            onChange={(e) => setCustomShotSizes(e.target.value)}
                            placeholder="e.g. POV, Over the Shoulder"
                            style={{ width: "100%", minHeight: 60, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "white", padding: 8, fontSize: 13, resize: "vertical" }}
                        />
                    </div>

                    <div style={{ marginBottom: 24 }}>
                        <label style={{ display: "block", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 8, fontWeight: 600 }}>Custom Movements</label>
                        <textarea
                            value={customMovements}
                            onChange={(e) => setCustomMovements(e.target.value)}
                            placeholder="e.g. Drone, Whip Pan, SnorriCam"
                            style={{ width: "100%", minHeight: 60, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "white", padding: 8, fontSize: 13, resize: "vertical" }}
                        />
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button className="btn btn-primary" style={{ padding: "8px 16px" }} onClick={handleSave}>Save Settings</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
