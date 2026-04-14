import { useState, useCallback, useEffect, useRef } from "react";
import type { ChangeEvent } from "react";
import type { WrappedSave } from "@/lib/saveTypes";
import { cloneSave, type SaveMergePanelRef } from "@/lib/mergeSaveDrafts";
import {
  fetchEditorConfig,
  listSaves,
  loadSave,
  saveSave,
  createBackup,
  restoreBackup,
  unpackPlrFile,
  repackSaveToBlob,
} from "@/lib/api";
import type { SaveFileInfo } from "@/lib/api";
import PlayerPanel from "@/components/PlayerPanel";
import InventoryPanel from "@/components/InventoryPanel";
import PetsPanel from "@/components/PetsPanel";
import EquipmentPanel from "@/components/EquipmentPanel";
import {
  Download,
  Save,
  Sword,
  Package,
  Zap,
  Shield,
  AlertCircle,
  Bird,
  FolderOpen,
  RefreshCw,
  HardDrive,
  Clock,
  Archive,
  RotateCcw,
  Loader2,
  Upload,
  X,
  Info,
  Copy,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  readEditorSession,
  writeEditorSession,
  clearEditorSession,
} from "@/lib/editorSession";
import {
  pickPlrFile,
   SMALLAND_WINDOWS_SAVE_FOLDER,
} from "@/lib/plrFilePicker";
import { toast } from "sonner";

type Tab = "player" | "inventory" | "equipment" | "pets";

/** Restore editor after F5 — same-tab session only (see persist below). */
const SESSION_BOOT = (() => {
  const s = readEditorSession();
  if (!s)
    return {
      save: null as WrappedSave | null,
      filename: "",
      fileEpoch: 0,
      fromSession: false as const,
    };
  return {
    save: s.save,
    filename: s.filename,
    fileEpoch: 1,
    fromSession: true as const,
  };
})();

