import React, { useState, useMemo } from "react";
import { 
  ArrowLeft,
  Circle, 
  Clock, 
  BarChart, 
  Zap, 
  ClipboardCheck, 
  HelpCircle,
  AlertTriangle,
  Video,
  Image as ImageIcon,
  Layout,
  Users,
  ZapOff,
  Thermometer,
} from "lucide-react";
import { 
  CAMERA_MODELS, 
  LENS_MODELS 
} from "../../modules/PreProduction/StarterSetupData";
import { 
  StarterSetupInputs, 
  SetupOutput, 
  SetupRow as SetupRowType,
  CameraModel,
  LensData,
  CaptureType,
  SubjectType,
  EnvironmentType,
  LightCondition,
  MovementLevel,
  PriorityType
} from "../../modules/PreProduction/StarterSetupTypes";
import { StarterSetupEngine } from "../../modules/PreProduction/StarterSetupEngine";

interface StarterSetupProps {
  onBack?: () => void;
}

const ChipSelect: React.FC<{
  label: string;
  options: { value: string; label: string; icon?: React.ReactNode }[];
  value: string;
  onChange: (val: any) => void;
  columns?: number;
}> = ({ label, options, value, onChange, columns = 2 }) => (
  <div className="chip-select-field">
    <label className="field-label">{label}</label>
    <div className="chip-grid" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          className={`chip-btn ${value === opt.value ? "active" : ""}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.icon && <span className="chip-icon">{opt.icon}</span>}
          <span className="chip-label">{opt.label}</span>
        </button>
      ))}
    </div>
  </div>
);

export const StarterSetup: React.FC<StarterSetupProps> = ({ onBack }) => {
  // --- State ---
  const [selectedCamera, setSelectedCamera] = useState<CameraModel>(CAMERA_MODELS[0]);
  const [selectedLens, setSelectedLens] = useState<LensData>(LENS_MODELS[0]);
  const [captureType, setCaptureType] = useState<CaptureType>("photo");
  const [flashEnabled, setFlashEnabled] = useState(false);

  const [subject, setSubject] = useState<SubjectType>("portrait");
  const [environment, setEnvironment] = useState<EnvironmentType>("interior");
  const [lightCondition, setLightCondition] = useState<LightCondition>("daylight");
  const [movementLevel, setMovementLevel] = useState<MovementLevel>("static");
  const [priority, setPriority] = useState<PriorityType>("sharpness");

  // --- Engine Calculation ---
  const inputs: StarterSetupInputs = useMemo(() => ({
    camera: selectedCamera,
    lens: selectedLens,
    captureType,
    flashEnabled,
    subject,
    environment,
    lightCondition,
    movementLevel,
    priority,
  }), [selectedCamera, selectedLens, captureType, flashEnabled, subject, environment, lightCondition, movementLevel, priority]);

  const output: SetupOutput = useMemo(() => StarterSetupEngine.calculate(inputs), [inputs]);

  // --- Helpers ---
  const handleCameraChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const modelStr = e.target.value;
    const model = CAMERA_MODELS.find(m => `${m.brand} ${m.model}` === modelStr);
    if (model) setSelectedCamera(model);
  };

  const handleLensChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const lensName = e.target.value;
    const lens = LENS_MODELS.find(l => l.name === lensName);
    if (lens) setSelectedLens(lens);
  };

  return (
    <div className="starter-setup-container">
      <div className="starter-setup-header">
        <div className="header-info">
          {onBack && (
            <button className="back-btn-technical" onClick={onBack}>
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>
          )}
          <h1>Starter Setup</h1>
          <p className="subtitle">Get a safe technical starting setup before shooting.</p>
        </div>
      </div>

      <div className="starter-setup-content">
        <div className="input-grid">
          {/* Section 1: Gear */}
          <div className="input-section premium-card">
            <h2 className="section-title"><Layout size={14} /> Gear</h2>
            <div className="field-group">
              <div className="field">
                <label className="field-label">Camera</label>
                <select className="premium-select" value={selectedCamera ? `${selectedCamera.brand} ${selectedCamera.model}` : ""} onChange={handleCameraChange}>
                  {CAMERA_MODELS.map(m => (
                    <option key={`${m.brand} ${m.model}`} value={`${m.brand} ${m.model}`}>{m.brand} {m.model}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="field-label">Lens</label>
                <select className="premium-select" value={selectedLens.name} onChange={handleLensChange}>
                  {LENS_MODELS.map(l => (
                    <option key={l.name} value={l.name}>{l.name}</option>
                  ))}
                </select>
              </div>
              <div className="field-row">
                <div className="toggle-group-premium">
                  <button 
                    className={`toggle-btn-p ${captureType === 'photo' ? 'active' : ''}`}
                    onClick={() => setCaptureType('photo')}
                  >
                    <ImageIcon size={14} /> <span>Photo</span>
                  </button>
                  <button 
                    className={`toggle-btn-p ${captureType === 'video' ? 'active' : ''}`}
                    onClick={() => setCaptureType('video')}
                  >
                    <Video size={14} /> <span>Video</span>
                  </button>
                </div>
                
                <div 
                  className={`flash-toggle-premium ${flashEnabled && captureType === 'photo' ? 'active' : ''} ${captureType === 'video' ? 'disabled' : ''}`} 
                  onClick={() => captureType === 'photo' && setFlashEnabled(!flashEnabled)}
                >
                  {flashEnabled && captureType === 'photo' ? <Zap size={14} fill="currentColor" /> : <ZapOff size={14} />}
                  <span>Flash Unit</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Situation */}
          <div className="input-section premium-card compact-inputs">
            <h2 className="section-title"><Users size={14} /> Situation</h2>
            <div className="field-group">
              <div className="field">
                <label className="field-label">Subject</label>
                <select className="premium-select" value={subject} onChange={(e) => setSubject(e.target.value as any)}>
                  <option value="portrait">Portrait</option>
                  <option value="food">Food</option>
                  <option value="team">Team / Group</option>
                  <option value="product">Product</option>
                  <option value="car">Car</option>
                  <option value="architecture">Architecture</option>
                  <option value="interior">Interior Space</option>
                  <option value="event">Event</option>
                  <option value="documentary">Documentary</option>
                </select>
              </div>

              <div className="field-row">
                <ChipSelect 
                  label="Environment"
                  value={environment}
                  onChange={setEnvironment}
                  options={[
                    { value: 'interior', label: 'Interior' },
                    { value: 'exterior', label: 'Exterior' }
                  ]}
                />
                <ChipSelect 
                  label="Movement"
                  value={movementLevel}
                  onChange={setMovementLevel}
                  options={[
                    { value: 'static', label: 'Static' },
                    { value: 'light', label: 'Light' },
                    { value: 'fast', label: 'Fast' }
                  ]}
                  columns={3}
                />
              </div>

              <ChipSelect 
                label="Priority"
                value={priority}
                onChange={setPriority}
                columns={3}
                options={[
                  { value: 'sharpness', label: 'Sharp' },
                  { value: 'low_noise', label: 'Clean' },
                  { value: 'shallow_depth', label: 'Bokeh' },
                  { value: 'freeze_motion', label: 'Freeze' },
                  { value: 'natural_skin', label: 'Skin' },
                  { value: 'speed', label: 'Speed' }
                ]}
              />

              <div className="field">
                <label className="field-label">Light Condition</label>
                <select className="premium-select" value={lightCondition} onChange={(e) => setLightCondition(e.target.value as any)}>
                  <option value="daylight">Daylight</option>
                  <option value="mixed">Mixed Light</option>
                  <option value="tungsten">Tungsten / Warm</option>
                  <option value="fluorescent">Fluorescent</option>
                  <option value="low_light">Dark Low Light</option>
                  <option value="studio">Controlled Studio</option>
                  <option value="window_light">Window Light</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Output */}
        <div className="output-section-premium premium-card-elevated">
          <div className="output-header">
            <h2 className="section-title"><ClipboardCheck size={14} color="var(--phase-preproduction)" /> Technical Setup</h2>
            <div className="badge-group">
              <span className="technical-badge">{captureType.toUpperCase()}</span>
              {captureType === 'photo' && flashEnabled && <span className="technical-badge flash">FLASH</span>}
            </div>
          </div>
          
          <div className="output-rows">
            <SetupRowItem data={output.whiteBalance} key={output.whiteBalance.value + lightCondition} />
            <SetupRowItem data={output.aperture} key={output.aperture.value + priority} />
            <SetupRowItem data={output.shutter} key={output.shutter.value + movementLevel} />
            <SetupRowItem data={output.iso} key={output.iso.value + lightCondition} />
            {captureType === 'photo' && flashEnabled && output.flash && (
              <SetupRowItem data={output.flash} key="flash-row" />
            )}
            <div className="row-divider" />
            <SetupRowItem data={output.checkFirst} isHighlight key={output.checkFirst.value} />
            <SetupRowItem data={output.avoid} isWarning key={output.avoid.value} />
          </div>
          

        </div>
      </div>

      <style>{`
        .starter-setup-container {
          padding: var(--space-xl) 60px;
          max-width: 1300px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: var(--space-xl);
          animation: appFadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .field-row {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
        }

        .field {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 8px;
        }

        .field-group {
          display: flex;
          flex-direction: column;
          gap: 36px;
        }

        .back-btn-technical {
          display: flex;
          align-items: center;
          gap: 6px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          margin-bottom: 24px;
          transition: all 0.2s ease;
          padding: 0;
        }

        .back-btn-technical:hover {
          color: #fff;
          transform: translateX(-2px);
        }

        .starter-setup-header {
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          padding-bottom: var(--space-lg);
          margin-bottom: var(--space-md);
        }

        .starter-setup-header h1 {
          font-size: 32px;
          font-weight: 900;
          letter-spacing: -0.03em;
          margin-bottom: 4px;
          background: linear-gradient(180deg, #fff 0%, rgba(255,255,255,0.7) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .starter-setup-header .subtitle {
          color: var(--text-muted);
          font-size: 15px;
          font-weight: 500;
        }

        .starter-setup-content {
          display: grid;
          grid-template-columns: 480px 1fr;
          gap: 40px;
          align-items: start;
        }

        .input-grid {
          display: flex;
          flex-direction: column;
          gap: 60px;
        }

        .input-section {
          padding: 24px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 16px;
        }

        .compact-inputs {
          padding: 20px 24px;
        }

        .section-title {
          font-size: 13px;
          font-weight: 800;
          color: #fff;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          gap: 10px;
          opacity: 0.9;
        }

        .field-label {
          font-size: 9px;
          font-weight: 800;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 10px;
          display: block;
          white-space: nowrap;
          width: 104px;
          flex-shrink: 0;
        }

        .field .field-label {
          margin-bottom: 0;
        }

        .premium-select {
          width: 100%;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          color: #fff;
          padding: 14px 18px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: border-color 0.2s;
        }

        .premium-select:focus {
          outline: none;
          border-color: var(--phase-preproduction);
          box-shadow: 0 0 0 1px var(--phase-preproduction);
        }

        /* Chip Selection Styles */
        .chip-select-field {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .chip-grid {
          display: grid;
          gap: 8px;
        }

        .chip-btn {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
          color: var(--text-muted);
          padding: 8px 10px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .chip-btn:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.12);
          color: #fff;
        }

        .chip-btn.active {
          background: rgba(255, 255, 255, 0.05);
          border-color: var(--phase-preproduction);
          color: var(--phase-preproduction);
          box-shadow: 0 4px 12px var(--phase-preproduction-glow);
        }

        .toggle-group-premium {
          display: flex;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 4px;
          border-radius: 10px;
          flex: 1;
          height: 46px;
        }

        .toggle-btn-p {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 13px;
          font-weight: 700;
          padding: 10px 0;
          cursor: pointer;
          border-radius: 8px;
          transition: all 0.2s;
        }

        .toggle-btn-p.active {
          background: rgba(255, 255, 255, 0.08);
          color: var(--phase-preproduction);
          box-shadow: 0 0 0 1px var(--phase-preproduction);
        }

        .flash-toggle-premium {
          display: flex;
          align-items: center;
          width: 140px;
          justify-content: center;
          gap: 10px;
          padding: 0 15px;
          height: 46px;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          font-size: 13px;
          font-weight: 700;
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.2s;
        }

        .flash-toggle-premium.active {
          background: rgba(245, 158, 11, 0.1);
          border-color: #f59e0b;
          color: #f59e0b;
          box-shadow: 0 4px 15px rgba(245, 158, 11, 0.15);
        }

        .flash-toggle-premium.disabled {
          opacity: 0.25;
          cursor: not-allowed;
          filter: grayscale(1);
          background: transparent;
          border-color: rgba(255, 255, 255, 0.05);
        }

        /* Output refinements */
        .output-section-premium {
          background: #111114;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
          padding: 32px;
          position: sticky;
          top: 20px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.5);
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .output-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          padding-bottom: 24px;
        }

        .output-header .section-title {
          margin-bottom: 0;
          font-size: 12px;
          color: #fff;
        }

        .badge-group {
          display: flex;
          gap: 8px;
        }

        .technical-badge {
          font-size: 10px;
          font-weight: 800;
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-muted);
          padding: 4px 10px;
          border-radius: 4px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }


        .technical-badge.flash {
          background: rgba(251, 191, 36, 0.1);
          color: #f59e0b;
        }

        .output-rows {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .row-divider {
          height: 1px;
          background: rgba(255, 255, 255, 0.04);
          margin: 16px 0;
        }

        .output-row {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 20px 24px;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 12px;
          border: 1px solid transparent;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          animation: rowIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .output-row:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(255, 255, 255, 0.05);
          transform: translateX(4px);
        }

        .row-icon-wrap {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 10px;
          color: var(--text-muted);
        }

        .row-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .row-label {
          font-size: 9.5px;
          font-weight: 800;
          color: rgba(255,255,255,0.4);
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }


        .row-value-wrap {
          display: flex;
          align-items: baseline;
          gap: 16px;
        }

        .row-value {
          font-size: 15px;
          font-weight: 800;
          color: #fff;
          font-variant-numeric: tabular-nums;
          letter-spacing: -0.01em;
        }

        .row-action {
          font-size: 11px;
          font-weight: 500;
          color: var(--text-secondary);
          opacity: 0.8;
        }

        .tooltip-container {
          position: relative;
          display: inline-block;
        }

        .row-tooltip-btn {
          color: var(--text-muted);
          opacity: 0.3;
          cursor: help;
          padding: 8px;
          border-radius: 50%;
          transition: all 0.2s;
        }

        .row-tooltip-btn:hover {
          opacity: 1;
          color: #fff;
          background: rgba(255, 255, 255, 0.05);
        }

        .tooltip-text {
          visibility: hidden;
          width: 240px;
          background: #1c1c21;
          color: #fff;
          padding: 14px 16px;
          border-radius: 12px;
          position: absolute;
          z-index: 100;
          bottom: 160%;
          left: 50%;
          transform: translateX(-50%) translateY(20px) scale(0.95);
          opacity: 0;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          font-size: 12px;
          line-height: 1.5;
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 0 10px 30px rgba(0,0,0,0.4);
          pointer-events: none;
        }

        .tooltip-container:hover .tooltip-text {
          visibility: visible;
          opacity: 1;
          transform: translateX(-50%) translateY(0) scale(1);
          transition-delay: 200ms;
        }

        .output-row.highlight {
          background: rgba(34, 197, 94, 0.03);
          border-color: rgba(34, 197, 94, 0.1);
        }
        .output-row.highlight .row-icon-wrap { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
        .output-row.highlight .row-value { color: #22c55e; }

        .output-row.warning {
          background: rgba(239, 68, 68, 0.03);
          border-color: rgba(239, 68, 68, 0.1);
        }
        .output-row.warning .row-icon-wrap { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        .output-row.warning .row-value { color: #ef4444; }

        .btn-premium-cta {
          width: 100%;
          background: #fff;
          color: #000;
          border: none;
          padding: 14px;
          border-radius: 14px;
          font-size: 14px;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 4px 20px rgba(255,255,255,0.1);
        }

        .btn-premium-cta:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(255,255,255,0.2);
          background: #f0f0f0;
        }

        .btn-premium-cta:active {
          transform: translateY(0);
        }

        @keyframes appFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes rowIn {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }

        @media (max-width: 1100px) {
          .starter-setup-content {
            grid-template-columns: 1fr;
          }
          .output-section-premium {
            position: relative;
            top: 0;
          }
        }
      `}</style>
    </div>
  );
};

interface SetupRowItemProps {
  data: SetupRowType;
  isHighlight?: boolean;
  isWarning?: boolean;
}

const SetupRowItem: React.FC<SetupRowItemProps> = ({ data, isHighlight, isWarning }) => {
  const IconComponent = () => {
    switch (data.icon) {
      case "thermometer": return <Thermometer size={16} />;
      case "circle": return <Circle size={16} />;
      case "clock": return <Clock size={16} />;
      case "bar-chart": return <BarChart size={16} />;
      case "zap": return <Zap size={16} />;
      case "clipboard-check": return <ClipboardCheck size={16} />;
      case "alert-triangle": return <AlertTriangle size={16} />;
      default: return <Circle size={16} />;
    }
  };

  return (
    <div className={`output-row ${isHighlight ? 'highlight' : ''} ${isWarning ? 'warning' : ''}`}>
      <div className="row-icon-wrap">
        <IconComponent />
      </div>
      <div className="row-main">
        <div className="row-label">{data.label}</div>
        <div className="row-value-wrap">
          <span className="row-value">{data.value}</span>
          <span className="row-action">{data.action}</span>
        </div>
      </div>
      <div className="tooltip-container">
        <div className="row-tooltip-btn">
          <HelpCircle size={14} />
        </div>
        <div className="tooltip-text">{data.tooltip}</div>
      </div>
    </div>
  );
};

export default StarterSetup;
