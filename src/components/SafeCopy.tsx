import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpen, Play, XCircle, CheckCircle, AlertTriangle, Search, FileText, ListChecks, Plus, Trash2 } from "lucide-react";

interface VerificationProgress {
  job_id: string;
  phase: string;
  current_file: string;
  bytes_total: number;
  bytes_processed: number;
  files_total: number;
  files_processed: number;
  ok_count: number;
  mismatch_count: number;
  missing_count: number;
}

interface VerificationItem {
  rel_path: string;
  source_size: number;
  dest_size?: number;
  status: string;
  error_message?: string;
}

interface QueueCheck {
  id: string;
  project_id: string;
  idx: number;
  label?: string | null;
  source_path: string;
  dest_path: string;
  last_job_id?: string | null;
  status: string;
  mode?: string | null;
  duration_ms?: number | null;
  counts_json?: string | null;
}

interface QueueRunStartResult {
  queue_run_id: string;
  job_ids: string[];
}

interface SafeCopyProps {
  projectId: string;
  onJobCreated?: (jobId: string) => void;
  onError?: (error: { title: string; hint: string } | null) => void;
}

const MAX_QUEUE = 5;

export function SafeCopy({ projectId, onJobCreated, onError }: SafeCopyProps) {
  const [mode, setMode] = useState<"FAST" | "SOLID">("SOLID");
  const [queue, setQueue] = useState<QueueCheck[]>([]);
  const [queueRunId, setQueueRunId] = useState<string | null>(null);
  const [isRunningQueue, setIsRunningQueue] = useState(false);
  const [progress, setProgress] = useState<VerificationProgress | null>(null);
  const [results, setResults] = useState<VerificationItem[]>([]);
  const [filter, setFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const persistTimers = useRef<Record<number, number>>({});
  const queueRef = useRef<QueueCheck[]>([]);

  const loadQueue = async () => {
    try {
      const rows = await invoke<QueueCheck[]>("list_verification_queue", { projectId });
      setQueue(rows.sort((a, b) => a.idx - b.idx));
    } catch (e) {
      console.error(e);
      onError?.({ title: "Failed to load verification queue", hint: "Retry. If this persists, export diagnostics." });
    }
  };

  useEffect(() => {
    loadQueue();
    setProgress(null);
    setResults([]);
    setQueueRunId(null);
    setIsRunningQueue(false);
    setActiveJobId(null);
  }, [projectId]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    return () => {
      Object.values(persistTimers.current).forEach((timerId) => window.clearTimeout(timerId));
    };
  }, []);

  useEffect(() => {
    if (!queueRunId) return;
    let mounted = true;
    const poll = async () => {
      try {
        const jobs = await invoke<any[]>("list_jobs");
        const queueJob = jobs.find((j) => j.id === queueRunId);
        if (!mounted) return;
        if (queueJob) {
          const running = queueJob.status === "running" || queueJob.status === "queued";
          setIsRunningQueue(running);
          if (!running) {
            setQueueRunId(null);
            await loadQueue();
          }
        }
      } catch (e) {
        console.error(e);
      }
    };
    poll();
    const t = setInterval(poll, 800);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, [queueRunId]);

  const fetchResults = async (jobId: string) => {
    try {
      const items = await invoke<VerificationItem[]>("get_verification_items", { jobId });
      setResults(items);
      setActiveJobId(jobId);
    } catch (e) {
      console.error("Failed to fetch results:", e);
    }
  };

  useEffect(() => {
    let unlistenProgress: (() => void) | null = null;
    import("@tauri-apps/api/event").then(({ listen }) => {
      listen<VerificationProgress>("verification-progress", (event) => {
        setProgress(event.payload);
        if (event.payload.phase === "DONE" || event.payload.phase === "FAILED" || event.payload.phase === "CANCELLED") {
          fetchResults(event.payload.job_id);
          loadQueue();
        }
      }).then((u) => { unlistenProgress = u; }).catch(console.error);
    });
    return () => {
      if (unlistenProgress) unlistenProgress();
    };
  }, [projectId]);

  const ensureRow = async () => {
    if (queue.length >= MAX_QUEUE) {
      onError?.({ title: "Queue limit reached", hint: "Safe Copy queue supports up to 5 checks." });
      return;
    }
    const idx = queue.length + 1;
    const row = await invoke<QueueCheck>("set_verification_queue_item", {
      projectId,
      idx,
      sourcePath: "",
      destPath: "",
      label: `Check ${String(idx).padStart(2, "0")}`
    });
    setQueue((prev) => [...prev, row].sort((a, b) => a.idx - b.idx));
  };

  const persistRow = async (row: QueueCheck) => {
    const saved = await invoke<QueueCheck>("set_verification_queue_item", {
      projectId,
      idx: row.idx,
      sourcePath: row.source_path,
      destPath: row.dest_path,
      label: row.label ?? ""
    });
    setQueue((prev) => prev.map((q) => (q.idx === saved.idx ? { ...q, ...saved } : q)));
  };

  const updateRow = async (idx: number, patch: Partial<QueueCheck>) => {
    setQueue((prev) =>
      prev.map((row) => (row.idx === idx ? { ...row, ...patch } : row))
    );
    if (persistTimers.current[idx]) {
      window.clearTimeout(persistTimers.current[idx]);
    }
    persistTimers.current[idx] = window.setTimeout(async () => {
      const row = queueRef.current.find((q) => q.idx === idx);
      if (!row) return;
      const nextRow = { ...row, ...patch };
      try {
        await persistRow(nextRow);
        onError?.(null);
      } catch (e) {
        console.error(e);
        onError?.({ title: "Could not save queue row", hint: "Retry editing this row." });
      }
    }, 250);
  };

  const removeRow = async (idx: number) => {
    if (isRunningQueue) return;
    try {
      await invoke("remove_verification_queue_item", { projectId, idx });
      await loadQueue();
    } catch (e) {
      console.error(e);
      onError?.({ title: "Could not remove queue row", hint: "Retry." });
    }
  };

  const clearQueue = async () => {
    if (isRunningQueue) return;
    const confirm = window.confirm("Clear all queue rows?");
    if (!confirm) return;
    await invoke("clear_verification_queue", { projectId });
    setQueue([]);
    setProgress(null);
    setResults([]);
    setActiveJobId(null);
  };

  const choosePath = async (title: string): Promise<string | null> => {
    const selected = await open({ directory: true, multiple: false, title });
    if (!selected || typeof selected !== "string") return null;
    return selected;
  };

  const runQueue = async () => {
    if (queue.length === 0) {
      onError?.({ title: "Queue is empty", hint: "Add at least one source/destination check before running queue." });
      return;
    }
    if (queue.some((q) => !q.source_path || !q.dest_path)) {
      onError?.({ title: "Missing source or destination", hint: "Fill source and destination for all queue rows." });
      return;
    }
    const confirm = window.confirm(`Start ${queue.length} verification checks sequentially?`);
    if (!confirm) return;

    try {
      setResults([]);
      setProgress(null);
      const res = await invoke<QueueRunStartResult>("start_verification_queue", {
        projectId,
        mode
      });
      setQueueRunId(res.queue_run_id);
      setIsRunningQueue(true);
      res.job_ids.forEach((id) => onJobCreated?.(id));
      onError?.(null);
      await loadQueue();
    } catch (e) {
      console.error(e);
      setIsRunningQueue(false);
      onError?.({ title: "Queue run failed to start", hint: "Retry. If this persists, export diagnostics." });
    }
  };

  const cancelQueue = async () => {
    if (!queueRunId) return;
    await invoke("cancel_job", { jobId: queueRunId });
    setIsRunningQueue(false);
  };

  const exportJobMarkdown = async (jobId: string) => {
    const outDir = await choosePath("Export Verification Markdown");
    if (!outDir) return;
    await invoke("export_verification_report_markdown", { jobId, outDir });
  };

  const exportJobPdf = async (jobId: string) => {
    const outDir = await choosePath("Export Verification PDF");
    if (!outDir) return;
    await invoke("export_verification_report_pdf", { jobId, outDir });
  };

  const exportQueueMarkdown = async () => {
    const outDir = await choosePath("Export Combined Queue Markdown");
    if (!outDir) return;
    await invoke("export_verification_queue_report_markdown", { projectId, outDir });
  };

  const exportQueuePdf = async () => {
    const outDir = await choosePath("Export Combined Queue PDF");
    if (!outDir) return;
    await invoke("export_verification_queue_report_pdf", { projectId, outDir });
  };

  const filteredResults = results.filter((item) => {
    const matchesSearch = item.rel_path.toLowerCase().includes(filter.toLowerCase());
    const matchesCategory = categoryFilter === "ALL" ||
      (categoryFilter === "PROBLEMS" && item.status !== "OK") ||
      item.status === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const percent = progress?.bytes_total ? (progress.bytes_processed / progress.bytes_total) * 100 : 0;

  const queueSummary = useMemo(() => {
    let done = 0;
    let failed = 0;
    let cancelled = 0;
    let running = 0;
    queue.forEach((q) => {
      const s = q.status?.toLowerCase() ?? "queued";
      if (s === "done") done += 1;
      else if (s === "failed") failed += 1;
      else if (s === "cancelled") cancelled += 1;
      else if (s === "running") running += 1;
    });
    return { done, failed, cancelled, running, total: queue.length };
  }, [queue]);

  return (
    <div className="safe-copy-view">
      <div className="safecopy-featured-wrapper">
        <div className="safe-copy-config card">
          <div className="dashboard-header">
            <h3>Safe Copy Queue</h3>
            <div className="toolbar-right" style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={ensureRow} disabled={queue.length >= MAX_QUEUE || isRunningQueue}>
                <Plus size={14} /> Add Row
              </button>
              <button className="btn btn-secondary btn-sm" onClick={clearQueue} disabled={queue.length === 0 || isRunningQueue}>
                <Trash2 size={14} /> Clear Queue
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {queue.map((row) => {
              const counts = row.counts_json ? JSON.parse(row.counts_json) : null;
              const status = row.status?.toLowerCase() || "queued";
              return (
                <div key={row.id} className="workspace-root-item" style={{ gridTemplateColumns: "46px 180px 1fr 1fr auto auto", alignItems: "start" }}>
                  <strong style={{ paddingTop: 7 }}>{String(row.idx).padStart(2, "0")}</strong>
                  <input
                    className="input-text"
                    value={row.label ?? ""}
                    onChange={(e) => updateRow(row.idx, { label: e.target.value })}
                    placeholder={`Check ${String(row.idx).padStart(2, "0")}`}
                    disabled={isRunningQueue}
                  />
                  <div className="path-picker">
                    <input type="text" readOnly value={row.source_path} placeholder="Select source..." />
                    <button className="btn btn-secondary btn-sm" onClick={async () => {
                      const p = await choosePath(`Select Source for Check ${String(row.idx).padStart(2, "0")}`);
                      if (p) updateRow(row.idx, { source_path: p });
                    }} disabled={isRunningQueue}>
                      <FolderOpen size={14} />
                    </button>
                  </div>
                  <div className="path-picker">
                    <input type="text" readOnly value={row.dest_path} placeholder="Select destination..." />
                    <button className="btn btn-secondary btn-sm" onClick={async () => {
                      const p = await choosePath(`Select Destination for Check ${String(row.idx).padStart(2, "0")}`);
                      if (p) updateRow(row.idx, { dest_path: p });
                    }} disabled={isRunningQueue}>
                      <FolderOpen size={14} />
                    </button>
                  </div>
                  <div style={{ display: "grid", gap: 6 }}>
                    <span className={`status-pill ${status}`}>{status.toUpperCase()}</span>
                    {counts && (
                      <span className="workspace-root-path">
                        Verified {counts.verified ?? 0} / Missing {counts.missing ?? 0}
                      </span>
                    )}
                    {row.duration_ms != null && <span className="workspace-root-path">{row.duration_ms} ms</span>}
                  </div>
                  <div style={{ display: "grid", gap: 6 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => removeRow(row.idx)} disabled={isRunningQueue}>
                      <Trash2 size={14} />
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => row.last_job_id && exportJobMarkdown(row.last_job_id)} disabled={!row.last_job_id}>
                      <FileText size={14} /> MD
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => row.last_job_id && exportJobPdf(row.last_job_id)} disabled={!row.last_job_id}>
                      <FileText size={14} /> PDF
                    </button>
                  </div>
                </div>
              );
            })}
            {queue.length === 0 && <div className="workspace-root-path">No checks in queue yet.</div>}
          </div>

          <div className="config-actions" style={{ gap: 10, flexWrap: "wrap", marginTop: 16 }}>
            <div className="mode-toggle">
              <button className={`btn-toggle ${mode === "SOLID" ? "active" : ""}`} onClick={() => setMode("SOLID")} disabled={isRunningQueue}>
                SOLID (Bit-Accurate)
              </button>
              <button className={`btn-toggle ${mode === "FAST" ? "active" : ""}`} onClick={() => setMode("FAST")} disabled={isRunningQueue}>
                FAST (Metadata)
              </button>
            </div>
            <button className="btn btn-primary btn-lg" onClick={runQueue} disabled={isRunningQueue || queue.length === 0 || queue.some((q) => !q.source_path || !q.dest_path)}>
              <Play size={18} /> Start Verification
            </button>
            <button className="btn btn-danger btn-lg" onClick={cancelQueue} disabled={!isRunningQueue || !queueRunId}>
              <XCircle size={18} /> Cancel Queue
            </button>
            <button className="btn btn-secondary btn-lg" onClick={exportQueueMarkdown} disabled={queue.length === 0}>
              <ListChecks size={18} /> Export Combined Markdown
            </button>
            <button className="btn btn-secondary btn-lg" onClick={exportQueuePdf} disabled={queue.length === 0}>
              <ListChecks size={18} /> Export Combined PDF
            </button>
          </div>
        </div>

        {(progress || queue.length > 0) && (
          <div className="verification-dashboard card">
            <div className="dashboard-header">
              <h3>{isRunningQueue ? "Queue Running" : "Queue Summary"}</h3>
              <span className="job-id">{queueRunId ? `Queue: ${queueRunId.slice(0, 12)}` : "Idle"}</span>
            </div>

            <div className="dashboard-stats">
              <div className="dash-stat">
                <span className="label">Done</span>
                <span className="value ok">{queueSummary.done}</span>
              </div>
              <div className="dash-stat">
                <span className="label">Failed</span>
                <span className="value fail">{queueSummary.failed}</span>
              </div>
              <div className="dash-stat">
                <span className="label">Cancelled</span>
                <span className="value">{queueSummary.cancelled}</span>
              </div>
              <div className="dash-stat">
                <span className="label">Total</span>
                <span className="value">{queueSummary.total}</span>
              </div>
            </div>

            {progress && (
              <div className="progress-section">
                <div className="progress-info">
                  <span className="current-file">{progress.current_file || "Identifying files..."}</span>
                  <span>{Math.round(percent)}%</span>
                </div>
                <div className="progress-bar-wrapper">
                  <div className="progress-bar-fill" style={{ width: `${percent}%`, background: progress.phase === "DONE" ? "var(--color-primary)" : "var(--accent-glow)" }} />
                </div>
              </div>
            )}
          </div>
        )}

        {results.length > 0 && (
          <div className="results-container card">
            <div className="results-toolbar">
              <div className="toolbar-left">
                <div className="search-box">
                  <Search size={14} />
                  <input type="text" placeholder="Search files..." value={filter} onChange={(e) => setFilter(e.target.value)} />
                </div>
                <div className="filter-tabs">
                  <button className={`tab ${categoryFilter === "ALL" ? "active" : ""}`} onClick={() => setCategoryFilter("ALL")}>All</button>
                  <button className={`tab tab-problems ${categoryFilter === "PROBLEMS" ? "active" : ""}`} onClick={() => setCategoryFilter("PROBLEMS")}>Problems</button>
                  <button className={`tab tab-verified ${categoryFilter === "OK" ? "active" : ""}`} onClick={() => setCategoryFilter("OK")}>Verified</button>
                </div>
              </div>
              <div className="toolbar-right">
                {activeJobId && (
                  <>
                    <button className="btn btn-secondary btn-sm" onClick={() => exportJobMarkdown(activeJobId)}><FileText size={14} /> Export MD</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => exportJobPdf(activeJobId)}><FileText size={14} /> Export PDF</button>
                  </>
                )}
              </div>
            </div>

            <div className="results-table-scroll">
              <table className="results-table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Relative Path</th>
                    <th>Size</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.slice(0, 100).map((item, i) => (
                    <tr key={i} className={item.status === "OK" ? "row-ok" : "row-fail"}>
                      <td className="status-cell">
                        {item.status === "OK" ? <CheckCircle size={14} className="ok" /> :
                          item.status === "MISSING" ? <XCircle size={14} className="fail" /> :
                            <AlertTriangle size={14} className="warn" />}
                        <span className="status-label">{item.status === "OK" ? "Verified" : item.status}</span>
                      </td>
                      <td className="path-cell">{item.rel_path}</td>
                      <td className="size-cell">{formatFileSize(item.source_size)}</td>
                      <td className="detail-cell">{item.error_message || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredResults.length > 100 && <div className="table-footer">Showing first 100 results...</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}