export default function App() {
  const [save, setSave] = useState<WrappedSave | null>(SESSION_BOOT.save);
  const [filename, setFilename] = useState<string>(SESSION_BOOT.filename);
  const [activeTab, setActiveTab] = useState<Tab>("player");
  const [saveFiles, setSaveFiles] = useState<SaveFileInfo[]>([]);
  /** True when the Go server has a save folder (Windows auto path, or SMALLAND_SAVE_DIR, or not SMALLAND_UPLOAD_ONLY). */
  const [serverSaveAvailable, setServerSaveAvailable] = useState(false);
  /** Absolute path from GET /api/config (server reads/writes here). */
  const [serverSavePath, setServerSavePath] = useState("");
  const [saveDirSource, setSaveDirSource] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [downloadingPlr, setDownloadingPlr] = useState(false);
  const plrInputRef = useRef<HTMLInputElement>(null);
  const [fileEpoch, setFileEpoch] = useState(SESSION_BOOT.fileEpoch);
  /** Slide-over menu (mobile / narrow screens). */
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const playerPanelRef = useRef<SaveMergePanelRef>(null);
  const inventoryPanelRef = useRef<SaveMergePanelRef>(null);
  const equipmentPanelRef = useRef<SaveMergePanelRef>(null);
  const petsPanelRef = useRef<SaveMergePanelRef>(null);

  const bumpDraftEpoch = useCallback(() => {
    setFileEpoch((e) => e + 1);
  }, []);

  const mergePanelDraftsInto = useCallback((base: WrappedSave) => {
    let merged = cloneSave(base);
    merged = petsPanelRef.current?.mergeInto(merged) ?? merged;
    merged = inventoryPanelRef.current?.mergeInto(merged) ?? merged;
    merged = equipmentPanelRef.current?.mergeInto(merged) ?? merged;
    merged = playerPanelRef.current?.mergeInto(merged) ?? merged;
    return merged;
  }, []);

  const persistEditorSession = useCallback(() => {
    if (!save || !filename) return;
    try {
      writeEditorSession(filename, mergePanelDraftsInto(save));
    } catch (e) {
      console.warn("persistEditorSession", e);
    }
  }, [save, filename, mergePanelDraftsInto]);

  const restoreToastShown = useRef(false);
  useEffect(() => {
    if (!SESSION_BOOT.fromSession || restoreToastShown.current) return;
    restoreToastShown.current = true;
    toast.message(
      "\u0e01\u0e39\u0e49\u0e04\u0e37\u0e19\u0e01\u0e32\u0e23\u0e41\u0e01\u0e49\u0e44\u0e02\u0e2b\u0e25\u0e31\u0e07\u0e23\u0e35\u0e40\u0e1f\u0e23\u0e0a",
      {
        description: SESSION_BOOT.filename,
      },
    );
  }, []);

  useEffect(() => {
    if (!save || !filename) return;
    const t = window.setTimeout(() => persistEditorSession(), 400);
    const id = window.setInterval(persistEditorSession, 2000);
    return () => {
      window.clearTimeout(t);
      window.clearInterval(id);
    };
  }, [save, filename, persistEditorSession]);

  useEffect(() => {
    const onHide = () => persistEditorSession();
    window.addEventListener("pagehide", onHide);
    const onVis = () => {
      if (document.visibilityState === "hidden") persistEditorSession();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [persistEditorSession]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const cfg = await fetchEditorConfig();
        setServerSaveAvailable(cfg.serverSaveAvailable);
        setServerSavePath(cfg.saveDirectory ?? "");
        setSaveDirSource(cfg.saveDirectorySource);
        const files = await listSaves();
        setSaveFiles(files);
      } catch {
        setError(
          "Cannot connect to backend. Make sure the server is running on port 3000.",
        );
        setSaveFiles([]);
      }
    })();
  }, []);

  const pathShown =
    serverSavePath.length > 0
      ? serverSavePath
      : SMALLAND_WINDOWS_SAVE_FOLDER;

  const refreshFileList = async () => {
    try {
      const files = await listSaves();
      setSaveFiles(files);
    } catch {
      setError(
        "Cannot connect to backend. Make sure the server is running on port 3000.",
      );
    }
  };

  const handleLoadFile = useCallback(async (name: string) => {
    setLoading(true);
    setError("");
    try {
      const json = await loadSave(name);
      if (!json._meta || !json.data)
        throw new Error("Invalid save file format");
      setSave(json as WrappedSave);
      setFilename(name);
      setFileEpoch((e) => e + 1);
      setShowFilePicker(false);
    } catch (err) {
      setError("Failed to load: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPlrFromFile = useCallback(async (file: File) => {
    setLoading(true);
    setError("");
    try {
      const json = await unpackPlrFile(file);
      const o = json as Record<string, unknown>;
      if (!o._meta || !o.data) throw new Error("Invalid save file format");
      setSave(json as WrappedSave);
      setFilename(file.name);
      setFileEpoch((e) => e + 1);
      setShowFilePicker(false);
    } catch (err) {
      setError("Failed to load file: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLocalPlrChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      await loadPlrFromFile(file);
    },
    [loadPlrFromFile],
  );

  const handleChoosePlrClick = useCallback(async () => {
    const r = await pickPlrFile();
    if (r.kind === "file") {
      await loadPlrFromFile(r.file);
      return;
    }
    if (r.kind === "unsupported") {
      plrInputRef.current?.click();
    }
  }, [loadPlrFromFile]);

  const handleCopySaveFolderPath = useCallback(async () => {
    const text =
      serverSavePath.length > 0 ? serverSavePath : SMALLAND_WINDOWS_SAVE_FOLDER;
    try {
      await navigator.clipboard.writeText(text);
      toast.success(
        "Copied path — paste into File Explorer address bar (Windows)",
      );
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }, [serverSavePath]);

  const handleCloseFile = useCallback(() => {
    clearEditorSession();
    setSave(null);
    setFilename("");
    setFileEpoch(0);
    setActiveTab("player");
    setError("");
    setSidebarOpen(false);
  }, []);

  const handleDownloadPlr = useCallback(async () => {
    if (!save) return;
    setDownloadingPlr(true);
    setError("");
    try {
      const name =
        filename && filename.toLowerCase().endsWith(".plr")
          ? filename
          : `${filename || "save"}.plr`;
      const blob = await repackSaveToBlob(mergePanelDraftsInto(save), name);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError("Download .plr failed: " + (err as Error).message);
    } finally {
      setDownloadingPlr(false);
    }
  }, [save, filename, mergePanelDraftsInto]);

  const handleSave = useCallback(async () => {
    if (!save || !filename) return;
    setSaving(true);
    setError("");
    try {
      const merged = mergePanelDraftsInto(save);
      const savedLabel = filename;

      if (!serverSaveAvailable) {
        const name = filename.toLowerCase().endsWith(".plr")
          ? filename
          : `${filename || "save"}.plr`;
        const blob = await repackSaveToBlob(merged, name);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
        setSave(merged);
        writeEditorSession(name, merged);
        toast.success("Downloaded .plr — copy into your Smalland save folder", {
          description: name,
        });
        return;
      }

      await saveSave(filename, merged);
      toast.success(
        "\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e44\u0e1f\u0e25\u0e4c\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08",
        { description: savedLabel },
      );
      clearEditorSession();
      setSave(null);
      setFilename("");
      setFileEpoch(0);
      setActiveTab("player");
    } catch (err) {
      const msg = (err as Error).message;
      toast.error(
        "\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08",
        { description: msg },
      );
      setError("Failed to save: " + msg);
    } finally {
      setSaving(false);
    }
  }, [save, filename, serverSaveAvailable, mergePanelDraftsInto]);

  const handleBackup = useCallback(async () => {
    if (!filename) return;
    try {
      await createBackup(filename);
      refreshFileList();
    } catch (err) {
      setError("Backup failed: " + (err as Error).message);
    }
  }, [filename]);

  const handleRestore = useCallback(async () => {
    if (!filename) return;
    try {
      await restoreBackup(filename);
      // Reload the restored file
      await handleLoadFile(filename);
    } catch (err) {
      setError("Restore failed: " + (err as Error).message);
    }
  }, [filename, handleLoadFile]);

  const handleExportJson = useCallback(() => {
    if (!save) return;
    const blob = new Blob([JSON.stringify(save, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename ? filename + ".json" : "save.plr.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [save, filename]);

  const tabs: {
    id: Tab;
    label: string;
    icon: React.ReactNode;
    desc: string;
  }[] = [
    {
      id: "player",
      label: "Player",
      icon: <Zap size={14} />,
      desc: "Stats & info",
    },
    {
      id: "inventory",
      label: "Inventory",
      icon: <Package size={14} />,
      desc: "Items & loot",
    },
    {
      id: "equipment",
      label: "Equipment",
      icon: <Shield size={14} />,
      desc: "Gear slots",
    },
    {
      id: "pets",
      label: "Companions",
      icon: <Bird size={14} />,
      desc: "Pets & mounts",
    },
  ];

  const progId = save
    ? String(save.data.Preserialize.PlayerProgression?.Id ?? "")
    : "";
  const progLevel =
    save && progId && save.data.Serialize[progId]
      ? ((save.data.Serialize[progId] as { Level?: number }).Level ?? "?")
      : "?";

  const currentBackup = saveFiles.find((f) => f.name === filename)?.hasBackup;

  return (
    <div className="min-h-screen bg-[#f6f8fc]">
      <input
        ref={plrInputRef}
        type="file"
        accept=".plr,.PLR"
        className="sr-only"
        aria-hidden
        onChange={handleLocalPlrChange}
      />
      <div className="flex max-w-[1680px] mx-auto min-h-screen">
        {/* Mobile drawer backdrop */}
        {sidebarOpen && (
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40 bg-black/45 animate-in fade-in duration-200 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ── SIDEBAR — desktop sticky / mobile slide-over ───────────────── */}
        <aside
          className={cn(
            "relative flex h-screen max-h-dvh w-[272px] max-w-[min(272px,88vw)] shrink-0 flex-col gap-3.5 overflow-hidden border-r border-white/6",
            "bg-[linear-gradient(165deg,rgba(94,234,212,0.06),transparent_42%),linear-gradient(180deg,#0d1218,#0b0f14)]",
            "px-[18px] py-[22px]",
            "fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-out lg:sticky lg:z-auto",
            "-translate-x-full lg:translate-x-0",
            sidebarOpen && "translate-x-0",
          )}
        >
          <button
            type="button"
            className="absolute right-2.5 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-100 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} strokeWidth={2.25} />
          </button>
          <div className="flex shrink-0 flex-col gap-2.5 px-0.5 pb-3.5 pt-0.5">
            <img
              src="/smalland-logo.png"
              alt="Smalland: Survive the Wilds"
              className="mx-auto h-auto w-full max-w-[220px] object-contain opacity-95 drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)]"
              width={400}
              height={120}
              decoding="async"
            />
            <div className="text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400/50">
              Save editor
            </div>
          </div>

          <div className="mx-0.5 h-px shrink-0 bg-white/6" />

          <div
            className={cn(
              "flex shrink-0 items-center gap-[11px] rounded-[14px] border px-3 py-2.5 transition-colors",
              save
                ? "border-white/6 bg-white/4 hover:bg-white/[0.07]"
                : "justify-center border-dashed border-white/8 bg-transparent",
            )}
          >
            {save ? (
              <>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-teal-300/25 bg-teal-400/10 text-sm font-extrabold text-teal-300">
                  {save.data.PlayerName?.charAt(0).toUpperCase() || "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className="truncate text-[13px] font-semibold text-slate-100"
                    title={filename}
                  >
                    {filename}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-slate-400/80">
                    <span>Lv {progLevel}</span>
                    <span
                      className="inline-block h-1 w-1 shrink-0 rounded-full bg-slate-500/60"
                      aria-hidden
                    />
                    <span>
                      {save.data.TimeSaved?.slice(0, 10).replace(/-/g, "/")}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center gap-1.5 text-[12px] font-medium text-slate-500/90">
                <HardDrive size={14} className="opacity-50" />
                No file loaded
              </div>
            )}
          </div>

          {save && (
            <button
              type="button"
              onClick={handleCloseFile}
              className="flex w-full shrink-0 items-center justify-center gap-2 rounded-[10px] border border-white/10 bg-white/4 py-2.5 text-xs font-semibold text-slate-300 transition-colors hover:border-red-400/35 hover:bg-red-500/15 hover:text-red-100"
            >
              <X size={14} strokeWidth={2.25} />
              Close file
            </button>
          )}

          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-0.5 overflow-hidden">
            <div className="shrink-0 px-2 pb-0 pt-1 text-[9.5px] font-bold uppercase tracking-wide text-slate-400/50">
              Navigation
            </div>
            <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain flex flex-col gap-0.5 pr-0.5">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  disabled={!save}
                  className={cn(
                    "relative flex w-full shrink-0 items-center gap-2.5 rounded-[10px] border border-transparent px-3 py-2 text-left text-[13px] font-medium transition-all",
                    "disabled:cursor-not-allowed disabled:opacity-35",
                    activeTab === tab.id && save
                      ? "border-white/6 bg-white/4 font-semibold text-slate-100 shadow-[inset_3px_0_0_#5eead4,inset_0_0_0_1px_rgba(255,255,255,0.04)]"
                      : "text-slate-400/80 hover:bg-white/4 hover:text-slate-100",
                  )}
                  onClick={() => {
                    if (!save) return;
                    setActiveTab(tab.id);
                    setSidebarOpen(false);
                  }}
                >
                  <span className="flex shrink-0 text-slate-400 [&>svg]:opacity-90">
                    {tab.icon}
                  </span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="mx-0.5 h-px shrink-0 bg-white/6" />

          <div className="flex shrink-0 flex-col gap-[7px]">
            <button
              type="button"
              onClick={() => {
                setShowFilePicker(true);
                setSidebarOpen(false);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-white/6 bg-white/4 py-2.5 text-xs font-semibold text-slate-400/80 transition-colors hover:bg-white/[0.07] hover:text-slate-100"
            >
              <FolderOpen size={14} />
              Open Save File
            </button>
            {save && (
              <>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex w-full items-center justify-center gap-2 rounded-[10px] py-2.5 text-xs font-semibold transition-all disabled:opacity-50 bg-linear-to-br from-teal-300 to-teal-600 text-teal-950 shadow-[0_4px_14px_rgba(20,184,166,0.25)] hover:brightness-105"
                >
                  {saving ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Save size={14} />
                  )}
                  {saving
                    ? "Saving…"
                    : serverSaveAvailable
                      ? "Save to File"
                      : "Save (download .plr)"}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPlr}
                  disabled={downloadingPlr}
                  className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-white/6 bg-transparent py-2.5 text-xs font-semibold text-slate-400/70 transition-colors hover:border-white/10 hover:bg-white/4 hover:text-slate-100 disabled:opacity-50"
                >
                  {downloadingPlr ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Download size={14} />
                  )}
                  Download .plr
                </button>
                <button
                  type="button"
                  onClick={handleExportJson}
                  className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-white/6 bg-transparent py-2.5 text-xs font-semibold text-slate-400/70 transition-colors hover:border-white/10 hover:bg-white/4 hover:text-slate-100"
                >
                  <Download size={14} />
                  Export JSON
                </button>
              </>
            )}
          </div>
        </aside>

        {/* ── MAIN — bento layout ───────────────────────── */}
        <main
          className={cn(
            "flex-1 min-w-0 overflow-auto p-4 md:p-7",
            save && "pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] lg:pb-7",
          )}
        >
          <header className="sticky top-0 z-30 -mx-4 mb-3 flex items-center gap-2 border-b border-slate-200/90 bg-[#f6f8fc]/95 px-3 py-2.5 backdrop-blur-md md:-mx-7 md:px-6 lg:hidden">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-700 shadow-sm active:scale-[0.98]"
              aria-label="Open menu"
            >
              <Menu size={20} strokeWidth={2.25} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">
                {save ? filename || "Loaded save" : "Smalland Save Editor"}
              </p>
              {save ? (
                <p className="truncate text-[11px] text-slate-500">
                  {save.data.PlayerName} · Lv {progLevel}
                </p>
              ) : (
                <p className="text-[11px] text-slate-500">
                  Tap menu for files &amp; actions
                </p>
              )}
            </div>
          </header>

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 mb-3 md:mb-4 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-2xl">
              <AlertCircle size={15} />
              {error}
              <button
                onClick={() => setError("")}
                className="ml-auto text-red-400 hover:text-red-600"
              >
                &times;
              </button>
            </div>
          )}

          {/* ── File Picker Modal ── */}
          {showFilePicker && (
            <div
              className="fixed inset-0 z-100 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center"
              onClick={() => setShowFilePicker(false)}
            >
              <div
                className="max-h-[min(92dvh,920px)] w-full max-w-lg overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:mx-4 sm:rounded-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-4 py-4 border-b border-gray-100 sm:px-6 sm:py-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold text-gray-900">
                        Open Save File
                      </h2>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {serverSaveAvailable
                          ? "Open a save from the list below (server reads your PC folder), or pick any .plr from disk."
                          : "Upload your .plr from the PC where you play Smalland (this server is in upload-only mode)."}
                      </p>
                    </div>
                    {serverSaveAvailable && (
                      <button
                        type="button"
                        onClick={refreshFileList}
                        className="shrink-0 p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                        title="Refresh"
                      >
                        <RefreshCw size={16} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="px-4 py-3 border-b border-gray-100 bg-slate-50/90 space-y-3 sm:px-5">
                  <div>
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                      {serverSaveAvailable ? "Save folder (this PC)" : "Default folder (Windows)"}
                    </p>
                    <p className="text-xs text-slate-600 break-all font-mono bg-white/80 rounded-lg px-2.5 py-2 border border-slate-200/80">
                      {pathShown}
                    </p>
                    {serverSaveAvailable && saveDirSource === "windows_default" && (
                      <p className="text-[11px] text-teal-700 mt-1.5 font-medium">
                        Auto: same as %LOCALAPPDATA%\SMALLAND\Saved\SaveGames\Players — no env vars needed for local runs.
                      </p>
                    )}
                    <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">
                      Paste the path into File Explorer&apos;s address bar to
                      open the folder, or click <strong>Choose file</strong>{" "}
                      below — the <em>Windows</em> file picker can select{" "}
                      <code className="font-mono text-[10px]">.plr</code> files
                      there (in-page browser pickers often block this folder).
                    </p>
                    <button
                      type="button"
                      onClick={handleCopySaveFolderPath}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-900"
                    >
                      <Copy size={13} />
                      Copy path
                    </button>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Choose file
                    </p>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => void handleChoosePlrClick()}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-teal-50 hover:border-teal-200 hover:text-teal-900 transition-colors disabled:opacity-50"
                    >
                      <Upload size={16} />
                      Choose .plr on this PC
                    </button>
                  </div>
                </div>
                {serverSaveAvailable && (
                  <>
                    <div className="px-4 py-2 border-b border-gray-100 bg-white flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                        Smalland save folder
                      </span>
                      {loading && (
                        <Loader2
                          size={14}
                          className="animate-spin text-teal-600"
                        />
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto p-2">
                      {saveFiles.length === 0 ? (
                        <div className="py-12 text-center text-gray-400">
                          <HardDrive
                            size={32}
                            className="mx-auto mb-2 opacity-40"
                          />
                          <p>No .plr files found</p>
                          <p className="text-xs mt-1">
                            Check your save directory
                          </p>
                        </div>
                      ) : (
                        saveFiles.map((f) => (
                          <button
                            key={f.name}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all hover:bg-teal-50 group ${filename === f.name ? "bg-teal-50 ring-1 ring-teal-200" : ""}`}
                            onClick={() => handleLoadFile(f.name)}
                            disabled={loading}
                          >
                            <div className="w-10 h-10 rounded-lg bg-linear-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                              {f.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 truncate text-sm">
                                {f.name}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                                <Clock size={10} />
                                <span>
                                  {new Date(f.modifiedAt).toLocaleString()}
                                </span>
                                <span className="text-gray-300">|</span>
                                <span>{(f.size / 1024).toFixed(1)} KB</span>
                              </div>
                            </div>
                            {f.hasBackup && (
                              <span className="px-2 py-0.5 text-[10px] font-medium text-emerald-600 bg-emerald-50 rounded-full">
                                backup
                              </span>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                    <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-[10px] text-gray-400 sm:px-6 sm:text-xs break-all">
                      Reading from: {pathShown}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {!save ? (
            /* ── Welcome — bento grid ── */
            <div className="mx-auto flex w-full max-w-5xl min-h-[calc(100vh-8rem)] flex-col justify-center gap-3.5 md:gap-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:grid-rows-2 md:gap-4">
                <section className="flex min-h-[280px] flex-col justify-between rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-[box-shadow,border-color] hover:border-emerald-200/80 hover:shadow-md md:col-span-7 md:row-span-2 md:min-h-0 md:p-9">
                  <div>
                    <div className="w-16 h-16 md:w-20 md:h-20 mb-5 rounded-2xl bg-linear-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-200/50">
                      <Sword size={36} className="text-white" />
                    </div>
                    <p className="text-xs font-semibold text-teal-600 tracking-widest uppercase mb-2">
                      Smalland Server Tools
                    </p>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
                      Save Editor
                    </h1>
                    <p className="text-gray-500 text-sm md:text-base leading-relaxed max-w-md">
                      Edit your Smalland save files directly. Modify player
                      stats, inventory, equipment, and companions
                      {serverSaveAvailable
                        ? " with automatic backup when saving to the local save folder."
                        : " — on this host you upload a .plr and download it when done."}
                    </p>
                    <div className="mt-4 flex gap-3 rounded-xl border border-amber-200/90 bg-amber-50/90 px-3.5 py-3 text-sm text-amber-950/90 max-w-lg">
                      <Info
                        size={18}
                        className="shrink-0 text-amber-600 mt-0.5"
                        aria-hidden
                      />
                      <p className="leading-snug text-[13px]">
                        <span className="font-semibold text-amber-900">
                          Before you open a save here:
                        </span>{" "}
                        leave your in-game session first—for example return to
                        the <strong>main menu</strong>—so your{" "}
                        <code className="rounded bg-amber-100/80 px-1 py-0.5 text-[11px] font-mono text-amber-900">
                          .plr
                        </code>{" "}
                        file is not locked. You do <strong>not</strong> need to
                        quit Smalland entirely; just don&apos;t stay loaded into
                        a world while editing that save.
                      </p>
                    </div>
                  </div>
                  <div className="mt-6 md:mt-8 flex flex-col sm:flex-row flex-wrap gap-3">
                    {serverSaveAvailable && (
                      <button
                        type="button"
                        onClick={() => setShowFilePicker(true)}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-white bg-linear-to-r from-teal-500 to-emerald-600 shadow-lg shadow-teal-200/50 hover:shadow-xl hover:shadow-teal-200/60 transition-all hover:-translate-y-0.5"
                      >
                        <FolderOpen size={18} />
                        Open from save folder
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (serverSaveAvailable) void handleChoosePlrClick();
                        else setShowFilePicker(true);
                      }}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-teal-800 bg-white border-2 border-teal-200 hover:bg-teal-50 transition-colors"
                    >
                      <Upload size={18} />
                      {serverSaveAvailable
                        ? "Choose .plr anywhere"
                        : "Upload .plr from your PC"}
                    </button>
                  </div>
                </section>

                <div className="md:col-span-5 md:row-span-2 flex min-h-[220px] flex-col gap-3 md:min-h-0">
                  <div className="px-0.5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                      After you open a save
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-800">
                      Editor areas
                    </p>
                  </div>
                  <div className="grid flex-1 grid-cols-2 gap-3 md:gap-3.5">
                    {[
                      {
                        icon: Zap,
                        title: "Player",
                        desc: "Stats & vitals",
                        gradient: "from-amber-400 to-orange-500",
                        wide: true,
                      },
                      {
                        icon: Package,
                        title: "Inventory",
                        desc: "Items & stacks",
                        gradient: "from-emerald-400 to-teal-600",
                        wide: false,
                      },
                      {
                        icon: Shield,
                        title: "Equipment",
                        desc: "Gear & tiers",
                        gradient: "from-sky-400 to-indigo-600",
                        wide: false,
                      },
                      {
                        icon: Bird,
                        title: "Companions",
                        desc: "Pets & traits",
                        gradient: "from-fuchsia-400 to-rose-500",
                        wide: true,
                      },
                    ].map((f) => {
                      const IconCmp = f.icon;
                      const cardBase =
                        "rounded-2xl border border-slate-200/95 bg-white text-center shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-all duration-200 hover:border-teal-300/55 hover:shadow-md hover:shadow-teal-500/[0.07]";
                      const iconBox = cn(
                        "flex shrink-0 items-center justify-center rounded-xl bg-linear-to-br text-white shadow-sm ring-1 ring-black/[0.04]",
                        f.gradient,
                      );
                      if (f.wide) {
                        return (
                          <div
                            key={f.title}
                            className={cn(
                              cardBase,
                              "col-span-2 flex flex-col items-center justify-center gap-3 px-5 py-6 md:py-7",
                            )}
                          >
                            <div className={cn(iconBox, "size-12")}>
                              <IconCmp size={22} strokeWidth={2.25} />
                            </div>
                            <div className="max-w-[20rem]">
                              <div className="text-[15px] font-semibold tracking-tight text-slate-900">
                                {f.title}
                              </div>
                              <div className="mt-1 text-xs leading-snug text-slate-500">
                                {f.desc}
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div
                          key={f.title}
                          className={cn(
                            cardBase,
                            "flex min-h-[136px] flex-col items-center justify-center gap-3 p-4 md:min-h-[148px]",
                          )}
                        >
                          <div className={cn(iconBox, "size-11")}>
                            <IconCmp size={19} strokeWidth={2.25} />
                          </div>
                          <div className="px-0.5">
                            <div className="text-sm font-semibold tracking-tight text-slate-900">
                              {f.title}
                            </div>
                            <div className="mt-1 text-[11px] leading-snug text-slate-500">
                              {f.desc}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {serverSaveAvailable ? (
                <div className="mt-1 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-linear-to-b from-slate-50/80 to-gray-100 p-4 shadow-sm transition-[box-shadow,border-color] hover:border-emerald-200/80 hover:shadow-md sm:flex-row sm:items-center sm:justify-between md:mt-0 md:p-5">
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-teal-600 shrink-0">
                      <HardDrive size={18} />
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">
                        Local save folder
                      </p>
                                           <p className="text-xs text-gray-500 font-mono truncate max-w-[52ch]">
                        {pathShown}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowFilePicker(true)}
                    className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-teal-700 bg-white border border-teal-200 hover:bg-teal-50 transition-colors"
                  >
                    <FolderOpen size={16} />
                    Browse saves
                  </button>
                </div>
              ) : (
                <div className="mt-1 rounded-2xl border border-teal-200/80 bg-teal-50/50 p-4 text-sm text-teal-900 md:mt-0 md:p-5">
                  <p className="font-semibold text-teal-950">Hosted editor</p>
                  <p className="mt-1 text-teal-900/85 leading-relaxed">
                    This server does not read your Windows save path. Upload
                    your{" "}
                    <code className="rounded bg-white/80 px-1 py-0.5 text-xs font-mono">
                      .plr
                    </code>{" "}
                    from the PC where you play, then use{" "}
                    <strong>Save (download .plr)</strong> and put the file back
                    in{" "}
                    <code className="text-xs font-mono break-all">
                      {SMALLAND_WINDOWS_SAVE_FOLDER}
                    </code>{" "}
                    on that PC.
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleCopySaveFolderPath()}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800 hover:text-teal-950"
                  >
                    <Copy size={13} />
                    Copy save folder path
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* ── Editor — toolbar (no card) + bento panel ── */
            <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3.5 md:gap-4">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-3 md:mb-2">
                <div className="hidden min-w-0 flex-1 items-center gap-3 lg:flex">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-teal-500 to-emerald-600 text-base font-bold text-white shadow-md">
                    {save.data.PlayerName?.charAt(0).toUpperCase() || "?"}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-900">
                      {save.data.PlayerName}
                    </p>
                    <p className="text-xs text-gray-500">
                      Level{" "}
                      <span className="font-medium text-gray-700">
                        {progLevel}
                      </span>
                      <span className="mx-1.5 text-gray-300">·</span>
                      <span
                        className="inline-block max-w-[min(100%,20rem)] truncate align-bottom font-mono text-gray-400"
                        title={filename}
                      >
                        {filename}
                      </span>
                    </p>
                  </div>
                </div>
                {serverSaveAvailable && (
                  <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-2 lg:w-auto">
                    {currentBackup && (
                      <button
                        type="button"
                        onClick={handleRestore}
                        className="inline-flex items-center gap-2 rounded-xl border border-amber-200/80 bg-amber-50/60 px-3 py-2 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-100 disabled:opacity-50"
                      >
                        <RotateCcw size={14} />
                        Restore backup
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleBackup}
                      className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:border-teal-200 hover:bg-teal-50/80 hover:text-teal-900 disabled:opacity-50"
                    >
                      <Archive size={14} />
                      Create backup
                    </button>
                  </div>
                )}
              </div>

              <div className="min-h-128 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-[box-shadow,border-color] hover:border-emerald-200/80 hover:shadow-md md:min-h-160 md:p-6">
                <div
                  className={cn(activeTab !== "player" && "hidden")}
                  aria-hidden={activeTab !== "player"}
                >
                  <PlayerPanel
                    ref={playerPanelRef}
                    save={save}
                    setSave={setSave}
                    fileEpoch={fileEpoch}
                  />
                </div>
                <div
                  className={cn(activeTab !== "inventory" && "hidden")}
                  aria-hidden={activeTab !== "inventory"}
                >
                  <InventoryPanel
                    ref={inventoryPanelRef}
                    save={save}
                    setSave={setSave}
                    fileEpoch={fileEpoch}
                    onDraftCommitted={bumpDraftEpoch}
                  />
                </div>
                <div
                  className={cn(activeTab !== "equipment" && "hidden")}
                  aria-hidden={activeTab !== "equipment"}
                >
                  <EquipmentPanel
                    ref={equipmentPanelRef}
                    save={save}
                    setSave={setSave}
                    fileEpoch={fileEpoch}
                    onDraftCommitted={bumpDraftEpoch}
                  />
                </div>
                <div
                  className={cn(activeTab !== "pets" && "hidden")}
                  aria-hidden={activeTab !== "pets"}
                >
                  <PetsPanel
                    ref={petsPanelRef}
                    save={save}
                    setSave={setSave}
                    fileEpoch={fileEpoch}
                    onDraftCommitted={bumpDraftEpoch}
                  />
                </div>
              </div>
            </div>
          )}

          {save && (
            <nav
              className="fixed bottom-0 left-0 right-0 z-30 flex items-stretch justify-around gap-0 border-t border-white/8 bg-[linear-gradient(180deg,#0d1218,#0b0f14)] px-0.5 pt-1 shadow-[0_-4px_24px_rgba(0,0,0,0.15)] pb-[max(0.35rem,env(safe-area-inset-bottom,0px))] lg:hidden"
              aria-label="Editor sections"
            >
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-t-lg px-0.5 py-1.5 text-[9px] font-semibold leading-tight transition-colors sm:text-[10px]",
                    activeTab === tab.id
                      ? "text-teal-300 bg-white/[0.07]"
                      : "text-slate-500 active:bg-white/4",
                  )}
                >
                  <span className="flex h-5 items-center text-slate-400 [&>svg]:opacity-90">
                    {tab.icon}
                  </span>
                  <span className="max-w-full truncate">{tab.label}</span>
                </button>
              ))}
            </nav>
          )}
        </main>
      </div>
    </div>
  );
}
