import { useState, useCallback, useMemo, useEffect } from "react";
import { 
  Plus, 
  ExternalLink, 
  FileText, 
  AlertCircle, 
  Folder, 
  CheckCircle2, 
  X, 
  Scan,
  Download,
  FileSearch,
  Info,
  Eye,
  RotateCcw,
  Trash2,
  SlidersHorizontal
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { open, confirm, message, save } from "@tauri-apps/plugin-dialog";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import { writeFile } from "@tauri-apps/plugin-fs";
import { jsPDF } from "jspdf";

interface DuplicateFile {
  path: string;
  filename: string;
  size: u64;
  modified: string;
}

interface DuplicateGroup {
  hash: string;
  size: u64;
  files: DuplicateFile[];
}

interface ScanProgress {
  phase: string;
  count: number;
  current_path?: string;
  detail?: string;
}

interface ScanResult {
  groups: DuplicateGroup[];
  errors: string[];
}

type u64 = number;

function formatSize(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function DuplicateFinderApp() {
  const [folders, setFolders] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [results, setResults] = useState<DuplicateGroup[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [uiError, setUiError] = useState<string | null>(null);
  const [scanStats, setScanStats] = useState<{ startTime: number; endTime: number } | null>(null);
  const [isDragTargetActive, setIsDragTargetActive] = useState(false);

  // Scan options (phase 4)
  const [minSizeMB, setMinSizeMB] = useState("0");
  const [includeHidden, setIncludeHidden] = useState(false);
  const [includeExts, setIncludeExts] = useState("");
  const [excludeExts, setExcludeExts] = useState("");
  const [excludeDirs, setExcludeDirs] = useState("node_modules, .git");

  // Bulk selection of files marked for trash
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isTrashing, setIsTrashing] = useState(false);

  const addFolder = useCallback(async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: true,
        title: "Select Folders to Scan"
      });
      if (selected && Array.isArray(selected)) {
        setFolders(prev => [...new Set([...prev, ...selected])]);
      } else if (selected && typeof selected === "string") {
        setFolders(prev => [...new Set([...prev, selected])]);
      }
    } catch (err) {
      console.error(err);
      setUiError("Failed to open folder dialog.");
    }
  }, []);

  const addFolders = useCallback((paths: string[]) => {
    const cleanPaths = paths.map(path => path.trim()).filter(Boolean);
    if (cleanPaths.length === 0) return;
    setFolders(prev => [...new Set([...prev, ...cleanPaths])]);
  }, []);

  useEffect(() => {
    const appWindow = getCurrentWindow();

    const unlistenDrop = appWindow.listen<{ paths: string[] }>("tauri://drag-drop", (event) => {
      setIsDragTargetActive(false);
      addFolders(event.payload.paths);
    });
    const unlistenEnter = appWindow.listen("tauri://drag-enter", () => setIsDragTargetActive(true));
    const unlistenOver = appWindow.listen("tauri://drag-over", () => setIsDragTargetActive(true));
    const unlistenLeave = appWindow.listen("tauri://drag-leave", () => setIsDragTargetActive(false));

    return () => {
      unlistenDrop.then(fn => fn());
      unlistenEnter.then(fn => fn());
      unlistenOver.then(fn => fn());
      unlistenLeave.then(fn => fn());
    };
  }, [addFolders]);

  const removeFolder = (path: string) => {
    setFolders(prev => prev.filter(p => p !== path));
  };

  const resetDuplicateFinder = useCallback(() => {
    setFolders([]);
    setIsScanning(false);
    setIsCancelling(false);
    setProgress(null);
    setResults([]);
    setErrors([]);
    setUiError(null);
    setScanStats(null);
    setSelected(new Set());
  }, []);

  const buildScanOptions = useCallback(() => {
    const parseExts = (s: string) =>
      s.split(",").map(x => x.trim().replace(/^\./, "").toLowerCase()).filter(Boolean);
    const mb = parseFloat(minSizeMB);
    return {
      minSize: Number.isFinite(mb) && mb > 0 ? Math.round(mb * 1024 * 1024) : 0,
      includeHidden,
      includeExts: parseExts(includeExts),
      excludeExts: parseExts(excludeExts),
      excludeDirs: excludeDirs.split(",").map(x => x.trim()).filter(Boolean),
    };
  }, [minSizeMB, includeHidden, includeExts, excludeExts, excludeDirs]);

  const startScan = async () => {
    if (folders.length === 0) return;

    setIsScanning(true);
    setIsCancelling(false);
    setUiError(null);
    setErrors([]);
    setResults([]);
    setSelected(new Set());
    setProgress({ phase: "Initializing...", count: 0 });
    const startTime = Date.now();

    // Listen for progress events
    const unlisten = await listen<ScanProgress>("duplicate-scan-progress", (event) => {
      setProgress(event.payload);
    });

    try {
      const resp = await invoke("scan_duplicates", { paths: folders, options: buildScanOptions() }) as ScanResult;
      setResults(resp.groups);
      setErrors(resp.errors);
      setScanStats({ startTime, endTime: Date.now() });
    } catch (err) {
      console.error(err);
      setUiError(String(err));
    } finally {
      setIsScanning(false);
      setIsCancelling(false);
      setProgress(null);
      unlisten();
    }
  };

  const stopScan = useCallback(async () => {
    setIsCancelling(true);
    try {
      await invoke("cancel_duplicate_scan");
    } catch (err) {
      console.error(err);
    }
  }, []);

  const dropFilesFromResults = useCallback((removed: Set<string>) => {
    setResults(prev => prev
      .map(group => ({ ...group, files: group.files.filter(f => !removed.has(f.path)) }))
      .filter(group => group.files.length > 1));
    setSelected(prev => {
      const next = new Set(prev);
      removed.forEach(p => next.delete(p));
      return next;
    });
  }, []);

  const deleteFile = async (filePath: string, groupHash: string) => {
    const fileName = filePath.split(/[\\/]/).pop();
    const group = results.find(g => g.hash === groupHash);
    const keep = group?.files.find(f => f.path !== filePath)?.path;
    const confirmed = await confirm(
      `Are you sure you want to move "${fileName}" to the trash?`,
      { title: "Move to Trash", kind: 'warning' }
    );

    if (confirmed) {
      try {
        await invoke("delete_duplicate_file", { path: filePath, verifyAgainst: keep });
        dropFilesFromResults(new Set([filePath]));
        await message(`Successfully moved "${fileName}" to trash.`, { title: "File Removed", kind: 'info' });
      } catch (err) {
        console.error(err);
        setUiError(`Failed to delete file: ${err}`);
      }
    }
  };

  const toggleSelected = useCallback((path: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const autoSelect = useCallback((keep: "newest" | "oldest" | "shortest-path") => {
    setSelected(() => {
      const next = new Set<string>();
      for (const group of results) {
        const sorted = [...group.files].sort((a, b) => {
          if (keep === "shortest-path") return a.path.length - b.path.length;
          const cmp = (a.modified || "").localeCompare(b.modified || "");
          return keep === "newest" ? -cmp : cmp;
        });
        sorted.slice(1).forEach(f => next.add(f.path));
      }
      return next;
    });
  }, [results]);

  const trashSelected = async () => {
    if (selected.size === 0) return;
    const confirmed = await confirm(
      `Move ${selected.size} selected file${selected.size === 1 ? "" : "s"} to the trash? One copy is kept in every group.`,
      { title: "Move to Trash", kind: "warning" }
    );
    if (!confirmed) return;

    setIsTrashing(true);
    const removed = new Set<string>();
    const failures: string[] = [];
    try {
      for (const group of results) {
        const keep = group.files.find(f => !selected.has(f.path))?.path;
        for (const file of group.files) {
          if (!selected.has(file.path)) continue;
          try {
            await invoke("delete_duplicate_file", { path: file.path, verifyAgainst: keep });
            removed.add(file.path);
          } catch (err) {
            failures.push(`${file.path}: ${err}`);
          }
        }
      }
    } finally {
      dropFilesFromResults(removed);
      setIsTrashing(false);
      if (failures.length > 0) {
        setErrors(prev => [...prev, ...failures]);
        setUiError(`${removed.size} moved to trash, ${failures.length} failed.`);
      } else {
        await message(`Moved ${removed.size} file${removed.size === 1 ? "" : "s"} to trash.`, { title: "Cleanup Complete", kind: "info" });
      }
    }
  };

  const revealInFinder = async (path: string) => {
    try {
      await revealItemInDir(path);
    } catch (err) {
      console.error(err);
      setUiError("Failed to reveal file in Finder or Explorer.");
    }
  };

  const watchFile = async (path: string) => {
    try {
      await openPath(path);
    } catch (err) {
      console.error(err);
      setUiError("Failed to open file for preview.");
    }
  };

  const totalWastedSpace = useMemo(() => {
    return results.reduce((acc, group) => {
      // Wasted space = (count - 1) * size
      return acc + (group.files.length - 1) * group.size;
    }, 0);
  }, [results]);

  const exportPDF = async () => {
    if (results.length === 0) return;

    try {
      const doc = new jsPDF();
      let y = 20;
      const margin = 20;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Title
      doc.setFontSize(22);
      doc.setTextColor(33, 33, 33);
      doc.text("Duplicate Files Report", margin, y);
      y += 12;

      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated on ${new Date().toLocaleString()}`, margin, y);
      y += 8;
      doc.text(`Folders scanned: ${folders.length}`, margin, y);
      y += 5;
      doc.text(`Duplicates found: ${results.length} groups`, margin, y);
      y += 5;
      doc.text(`Potential space savings: ${formatSize(totalWastedSpace)}`, margin, y);
      y += 15;

      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y, pageWidth - margin, y);
      y += 15;

      // Groups
      results.forEach((group, gIdx) => {
        if (y > pageHeight - 40) {
          doc.addPage();
          y = 20;
        }

        doc.setFontSize(12);
        doc.setTextColor(33, 33, 33);
        doc.setFont("helvetica", "bold");
        doc.text(`Group ${gIdx + 1} - ${formatSize(group.size)} per file`, margin, y);
        y += 7;

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(80, 80, 80);
        
        group.files.forEach((file, fIdx) => {
          if (y > pageHeight - 20) {
            doc.addPage();
            y = 20;
          }
          const text = `[${fIdx + 1}] ${file.path}`;
          const lines = doc.splitTextToSize(text, pageWidth - margin * 2 - 10);
          doc.text(lines, margin + 5, y);
          y += (lines.length * 5) + 2;
        });

        y += 5;
        doc.setDrawColor(240, 240, 240);
        doc.line(margin, y, pageWidth - margin, y);
        y += 10;
      });

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `DuplicateReport_${timestamp}.pdf`;

      const filePath = await save({
        filters: [{ name: "PDF Document", extensions: ["pdf"] }],
        defaultPath: filename,
        title: "Export Duplicate Files Report"
      });
      if (!filePath) return;

      await writeFile(filePath, new Uint8Array(doc.output("arraybuffer")));
      await message(`Duplicate report saved to ${filePath}`, { title: "PDF Export Complete", kind: "info" });
    } catch (err) {
      console.error(err);
      setUiError("Failed to generate PDF report.");
    }
  };

  return (
    <div className="duplicate-finder-container">
      <div className="duplicate-finder-header">
        <div className="header-left">
          <h2>Duplicate File Finder</h2>
        </div>
        <div className="header-right">
          <button className="btn btn-secondary btn-glass" onClick={addFolder} disabled={isScanning}>
            <Plus size={16} /> Add Folders
          </button>
          <button
            className="btn btn-primary btn-glow"
            onClick={startScan}
            disabled={isScanning || folders.length === 0}
          >
            {isScanning ? <div className="spinner" /> : <Scan size={16} />}
            <span>{isScanning ? "Scanning Content..." : "Start Scan"}</span>
          </button>
          {isScanning && (
            <button
              className="btn btn-secondary btn-glass"
              onClick={stopScan}
              disabled={isCancelling}
            >
              <X size={16} /> {isCancelling ? "Stopping..." : "Stop"}
            </button>
          )}
          {results.length > 0 && (
            <button className="btn btn-secondary btn-glass" onClick={exportPDF}>
              <Download size={16} /> Export PDF
            </button>
          )}
          {(folders.length > 0 || results.length > 0 || scanStats || errors.length > 0 || uiError) && (
            <button className="btn btn-secondary btn-glass" onClick={resetDuplicateFinder} disabled={isScanning}>
              <RotateCcw size={16} /> Reset
            </button>
          )}
        </div>
      </div>

      {uiError && (
        <div className="status-alert error">
          <AlertCircle size={16} />
          <span>{uiError}</span>
          <button className="close-btn" onClick={() => setUiError(null)}><X size={14} /></button>
        </div>
      )}

      {errors.length > 0 && (
        <div className="status-alert warning">
          <AlertCircle size={16} />
          <div className="error-log">
            <strong>Partial Scan Warnings:</strong>
            <ul>
              {errors.slice(0, 3).map((e, i) => <li key={i}>{e}</li>)}
              {errors.length > 3 && <li>...and {errors.length - 3} more</li>}
            </ul>
          </div>
          <button className="close-btn" onClick={() => setErrors([])}><X size={14} /></button>
        </div>
      )}

      <div className="duplicate-finder-workspace">
        <div className="workspace-sidebar">
          <div className="segment">
            <div className="segment-header">
              <Folder size={14} />
              <span>SCAN TARGETS</span>
            </div>
            <div className={`folder-list premium-scroll ${isDragTargetActive ? "drag-active" : ""}`}>
              {folders.length === 0 ? (
                <div className="empty-state">
                  <Folder size={20} />
                  <span>Drop folders here or click Add Folders</span>
                </div>
              ) : (
                folders.map((path, idx) => (
                  <div key={idx} className="folder-tag">
                    <span className="folder-path" title={path}>{path}</span>
                    <button onClick={() => removeFolder(path)} disabled={isScanning}>
                      <X size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="segment scan-options">
            <div className="segment-header">
              <SlidersHorizontal size={14} />
              <span>SCAN OPTIONS</span>
            </div>
            <div className="options-body">
              <label className="opt-row">
                <span>Min file size (MB)</span>
                <input
                  type="number" min="0" step="1" value={minSizeMB}
                  onChange={e => setMinSizeMB(e.target.value)}
                  disabled={isScanning}
                />
              </label>
              <label className="opt-row opt-check">
                <input
                  type="checkbox" checked={includeHidden}
                  onChange={e => setIncludeHidden(e.target.checked)}
                  disabled={isScanning}
                />
                <span>Include hidden files &amp; folders</span>
              </label>
              <label className="opt-row opt-stack">
                <span>Only these extensions</span>
                <input
                  type="text" placeholder="e.g. mov, mp4, braw" value={includeExts}
                  onChange={e => setIncludeExts(e.target.value)}
                  disabled={isScanning}
                />
              </label>
              <label className="opt-row opt-stack">
                <span>Skip extensions</span>
                <input
                  type="text" placeholder="e.g. tmp, log" value={excludeExts}
                  onChange={e => setExcludeExts(e.target.value)}
                  disabled={isScanning}
                />
              </label>
              <label className="opt-row opt-stack">
                <span>Skip folders</span>
                <input
                  type="text" placeholder="e.g. node_modules, .git" value={excludeDirs}
                  onChange={e => setExcludeDirs(e.target.value)}
                  disabled={isScanning}
                />
              </label>
            </div>
          </div>

          <div className="segment summary-stats">
            <div className="segment-header">
              <Info size={14} />
              <span>SCAN SUMMARY</span>
            </div>
            <div className="stats-grid">
              <div className="stat-item">
                <label>Duplicate Groups</label>
                <span className="stat-value">{results.length}</span>
              </div>
              <div className="stat-item">
                <label>Wasted Space</label>
                <span className="stat-value highlight">{formatSize(totalWastedSpace)}</span>
              </div>
              {scanStats && (
                <div className="stat-item">
                  <label>Scan Duration</label>
                  <span className="stat-value">{((scanStats.endTime - scanStats.startTime) / 1000).toFixed(2)}s</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="workspace-results segment">
          <div className="segment-header">
            <FileSearch size={14} />
            <span>RESULTS {results.length > 0 && `(${results.length} Groups)`}</span>
            {results.length > 0 && !isScanning && (
              <div className="results-toolbar">
                <select
                  className="auto-select"
                  defaultValue=""
                  onChange={e => { if (e.target.value) { autoSelect(e.target.value as "newest" | "oldest" | "shortest-path"); e.target.value = ""; } }}
                >
                  <option value="" disabled>Auto-select…</option>
                  <option value="newest">Keep newest, select rest</option>
                  <option value="oldest">Keep oldest, select rest</option>
                  <option value="shortest-path">Keep shortest path, select rest</option>
                </select>
                {selected.size > 0 && (
                  <button className="btn btn-secondary btn-glass" onClick={() => setSelected(new Set())}>
                    Clear ({selected.size})
                  </button>
                )}
                <button
                  className="btn btn-primary"
                  onClick={trashSelected}
                  disabled={selected.size === 0 || isTrashing}
                >
                  <Trash2 size={14} /> {isTrashing ? "Trashing…" : `Trash Selected (${selected.size})`}
                </button>
              </div>
            )}
          </div>
          <div className="results-list premium-scroll">
            {isScanning ? (
              (() => {
                const isVerifying = progress?.phase === "verifying content";
                const pct = isVerifying ? Math.min(100, Math.max(0, progress?.count ?? 0)) : null;
                return (
                  <div className="loading-state">
                    <div className="spinner large" />
                    <p style={{ textTransform: "capitalize" }}>
                      {isCancelling ? "Stopping scan..." : (progress?.phase || "Analyzing file signatures...")}
                    </p>
                    {progress && (
                      <div className="progress-details">
                        <span className="count-badge">
                          {isVerifying
                            ? `${pct}%`
                            : progress.phase === "indexing"
                              ? `${progress.count.toLocaleString()} files indexed`
                              : `${progress.count.toLocaleString()} candidates`}
                        </span>
                        {progress.detail && <span className="current-path">{progress.detail}</span>}
                        {progress.current_path && <span className="current-path">{progress.current_path}</span>}
                      </div>
                    )}
                    <div className="progress-bar-container">
                      {pct !== null
                        ? <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                        : <div className="progress-bar-indeterminate" />}
                    </div>
                  </div>
                );
              })()
            ) : results.length === 0 ? (
              <div className="empty-state-large">
                <div className="icon-circle"><CheckCircle2 size={32} /></div>
                <h3>{scanStats ? "No Duplicates Found" : "Ready to Scan"}</h3>
                <p>{scanStats ? "All files in the selected directories appear to be unique." : "Select one or more folders and click 'Start Scan' to find identical files."}</p>
              </div>
            ) : (
              results.map((group, gIdx) => (
                <div key={group.hash} className="duplicate-group">
                  <div className="group-header">
                    <div className="group-info">
                      <span className="group-label">Group {gIdx + 1}</span>
                      <span className="group-hash">HASH: {group.hash.substring(0, 12)}...</span>
                    </div>
                    <div className="group-meta">
                      <span className="file-size-badge">{formatSize(group.size)} per file</span>
                      <span className="waste-badge">Waste: {formatSize((group.files.length - 1) * group.size)}</span>
                    </div>
                  </div>
                  <div className="group-files">
                    {group.files.map((file, fIdx) => (
                      <div key={fIdx} className={`file-item ${selected.has(file.path) ? "file-item-selected" : ""}`}>
                        <input
                          type="checkbox"
                          className="file-select"
                          checked={selected.has(file.path)}
                          onChange={() => toggleSelected(file.path)}
                          title="Mark this copy for trash"
                        />
                        <div className="file-icon"><FileText size={16} /></div>
                        <div className="file-details">
                          <div className="file-name">{file.filename}</div>
                          <div className="file-path">{file.path}</div>
                        </div>
                        <div className="file-actions">
                          <button className="btn-browse" onClick={() => revealInFinder(file.path)}>
                            <ExternalLink size={14} />
                            <span>Browse</span>
                          </button>
                          <button className="btn-watch" onClick={() => watchFile(file.path)}>
                            <Eye size={14} />
                            <span>Watch</span>
                          </button>
                          <button className="btn-trash" onClick={() => deleteFile(file.path, group.hash)}>
                            <X size={14} />
                            <span>Trash</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <style>{`
        .duplicate-finder-container {
          padding: 32px;
          background: var(--inspector-bg);
          backdrop-filter: var(--inspector-glass-blur);
          border-radius: var(--radius-lg);
          border: var(--inspector-border);
          color: var(--text-primary);
          animation: fadeInApp 0.36s ease;
          box-shadow: var(--shadow-lg);
          height: calc(100vh - 180px);
          display: flex;
          flex-direction: column;
        }

        @keyframes fadeInApp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .duplicate-finder-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 24px;
        }

        .header-left h2 {
          margin: 0;
          font-size: 1.75rem;
          font-weight: 700;
          letter-spacing: -0.02em;
          white-space: nowrap;
        }

        .header-right {
          display: flex;
          gap: 12px;
        }


        .duplicate-finder-workspace {
          display: grid;
          grid-template-columns: 320px 1fr;
          gap: 24px;
          flex: 1;
          min-height: 0;
        }

        .workspace-sidebar {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .segment {
          background: rgba(0, 0, 0, 0.2);
          border: var(--inspector-border);
          border-radius: var(--radius-md);
          display: flex;
          flex-direction: column;
          min-height: 0;
        }

        .segment-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          color: var(--text-muted);
          text-transform: uppercase;
        }

        .folder-list {
          padding: 12px;
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 8px;
          border: 1px dashed transparent;
          border-radius: var(--radius-sm);
          transition: border-color 0.2s ease, background 0.2s ease;
        }

        .folder-list.drag-active {
          background: rgba(0, 209, 255, 0.06);
          border-color: rgba(0, 209, 255, 0.32);
        }

        .empty-state {
          flex: 1;
          min-height: 108px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          color: var(--text-muted);
          text-align: center;
          font-size: 0.88rem;
          line-height: 1.35;
          padding: 16px;
        }

        .folder-tag {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 10px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: var(--radius-sm);
          font-size: 0.8rem;
          transition: all 0.2s ease;
        }

        .folder-tag:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: var(--phase-preproduction-soft);
        }

        .folder-path {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-right: 8px;
          opacity: 0.8;
        }

        .folder-tag button {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          display: flex;
          padding: 2px;
          border-radius: 4px;
        }

        .folder-tag button:hover {
          background: rgba(239, 68, 68, 0.1);
          color: var(--status-red);
        }

        .stats-grid {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .stat-item label {
          font-size: 0.75rem;
          color: var(--text-muted);
          font-weight: 500;
        }

        .stat-item value {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .stat-item value.highlight {
          color: var(--phase-preproduction);
        }

        .results-list {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .duplicate-group {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: var(--radius-md);
          overflow: hidden;
        }

        .group-header {
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.03);
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .group-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .group-label {
          font-weight: 700;
          font-size: 0.9rem;
        }

        .group-hash {
          font-family: monospace;
          font-size: 0.75rem;
          opacity: 0.4;
        }

        .group-meta {
          display: flex;
          gap: 12px;
        }

        .file-size-badge {
          background: rgba(255, 255, 255, 0.05);
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-muted);
        }

        .waste-badge {
          background: rgba(239, 68, 68, 0.1);
          color: var(--status-red);
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 700;
        }

        .group-files {
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .file-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          border-radius: var(--radius-sm);
          transition: background 0.2s ease;
        }

        .file-item:hover {
          background: rgba(255, 255, 255, 0.03);
        }

        .file-icon {
          color: var(--phase-preproduction);
          opacity: 0.6;
        }

        .file-details {
          flex: 1;
          min-width: 0;
        }

        .file-name {
          font-size: 0.9rem;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .file-path {
          font-size: 0.75rem;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          opacity: 0.7;
        }

        .btn-browse,
        .btn-watch {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-browse {
          background: rgba(0, 209, 255, 0.05);
          border: 1px solid rgba(0, 209, 255, 0.1);
          color: var(--phase-preproduction);
        }

        .btn-watch {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: var(--text-primary);
        }

        .btn-browse:hover {
          background: var(--phase-preproduction);
          color: white;
          border-color: var(--phase-preproduction);
        }

        .btn-watch:hover {
          background: rgba(255, 255, 255, 0.12);
          border-color: rgba(255, 255, 255, 0.18);
        }

        .loading-state, .empty-state-large {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px;
          text-align: center;
        }

        .loading-state p {
          margin: 16px 0 8px;
          font-size: 1.1rem;
          font-weight: 600;
        }

        .loading-state span {
          color: var(--text-muted);
          font-size: 0.9rem;
        }

        .empty-state-large .icon-circle {
          width: 64px;
          height: 64px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 24px;
          color: var(--phase-preproduction);
          opacity: 0.4;
        }

        .empty-state-large h3 {
          font-size: 1.25rem;
          margin: 0 0 8px;
        }

        .empty-state-large p {
          color: var(--text-muted);
          max-width: 400px;
        }

        .status-alert {
          margin-bottom: 20px;
          padding: 12px 16px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          gap: 12px;
          position: relative;
        }

        .status-alert.error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          color: #ff8080;
        }

        .close-btn {
          margin-left: auto;
          background: none;
          border: none;
          color: inherit;
          opacity: 0.5;
          cursor: pointer;
          padding: 4px;
        }

        .spinner.large {
          width: 48px;
          height: 48px;
        }

        .premium-scroll::-webkit-scrollbar {
          width: 4px;
        }
        .premium-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }

        .progress-bar-container {
          width: 300px;
          height: 6px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
          margin-top: 24px;
          overflow: hidden;
          position: relative;
        }

        .progress-bar-indeterminate {
          position: absolute;
          left: -30%;
          width: 30%;
          height: 100%;
          background: var(--phase-preproduction);
          animation: progressIndeterminate 1.5s infinite linear;
        }

        .progress-bar-fill {
          height: 100%;
          background: var(--phase-preproduction);
          border-radius: 10px;
          transition: width 0.2s ease;
        }

        .scan-options .options-body {
          padding: 12px 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .opt-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          font-size: 0.72rem;
          color: var(--text-secondary);
        }
        .opt-row.opt-stack {
          flex-direction: column;
          align-items: stretch;
          gap: 4px;
        }
        .opt-row.opt-check {
          justify-content: flex-start;
        }
        .opt-row input[type="number"],
        .opt-row input[type="text"] {
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: var(--radius-sm, 6px);
          color: var(--text-primary);
          padding: 6px 8px;
          font-size: 0.72rem;
          width: 100%;
          max-width: 130px;
        }
        .opt-row.opt-stack input[type="text"] { max-width: none; }
        .opt-row input:focus {
          outline: none;
          border-color: var(--phase-preproduction);
        }
        .opt-row.opt-check input { accent-color: var(--phase-preproduction); }

        .results-toolbar {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .auto-select {
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: var(--radius-sm, 6px);
          color: var(--text-primary);
          padding: 5px 8px;
          font-size: 0.7rem;
        }
        .file-select {
          flex-shrink: 0;
          margin-right: 4px;
          accent-color: var(--phase-preproduction);
          cursor: pointer;
        }
        .file-item-selected {
          background: rgba(255, 255, 255, 0.04);
          border-color: var(--phase-preproduction);
        }

        @keyframes progressIndeterminate {
          0% { left: -30%; }
          100% { left: 100%; }
        }

        .progress-details {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          margin-top: 12px;
        }

        .count-badge {
          font-size: 0.8rem;
          color: var(--phase-preproduction);
          font-weight: 700;
        }

        .current-path {
          font-size: 0.75rem;
          color: var(--text-muted);
          max-width: 500px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .file-actions {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 8px;
        }

        .btn-trash {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(239, 68, 68, 0.05);
          border: 1px solid rgba(239, 68, 68, 0.1);
          color: var(--status-red);
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-trash:hover {
          background: var(--status-red);
          color: white;
          border-color: var(--status-red);
        }

        .error-log {
          font-size: 0.85rem;
          text-align: left;
        }

        .error-log ul {
          margin: 4px 0 0;
          padding-left: 20px;
        }

        .status-alert.warning {
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.2);
          color: #ffb347;
        }
      `}</style>
    </div>
  );
}
