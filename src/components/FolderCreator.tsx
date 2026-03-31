import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { FolderTree, Plus, Trash2, RotateCcw, Download, Folder, FileType, ChevronRight, ChevronDown, Hash, UploadCloud, FileJson, HardDrive, Archive, History, Save } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open, save } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { writeTextFile } from "@tauri-apps/plugin-fs";

interface FolderNode {
  id: string;
  name: string;
  type: "folder" | "file";
  children?: FolderNode[];
}

const MAX_STRUCTURE_DEPTH = 12;
const MAX_STRUCTURE_NODES = 1000;
const INVALID_NAME_CHARS = /[\/\\?%*:|"<>]/g;
const LAST_STRUCTURE_KEY = "folder_creator_last_structure_v1";
const CANONICAL_COUNT_LABELS = ["Main", "Primary", "Secondary"];

function sanitizeNodeName(name: string) {
  return name.replace(INVALID_NAME_CHARS, "_").trim();
}

function getHierarchyLabel(depth: number) {
  return CANONICAL_COUNT_LABELS[depth] ?? null;
}

function makeSiblingKey(name: string) {
  return sanitizeNodeName(name).toLocaleLowerCase();
}

function makeUniqueNodeName(baseName: string, siblings: FolderNode[]) {
  const sanitizedBase = sanitizeNodeName(baseName) || "node";
  const existing = new Set(siblings.map((node) => makeSiblingKey(node.name)));
  if (!existing.has(makeSiblingKey(sanitizedBase))) {
    return sanitizedBase;
  }

  let suffix = 2;
  while (existing.has(makeSiblingKey(`${sanitizedBase}_${suffix}`))) {
    suffix += 1;
  }
  return `${sanitizedBase}_${suffix}`;
}

function validateFolderNodes(
  nodes: FolderNode[],
  depth = 1,
  parentLabel = "root",
  counter = { value: 0 }
): string | null {
  if (depth > MAX_STRUCTURE_DEPTH) {
    return `Folder structure exceeds the ${MAX_STRUCTURE_DEPTH}-level depth limit.`;
  }

  const seen = new Set<string>();
  for (const node of nodes) {
    counter.value += 1;
    if (counter.value > MAX_STRUCTURE_NODES) {
      return `Folder structure exceeds the ${MAX_STRUCTURE_NODES} node limit.`;
    }

    const sanitized = sanitizeNodeName(node.name);
    if (!sanitized) {
      return "Folder structure contains an empty node name.";
    }

    const duplicateKey = sanitized.toLocaleLowerCase();
    if (seen.has(duplicateKey)) {
      return `Duplicate node name "${sanitized}" inside "${parentLabel}".`;
    }
    seen.add(duplicateKey);

    if (node.type !== "folder" && node.type !== "file") {
      return "Folder structure nodes must be either folder or file.";
    }

    if (node.children?.length) {
      const childError = validateFolderNodes(node.children, depth + 1, sanitized, counter);
      if (childError) {
        return childError;
      }
    }
  }

  return null;
}

export function FolderCreator() {
  const [structure, setStructure] = useState<FolderNode[]>([
    { id: "root", name: "PROJECT_NAME", type: "folder", children: [] }
  ]);
  const [creating, setCreating] = useState(false);
  const [creatingOnDisk, setCreatingOnDisk] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const projectPath = useMemo(() => {
    return structure[0]?.name || "NOT_SET";
  }, [structure]);

  const getAllFolderIds = useCallback((nodes: FolderNode[], ids: string[] = []) => {
    nodes.forEach(node => {
      if (node.type === "folder") {
        ids.push(node.id);
        if (node.children) getAllFolderIds(node.children, ids);
      }
    });
    return ids;
  }, []);

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle ESC to close menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExportMenuOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const [hasLastStructure, setHasLastStructure] = useState(false);

  // Initialize persistence state
  useEffect(() => {
    setHasLastStructure(!!localStorage.getItem(LAST_STRUCTURE_KEY));
  }, []);

  // Auto-dismiss messages
  useEffect(() => {
    if (statusMessage || errorMessage) {
      const timer = setTimeout(() => {
        setStatusMessage(null);
        setErrorMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage, errorMessage]);

  const mapImportedNodes = useCallback((nodes: any[]): FolderNode[] => {
    return nodes.map(node => ({
      id: Math.random().toString(36).substring(2, 11),
      name: node.name,
      type: node.type as "folder" | "file",
      children: node.children ? mapImportedNodes(node.children) : (node.type === "folder" ? [] : undefined)
    }));
  }, []);

  // Tauri Drag & Drop handling
  useEffect(() => {
    const unlistenDrop = getCurrentWindow().listen<{ paths: string[] }>("tauri://drag-drop", async (event) => {
      setIsDragging(false);
      const paths = event.payload.paths;
      if (paths.length > 0) {
        const folderPath = paths[0];
        try {
          const importedContent: any[] = await invoke("import_folder_structure", { folderPath });
          const folderName = folderPath.split(/[\\\/]/).pop() || "ROOT";
          const newStructure: FolderNode[] = [{
            id: "root",
            name: folderName,
            type: "folder",
            children: mapImportedNodes(importedContent)
          }];
          setStructure(newStructure);
          setStatusMessage(`Imported structure from "${folderName}"`);
        } catch (err) {
          console.error("Import failed", err);
          setErrorMessage(`Failed to import folder structure: ${err}`);
        }
      }
    });

    const unlistenEnter = getCurrentWindow().listen("tauri://drag-enter", () => {
      setIsDragging(true);
    });

    const unlistenOver = getCurrentWindow().listen("tauri://drag-over", () => {
      setIsDragging(true);
    });

    const unlistenLeave = getCurrentWindow().listen("tauri://drag-leave", () => {
      setIsDragging(false);
    });

    return () => {
      unlistenDrop.then(fn => fn());
      unlistenEnter.then(fn => fn());
      unlistenOver.then(fn => fn());
      unlistenLeave.then(fn => fn());
    };
  }, [mapImportedNodes]);

  // Draft persistence (different from "Last Created" feature)
  useEffect(() => {
    const timeout = setTimeout(() => {
      localStorage.setItem("folder_creator_draft_v1", JSON.stringify(structure));
    }, 1000);
    return () => clearTimeout(timeout);
  }, [structure]);

  // Load draft on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem("folder_creator_draft_v1");
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        if (Array.isArray(draft) && draft.length > 0) {
          setStructure(draft);
        }
      } catch (e) {
        console.warn("Failed to load draft", e);
      }
    }
  }, []);

  const resetStructure = useCallback(() => {
    if (window.confirm("Are you sure you want to reset the entire structure? Any unsaved changes will be lost.")) {
      setStructure([{ id: "root", name: "PROJECT_NAME", type: "folder", children: [] }]);
      setErrorMessage(null);
      setStatusMessage(null);
    }
  }, []);

  const saveLastStructure = useCallback((nodes: FolderNode[]) => {
    try {
      localStorage.setItem(LAST_STRUCTURE_KEY, JSON.stringify(nodes));
      setHasLastStructure(true);
    } catch (err) {
      console.warn("Failed to save last structure to localStorage", err);
    }
  }, []);

  const restoreLastStructure = useCallback(() => {
    try {
      const saved = localStorage.getItem(LAST_STRUCTURE_KEY);
      if (saved) {
        const nodes = JSON.parse(saved) as FolderNode[];
        if (Array.isArray(nodes) && nodes.length > 0) {
          setStructure(nodes);
          setErrorMessage(null);
          setStatusMessage("Restored last saved structure.");
        } else {
          setErrorMessage("No valid saved structure found.");
        }
      } else {
        setErrorMessage("No previously saved structure to restore.");
      }
    } catch (err) {
      console.error("Failed to restore structure", err);
      setErrorMessage("Failed to restore the last structure.");
    }
  }, []);

  const handleManualSave = useCallback(() => {
    saveLastStructure(structure);
    setStatusMessage("Current structure saved to memory.");
  }, [structure, saveLastStructure]);

  const addNode = useCallback((parentId: string, type: "folder" | "file") => {
    const updateStructure = (nodes: FolderNode[]): FolderNode[] => {
      return nodes.map(node => {
        if (node.id === parentId) {
          const siblings = node.children || [];
          const newNode: FolderNode = {
            id: Math.random().toString(36).substr(2, 9),
            name: makeUniqueNodeName(type === "folder" ? "new_folder" : "asset_file", siblings),
            type,
            children: type === "folder" ? [] : undefined
          };
          return { ...node, children: [...siblings, newNode] };
        }
        if (node.children) {
          return { ...node, children: updateStructure(node.children) };
        }
        return node;
      });
    };

    setStructure(prev => updateStructure(prev));
  }, []);

  const removeNode = useCallback((id: string) => {
    if (id === "root") return;
    const updateStructure = (nodes: FolderNode[]): FolderNode[] => {
      return nodes.filter(node => node.id !== id).map(node => {
        if (node.children) {
          return { ...node, children: updateStructure(node.children) };
        }
        return node;
      });
    };
    setStructure(prev => updateStructure(prev));
  }, []);

  const updateName = useCallback((id: string, name: string) => {
    const sanitized = sanitizeNodeName(name);
    const updateStructure = (nodes: FolderNode[]): FolderNode[] => {
      return nodes.map(node => {
        if (node.id === id) {
          return { ...node, name: sanitized };
        }
        if (node.children) {
          return { ...node, children: updateStructure(node.children) };
        }
        return node;
      });
    };
    setStructure(prev => updateStructure(prev));
  }, []);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleJSONUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);

        // Recursive function to validate and ensure all nodes have required properties
        let nodeCount = 0;
        const validateStructure = (nodes: any[], depth: number): FolderNode[] => {
          if (!Array.isArray(nodes)) return [];
          if (depth > MAX_STRUCTURE_DEPTH) {
            throw new Error(`Folder structure exceeds the ${MAX_STRUCTURE_DEPTH}-level depth limit.`);
          }
          const seen = new Set<string>();
          return nodes.map((node: any) => {
            nodeCount += 1;
            if (nodeCount > MAX_STRUCTURE_NODES) {
              throw new Error(`Folder structure exceeds the ${MAX_STRUCTURE_NODES} node limit.`);
            }
            const rawName = typeof node.name === "string" ? node.name.trim() : "";
            if (!rawName) {
              throw new Error("Folder structure contains an empty node name.");
            }
            if (rawName.startsWith("/") || rawName.startsWith("\\") || /^[a-zA-Z]:[\\/]/.test(rawName)) {
              throw new Error("Absolute paths are not allowed in imported folder schemas.");
            }
            if (rawName.split(/[\\/]/).some((segment: string) => segment === "..")) {
              throw new Error("Path traversal segments are not allowed in imported folder schemas.");
            }
            const sanitizedName = sanitizeNodeName(rawName);
            const duplicateKey = sanitizedName.toLocaleLowerCase();
            if (seen.has(duplicateKey)) {
              throw new Error(`Duplicate node name "${sanitizedName}" found in imported folder schema.`);
            }
            seen.add(duplicateKey);
            const validNode: FolderNode = {
              id: typeof node.id === 'string' && node.id ? node.id : Math.random().toString(36).substr(2, 9),
              name: sanitizedName,
              type: node.type === "file" ? "file" : "folder",
            };

            if (validNode.type === "folder" && Array.isArray(node.children)) {
              validNode.children = validateStructure(node.children, depth + 1);
            } else if (validNode.type === "folder") {
              validNode.children = [];
            }

            return validNode;
          });
        };

        // Handle both object wrapper and direct array
        let rawData = Array.isArray(json) ? json : (json.structure || json.data || json.children || [json]);
        if (!Array.isArray(rawData)) {
          rawData = [json];
        }

        const newStructure = validateStructure(rawData, 1);
        if (newStructure.length > 0) {
          // If first element isn't root folder, wrap it
          setStructure(newStructure);
          setErrorMessage(null);
          setStatusMessage("JSON structure loaded.");
        } else {
          console.error("No valid structure found in JSON");
          setErrorMessage("No valid folder structure was found in that JSON file.");
        }
      } catch (err) {
        console.error("Failed to parse JSON", err);
        setErrorMessage(err instanceof Error ? err.message : "Could not parse JSON structure.");
      }

      // Reset input so the same file can be uploaded again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  const flattenedPaths = useMemo(() => {
    const paths: string[] = [];
    const traverse = (node: FolderNode, currentPath: string) => {
      const newPath = currentPath ? `${currentPath}/${node.name}` : node.name;
      paths.push(newPath);
      if (node.children) {
        node.children.forEach(child => traverse(child, newPath));
      }
    };
    structure.forEach(node => traverse(node, ""));
    return paths;
  }, [structure]);

  const handleCreate = async () => {
    setCreating(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const validationError = validateFolderNodes(structure);
      if (validationError) {
        setErrorMessage(validationError);
        return;
      }
      const dest = await save({
        filters: [{ name: "ZIP Archive", extensions: ["zip"] }],
        defaultPath: "ProjectStructure.zip"
      });
      if (dest) {
        await invoke("create_folder_zip", { structure, outputPath: dest });
        saveLastStructure(structure);
        setStatusMessage(`ZIP saved to ${dest}`);
      }
    } catch (e) {
      console.error(e);
      setErrorMessage(`ZIP export failed: ${String(e)}`);
    } finally {
      setCreating(false);
    }
  };

  const handleCreateOnDisk = async () => {
    setCreatingOnDisk(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const validationError = validateFolderNodes(structure);
      if (validationError) {
        setErrorMessage(validationError);
        return;
      }
      const dest = await open({
        directory: true,
        multiple: false,
        title: "Choose destination folder"
      });
      if (!dest || typeof dest !== "string") {
        return;
      }
      await invoke("create_folder_structure", { structure, outputRoot: dest });
      saveLastStructure(structure);
      setStatusMessage(`Folder structure created in ${dest}`);
      try {
        await openPath(dest);
      } catch (openErr) {
        console.warn("openPath failed for folder structure output", openErr);
      }
    } catch (e) {
      console.error(e);
      setErrorMessage(`Create on disk failed: ${String(e)}`);
    } finally {
      setCreatingOnDisk(false);
      setExportMenuOpen(false);
    }
  };

  const handleExportJSON = async () => {
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const dest = await save({
        filters: [{ name: "JSON File", extensions: ["json"] }],
        defaultPath: "ProjectStructure.json"
      });
      if (dest) {
        const content = JSON.stringify(structure, null, 2);
        await writeTextFile(dest, content);
        saveLastStructure(structure);
        setStatusMessage(`JSON structure saved to ${dest}`);
      }
    } catch (e) {
      console.error(e);
      setErrorMessage(`JSON export failed: ${String(e)}`);
    } finally {
      setExportMenuOpen(false);
    }
  };

  const renderNode = (node: FolderNode, depth: number = 0) => {
    const hierarchyLabel = node.type === "folder" ? getHierarchyLabel(depth) : null;
    const depthClass =
      depth === 0 ? "depth-main" : depth === 1 ? "depth-primary" : depth === 2 ? "depth-secondary" : "depth-detail";

    return (
      <div key={node.id} className={`folder-node-wrapper ${depthClass}`} style={{ marginLeft: depth > 0 ? 24 : 0 }}>
        <div className={`folder-node-item ${node.id === "root" || depth === 0 ? "root-node" : ""} ${depthClass}`}>
          <div className="folder-node-drag-handle">
            <Hash size={12} opacity={0.3} />
          </div>
          <div className="folder-node-chevron-wrap" onClick={() => node.type === "folder" && toggleCollapse(node.id)}>
            {node.type === "folder" && node.children && node.children.length > 0 && (
              collapsedNodes.has(node.id) ? <ChevronRight size={14} /> : <ChevronDown size={14} />
            )}
          </div>
          <div className={`folder-node-icon ${node.type === "folder" ? "folder-kind" : "file-kind"}`}>
            {node.type === "folder" ? <Folder size={18} fill="currentColor" fillOpacity={0.1} /> : <FileType size={18} />}
          </div>
          <div className="folder-node-content">
            <input
              className="folder-node-input"
              value={node.name}
              onChange={(e) => updateName(node.id, e.target.value)}
              placeholder="Name..."
              spellCheck={false}
            />
          </div>
          {hierarchyLabel && <span className={`folder-node-tier ${depthClass}`}>{hierarchyLabel}</span>}
          <div className="folder-node-actions">
            {node.type === "folder" && (
              <button className="btn-icon-sm" onClick={() => addNode(node.id, "folder")} title="Add Child Folder">
                <Plus size={14} />
              </button>
            )}
            {(node.id !== "root" && depth !== 0) && (
              <button className="btn-icon-sm danger" onClick={() => removeNode(node.id)} title="Remove">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
        {node.children && node.children.length > 0 && !collapsedNodes.has(node.id) && (
          <div className="folder-node-children">
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="folder-creator-container">
      {/* Drag Overlay */}
      {isDragging && (
        <div className="drag-overlay" style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1000,
          background: 'rgba(59, 130, 246, 0.15)',
          backdropFilter: 'blur(8px)',
          border: '2px dashed var(--phase-preproduction)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          animation: 'pulse 2s infinite'
        }}>
          <div style={{
            background: 'rgba(15, 23, 42, 0.95)',
            padding: '32px 48px',
            borderRadius: '24px',
            border: '1px solid rgba(59, 130, 246, 0.4)',
            textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
          }}>
            <UploadCloud size={64} style={{ color: 'var(--phase-preproduction)', margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc', marginBottom: '8px' }}>
              Import Folder Structure
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '1rem' }}>
              Drop folder to rebuild hierarchy automatically
            </p>
          </div>
        </div>
      )}

      <div className="folder-creator-header">
        <div className="header-left">
          <div className="title-block">
            <h2>Project Structure Creator</h2>
          </div>
        </div>

        <div className="header-right">
          <div className="flex items-center gap-3">
            <input
              type="file"
              accept=".json"
              ref={fileInputRef}
              onChange={handleJSONUpload}
              style={{ display: 'none' }}
            />
            
            <button
              className="btn btn-secondary btn-glass"
              onClick={() => fileInputRef.current?.click()}
              title="Import structure from JSON"
            >
              <FileJson size={16} />
              <span>Import JSON</span>
            </button>

            <button
              className="btn btn-secondary btn-glass"
              onClick={async () => {
                try {
                  const selected = await open({
                    directory: true,
                    multiple: false,
                    title: "Select Folder to Import Structure"
                  });
                  if (selected && typeof selected === 'string') {
                    const importedContent: any[] = await invoke("import_folder_structure", { folderPath: selected });
                    const folderName = selected.split(/[\\\/]/).pop() || "ROOT";
                    const newStructure: FolderNode[] = [{
                      id: "root",
                      name: folderName,
                      type: "folder",
                      children: mapImportedNodes(importedContent)
                    }];
                    setStructure(newStructure);
                    setStatusMessage(`Imported structure from "${folderName}"`);
                  }
                } catch (err) {
                  setErrorMessage(`Failed to import folder: ${err}`);
                }
              }}
              title="Import from Local Folder"
            >
              <HardDrive size={16} />
              <span>Import Folder</span>
            </button>

            <button
              className="btn btn-secondary btn-glass"
              onClick={handleManualSave}
              title="Save current structure to memory"
            >
              <Save size={16} />
              <span>Save</span>
            </button>

            <button
              className="btn btn-secondary btn-glass"
              onClick={restoreLastStructure}
              disabled={!hasLastStructure}
              title="Restore last exported or saved structure"
            >
              <History size={16} />
              <span>Restore</span>
            </button>

            <div className="vertical-divider" />

            {/* Consolidated Export Button */}
            <div className="relative" ref={exportMenuRef}>
              <button
                className="btn btn-primary btn-glow"
                onClick={() => setExportMenuOpen(!exportMenuOpen)}
                disabled={creating || creatingOnDisk}
              >
                {creating || creatingOnDisk ? <div className="spinner-sm" /> : <Download size={16} />}
                <span>Export</span>
                <ChevronDown size={14} className={`transition-transform duration-200 ${exportMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {exportMenuOpen && (
                <div className="export-menu">
                  <button
                    className="menu-item"
                    onClick={() => { handleCreate(); setExportMenuOpen(false); }}
                  >
                    <Archive size={16} className="text-white/40" />
                    <div className="menu-item-text">
                      <span className="menu-item-title">Structure (ZIP)</span>
                      <span className="menu-item-desc">Download as ZIP archive</span>
                    </div>
                  </button>
                  <button
                    className="menu-item"
                    onClick={handleExportJSON}
                  >
                    <FileJson size={16} className="text-white/40" />
                    <div className="menu-item-text">
                      <span className="menu-item-title">JSON Schema</span>
                      <span className="menu-item-desc">Export as schema file</span>
                    </div>
                  </button>
                  <div className="menu-divider" />
                  <button
                    className="menu-item"
                    onClick={handleCreateOnDisk}
                  >
                    <HardDrive size={16} className="text-blue-400" />
                    <div className="menu-item-text">
                      <span className="menu-item-title text-white">Create on disk</span>
                      <span className="menu-item-desc">Generate folders locally</span>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <button
              className="btn btn-icon-only btn-secondary btn-glass"
              onClick={resetStructure}
              title="Reset structure"
            >
              <RotateCcw size={18} />
            </button>
          </div>
        </div>
      </div>

      {(statusMessage || errorMessage) && (
        <div className={`folder-creator-status ${errorMessage ? "error" : "success"}`} style={{
          background: errorMessage ? "rgba(239, 68, 68, 0.1)" : "rgba(125, 211, 252, 0.05)",
          border: `1px solid ${errorMessage ? "rgba(239, 68, 68, 0.2)" : "rgba(125, 211, 252, 0.1)"}`,
          color: errorMessage ? "var(--status-red)" : "var(--phase-preproduction)",
          marginBottom: '18px',
          padding: '12px 14px',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.92rem'
        }}>
          {errorMessage || statusMessage}
        </div>
      )}

      <div className="folder-creator-workspace">
        <div className="workspace-section segment">
          <div className="builder-header">
            <div className="header-meta">
              <div className="section-title">
                <FolderTree size={14} className="text-blue-400/60" />
                <span>STRUCTURE BUILDER</span>
              </div>
              <div className="header-actions">
                <button
                  className="action-link"
                  onClick={() => setCollapsedNodes(new Set(getAllFolderIds(structure)))}
                >
                  Collapse All
                </button>
                <div className="divider" />
                <button
                  className="action-link"
                  onClick={() => setCollapsedNodes(new Set())}
                >
                  Expand All
                </button>
              </div>
            </div>
            <div className="metadata-row">
              <Hash size={12} className="text-white/20" />
              <span className="metadata-label">PROJECT PATH:</span>
              <span className="metadata-value">{projectPath || "/not-set"}</span>
            </div>
          </div>
          <div className="visual-preview premium-scroll" style={{ background: "rgba(0,0,0,0.2)", border: "var(--inspector-border)", borderRadius: "var(--radius-md)" }}>
            {structure.map(node => renderNode(node))}
          </div>
        </div>

        <div className="workspace-section segment">
          <div className="segment-header">
            <ChevronRight size={16} />
            <span style={{ fontSize: "var(--inspector-label-size)", fontWeight: "var(--inspector-label-weight)", letterSpacing: "var(--inspector-label-spacing)", color: "var(--inspector-label-color)", textTransform: "uppercase" }}>Structure Review</span>
          </div>
          <div className="path-preview premium-scroll" style={{ background: "rgba(0,0,0,0.2)", border: "var(--inspector-border)", borderRadius: "var(--radius-md)" }}>
            <div className="path-list">
              {flattenedPaths.map((path, idx) => (
                <div key={idx} className="path-item" style={{ animationDelay: `${idx * 0.05}s` }}>
                  <span className="path-index">{(idx + 1).toString().padStart(2, '0')}</span>
                  <span className="path-string">{path}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .folder-creator-container {
          padding: 32px;
          background: var(--inspector-bg);
          backdrop-filter: var(--inspector-glass-blur);
          border-radius: var(--radius-lg);
          border: var(--inspector-border);
          color: var(--text-primary);
          animation: fadeInFolderCreator 0.36s ease;
          box-shadow: var(--shadow-lg);
          height: calc(100vh - 180px);
          display: flex;
          flex-direction: column;
          position: relative;
        }

        @keyframes fadeInFolderCreator {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .folder-creator-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 24px;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 24px;
        }


        .folder-creator-header h2 {
          margin: 0;
          font-size: 2rem;
          font-weight: 600;
          letter-spacing: -0.01em;
          line-height: 1.05;
          color: #fff;
        }

        .folder-creator-header .description {
          margin: 0;
          color: var(--text-muted);
          font-size: 0.9rem;
          max-width: 320px;
          line-height: 1.4;
          font-weight: 400;
          padding-left: 24px;
          margin-left: 10px;
          border-left: 1px solid rgba(255, 255, 255, 0.08);
          align-self: flex-end;
          padding-bottom: 2px;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .folder-creator-workspace {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 24px;
          flex: 1;
          min-height: 0;
        }
        .folder-creator-status {
          margin-bottom: 18px;
          padding: 12px 14px;
          border-radius: var(--radius-md);
          font-size: 0.92rem;
        }

        .workspace-section {
            display: flex;
            flex-direction: column;
            min-height: 0;
        }

        .segment-header {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 0 4px 12px;
            opacity: 0.8;
        }

        .visual-preview, .path-preview {
          padding: 24px;
          overflow-y: auto;
          flex: 1;
        }

        .folder-node-wrapper {
          position: relative;
        }

        .folder-node-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          background: rgba(255,255,255,0.02);
          border-radius: var(--radius-md);
          margin-bottom: 6px;
          border: 1px solid rgba(255,255,255,0.03);
          transition: all 0.18s ease;
          animation: nodeFade 0.24s ease;
        }

        .root-node {
            background: var(--phase-preproduction-soft);
            border-color: var(--phase-preproduction-glow);
        }

        @keyframes nodeFade {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .folder-node-item:hover {
          background: rgba(255,255,255,0.05);
          border-color: rgba(255,255,255,0.1);
        }

        .folder-node-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          flex: 0 0 18px;
        }

        .folder-node-icon.folder-kind {
          color: var(--phase-preproduction);
        }

        .depth-primary .folder-node-icon.folder-kind {
          color: #3b82f6; /* More distinct medium blue */
        }

        .depth-secondary .folder-node-icon.folder-kind {
          color: #4f46e5; /* More distinct indigo-blue for secondary levels */
        }

        .folder-node-icon.file-kind {
          color: var(--text-muted);
        }

        .folder-node-content {
          flex: 1;
          min-width: 0;
        }

        .folder-node-title-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .folder-node-input {
          background: transparent;
          border: none;
          color: var(--text-primary);
          font-size: 0.9rem;
          font-weight: 500;
          flex: 1;
          outline: none;
          min-width: 0;
        }

        .folder-node-tier {
          padding: 2px 8px;
          border-radius: var(--radius-full);
          border: 1px solid rgba(255,255,255,0.05);
          background: rgba(255,255,255,0.03);
          color: var(--text-muted);
          font-size: var(--inspector-label-size);
          font-weight: var(--inspector-label-weight);
          letter-spacing: var(--inspector-label-spacing);
          text-transform: uppercase;
          white-space: nowrap;
        }

        .folder-node-tier.depth-primary {
          opacity: 0.8;
        }

        .folder-node-tier.depth-secondary {
          opacity: 0.6;
        }

        .folder-node-tier.depth-detail {
          display: none;
        }

        .folder-node-actions {
          display: flex;
          gap: 6px;
          opacity: 0;
          transition: all 0.2s ease;
        }

        .folder-node-item:hover .folder-node-actions {
          opacity: 1;
        }

        .folder-node-children {
          position: relative;
          border-left: 1px solid rgba(255,255,255,0.03);
          margin-left: 10px;
          padding-left: 12px;
        }

        .btn-glow:hover {
            box-shadow: 0 0 20px var(--phase-preproduction-glow);
        }

        .btn-glass {
            background: rgba(255,255,255,0.02);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.04);
        }

        .export-menu {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          width: 240px;
          background: #1a1a1f;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: var(--radius-md);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
          z-index: 1000;
          overflow: hidden;
          animation: menuSlideDown 0.2s ease;
        }

        @keyframes menuSlideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .menu-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 12px 16px;
          background: transparent;
          border: none;
          text-align: left;
          cursor: pointer;
          transition: background 0.2s;
        }

        .menu-item:hover {
          background: rgba(255, 255, 255, 0.03);
        }

        .menu-item-text {
          display: flex;
          flex-direction: column;
        }

        .menu-item-title {
          font-size: 0.85rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
        }

        .menu-item-desc {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .menu-divider {
          height: 1px;
          background: rgba(255, 255, 255, 0.05);
          margin: 4px 0;
        }

        .builder-header {
          padding: 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .header-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .action-link {
          background: none;
          border: none;
          color: var(--text-muted);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          cursor: pointer;
          transition: color 0.2s;
        }

        .action-link:hover {
          color: var(--phase-preproduction);
        }

        .divider {
          width: 1px;
          height: 10px;
          background: rgba(255, 255, 255, 0.1);
        }

        .section-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.15em;
          color: var(--text-muted);
          text-transform: uppercase;
        }

        .metadata-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .metadata-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.05em;
          color: var(--text-muted);
          text-transform: uppercase;
        }

        .metadata-value {
          font-size: 10px;
          font-weight: 500;
          color: var(--text-primary);
          opacity: 0.8;
        }

        .path-list {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }

        .path-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 6px 10px;
            border-radius: 4px;
            font-size: 0.8rem;
            animation: fadeInPath 0.3s ease forwards;
            opacity: 0;
            background: rgba(255,255,255,0.01);
        }

        @keyframes fadeInPath {
            to { opacity: 1; }
        }

        .path-index {
            opacity: 0.2;
            font-size: 10px;
            font-weight: 900;
        }

        .path-string {
            opacity: 0.6;
            letter-spacing: 0.02em;
        }

        .premium-scroll::-webkit-scrollbar {
            width: 4px;
        }
        .premium-scroll::-webkit-scrollbar-thumb {
            background: rgba(255,255,255,0.05);
            border-radius: 10px;
        }

        .spinner-sm {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(0, 0, 0, 0.1);
          border-top: 2px solid currentColor;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* Collapsible Styles */
        .folder-node-chevron-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          cursor: pointer;
          color: var(--text-muted);
          transition: color 0.2s;
          border-radius: 4px;
        }

        .folder-node-chevron-wrap:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.05);
        }

        @media (max-width: 1200px) {
          .folder-creator-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 32px;
          }
          .header-left-cluster {
             width: 100%;
             gap: 20px;
             flex-wrap: wrap;
          }
          .folder-creator-header h2 {
            font-size: 3rem;
          }
          .header-right-tools {
            width: 100%;
            justify-content: flex-start;
          }
        }

        @media (max-width: 600px) {
          .folder-creator-header h2 {
            font-size: 2.2rem;
          }
          .header-description {
            border-left: none;
            padding-left: 0;
            max-width: 100%;
          }
          .header-left-cluster {
            gap: 24px;
          }
        }
      `}</style>
    </div>
  );
}
