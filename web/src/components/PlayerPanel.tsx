import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useRef,
} from "react";
import type { WrappedSave } from "@/lib/saveTypes";
import {
  mergePlayerFormInto,
  type SaveMergePanelRef,
} from "@/lib/mergeSaveDrafts";
import {
  extractPlayerWorldPosition,
  parseWorldVec3Inputs,
} from "@/lib/playerSaveInspect";
import { Save, RotateCcw, User, Heart, Swords, MapPin } from "lucide-react";
import { toast } from "sonner";

interface Props {
  save: WrappedSave;
  setSave: (s: WrappedSave) => void;
  fileEpoch: number;
}

const u = (...codes: number[]) => String.fromCodePoint(...codes);

const PLAYER_ATTRS = {
  CA_Player_Strength: {
    label: "Strength",
    color: "#ef4444",
    icon: u(0x2694, 0xfe0f),
  },
  CA_Player_Dexterity: {
    label: "Dexterity",
    color: "#f59e0b",
    icon: u(0x1f3f9),
  },
  CA_Player_Endurance: {
    label: "Endurance",
    color: "#22c55e",
    icon: u(0x1f6e1, 0xfe0f),
  },
  CA_Player_Constitution: {
    label: "Constitution",
    color: "#3b82f6",
    icon: u(0x1f9f1),
  },
  CA_Player_Intelligence: {
    label: "Intelligence",
    color: "#8b5cf6",
    icon: u(0x1f9e0),
  },
} as const;

const ATTR_FALLBACK_COLORS = [
  "#ef4444",
  "#f59e0b",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

function toAttrLabel(key: string) {
  const raw = key
    .replace(/^CA_Player_/, "")
    .replace(/_/g, " ")
    .trim();
  return raw ? raw.replace(/\b\w/g, (c) => c.toUpperCase()) : key;
}

function extractPlayerAttributes(attrs: Record<string, number> | undefined) {
  const source = attrs ?? {};
  const fromSave = Object.keys(source).filter((k) =>
    k.startsWith("CA_Player_"),
  );
  const known = Object.keys(PLAYER_ATTRS);
  const allKeys = Array.from(new Set([...known, ...fromSave]));
  return allKeys.reduce<Record<string, number>>((acc, key) => {
    acc[key] = Number(source[key] ?? 0);
    return acc;
  }, {});
}

/** Level written to save / used for attr cap when input is valid. */
function parseLevelForSave(levelStr: string, fallback: number): number {
  const n = Number(levelStr.trim());
  if (!Number.isFinite(n)) return Math.min(100, Math.max(1, fallback));
  return Math.min(100, Math.max(1, Math.floor(n)));
}

/** Attribute cap while typing level (empty / invalid → last saved level as fallback). */
function parseLevelCap(levelStr: string, fallback: number): number {
  const tr = levelStr.trim();
  if (tr === "") return Math.min(100, Math.max(1, fallback));
  const n = Number(tr);
  if (!Number.isFinite(n)) return Math.min(100, Math.max(1, fallback));
  return Math.min(100, Math.max(1, Math.floor(n)));
}

const PlayerPanel = forwardRef<SaveMergePanelRef, Props>(function PlayerPanel(
  { save, setSave, fileEpoch },
  ref,
) {
  const progId = String(save.data.Preserialize.PlayerProgression?.Id ?? "");
  const progData = (save.data.Serialize[progId] ?? {
    Level: 1,
    XP: 0,
    Attributes: {},
  }) as {
    Level: number;
    XP: number;
    Attributes: Record<string, number>;
  };

  const pcSerId = Object.keys(save.data.PlayerCharacter.Serialize)[0];
  const pcData = save.data.PlayerCharacter.Serialize[pcSerId];

  const factionId = String(
    save.data.Preserialize.PlayerFactionRelations?.Id ?? "",
  );
  const factionData = (save.data.Serialize[factionId] ?? {}) as {
    CP?: number;
    ActiveFaction?: string;
  };

  const deathStateId = save.data.Preserialize.PlayerDeathState?.Id;
  const canEditWorldPos = deathStateId != null;

  const [form, setForm] = useState({
    xp: progData.XP,
    health: pcData?.Health ?? 100,
    energy: pcData?.Energy ?? 100,
    starvation: pcData?.Starvation ?? 0,
    food: pcData?.Food ?? 0,
    cp: factionData.CP ?? 0,
  });
  const [levelStr, setLevelStr] = useState(String(progData.Level));
  const [attrForm, setAttrForm] = useState<Record<string, number>>(() =>
    extractPlayerAttributes(progData.Attributes),
  );
  const [worldStr, setWorldStr] = useState(() => {
    const wp = extractPlayerWorldPosition(save);
    return wp
      ? { x: String(wp.x), y: String(wp.y), z: String(wp.z) }
      : { x: "", y: "", z: "" };
  });

  const lastEpochRef = useRef(fileEpoch);
  useEffect(() => {
    if (lastEpochRef.current === fileEpoch) return;
    lastEpochRef.current = fileEpoch;
    const pid = String(save.data.Preserialize.PlayerProgression?.Id ?? "");
    const pd = (save.data.Serialize[pid] ?? {
      Level: 1,
      XP: 0,
      Attributes: {},
    }) as typeof progData;
    const pcId = Object.keys(save.data.PlayerCharacter.Serialize)[0];
    const pc = save.data.PlayerCharacter.Serialize[pcId];
    const fid = String(save.data.Preserialize.PlayerFactionRelations?.Id ?? "");
    const fac = (save.data.Serialize[fid] ?? {}) as { CP?: number };
    setForm({
      xp: pd.XP,
      health: pc?.Health ?? 100,
      energy: pc?.Energy ?? 100,
      starvation: pc?.Starvation ?? 0,
      food: pc?.Food ?? 0,
      cp: fac.CP ?? 0,
    });
    setLevelStr(String(pd.Level));
    setAttrForm(extractPlayerAttributes(pd.Attributes));
    const wp = extractPlayerWorldPosition(save);
    setWorldStr(
      wp
        ? { x: String(wp.x), y: String(wp.y), z: String(wp.z) }
        : { x: "", y: "", z: "" },
    );
  }, [fileEpoch, save]);

  const levelCap = useMemo(
    () => parseLevelCap(levelStr, progData.Level),
    [levelStr, progData.Level],
  );

  useEffect(() => {
    setAttrForm((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        if (next[k] > levelCap) {
          next[k] = levelCap;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [levelCap]);

  const handleChange = (key: keyof typeof form, val: string | number) => {
    setForm((f) => ({ ...f, [key]: val }));
  };
  const handleAttrChange = (key: string, val: string | number) => {
    const raw = typeof val === "string" ? Number(val) : val;
    const n = Number.isFinite(raw) ? raw : 0;
    setAttrForm((prev) => ({
      ...prev,
      [key]: Math.min(levelCap, Math.max(0, n)),
    }));
  };

  const buildPlayerPayload = useCallback(() => {
    const lv = parseLevelForSave(levelStr, progData.Level);
    const w = parseWorldVec3Inputs(worldStr.x, worldStr.y, worldStr.z);
    return {
      level: lv,
      xp: Number(form.xp) || 0,
      health: Number(form.health) || 0,
      energy: Number(form.energy) || 0,
      starvation: Number(form.starvation) || 0,
      food: Number(form.food) || 0,
      cp: Number(form.cp) || 0,
      ...(w !== undefined ? { worldPos: w } : {}),
    };
  }, [form, levelStr, progData.Level, worldStr]);

  const handleSave = useCallback(() => {
    setSave(mergePlayerFormInto(save, buildPlayerPayload(), attrForm));
    toast.success(
      "\u0e19\u0e33\u0e01\u0e32\u0e23\u0e41\u0e01\u0e49\u0e44\u0e02\u0e44\u0e1b\u0e43\u0e0a\u0e49\u0e41\u0e25\u0e49\u0e27",
      { description: "Player" },
    );
  }, [save, buildPlayerPayload, attrForm, setSave]);

  useImperativeHandle(
    ref,
    () => ({
      mergeInto: (base: WrappedSave) =>
        mergePlayerFormInto(base, buildPlayerPayload(), attrForm),
    }),
    [buildPlayerPayload, attrForm],
  );

  const handleReset = () => {
    setForm({
      xp: progData.XP,
      health: pcData?.Health ?? 100,
      energy: pcData?.Energy ?? 100,
      starvation: pcData?.Starvation ?? 0,
      food: pcData?.Food ?? 0,
      cp: factionData.CP ?? 0,
    });
    setLevelStr(String(progData.Level));
    setAttrForm(extractPlayerAttributes(progData.Attributes));
    const wp = extractPlayerWorldPosition(save);
    setWorldStr(
      wp
        ? { x: String(wp.x), y: String(wp.y), z: String(wp.z) }
        : { x: "", y: "", z: "" },
    );
  };

  const savedShort =
    save.data.TimeSaved?.replace(/-/g, "/").replace("T", " ").slice(0, 16) ??
    "—";

  const playerAttrItems = useMemo(() => {
    const keys = Object.keys(attrForm).sort((a, b) => a.localeCompare(b));
    return keys.map((key, ix) => {
      const known = PLAYER_ATTRS[key as keyof typeof PLAYER_ATTRS];
      return {
        key,
        label: known?.label ?? toAttrLabel(key),
        icon: known?.icon ?? u(0x2728),
        color:
          known?.color ??
          ATTR_FALLBACK_COLORS[ix % ATTR_FALLBACK_COLORS.length],
        value: Number(attrForm[key] ?? 0),
      };
    });
  }, [attrForm]);

  const vitals = [
    {
      key: "health" as const,
      label: "Health",
      icon: u(0x1f49a),
      max: 9999,
      color: "#22c55e",
      colorClass: "bg-green-500",
    },
    {
      key: "energy" as const,
      label: "Energy",
      icon: u(0x26a1),
      max: 9999,
      color: "#f59e0b",
      colorClass: "bg-amber-500",
    },
    {
      key: "starvation" as const,
      label: "Starvation",
      icon: u(0x1f480),
      max: 100,
      color: "#ef4444",
      colorClass: "bg-red-500",
    },
    {
      key: "food" as const,
      label: "Food",
      icon: u(0x1f356),
      max: 9999,
      color: "#f97316",
      colorClass: "bg-orange-500",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Player</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Character · Progression · Vitals · Attributes
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            <RotateCcw size={12} /> Reset
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 rounded-lg bg-linear-to-r from-teal-500 to-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:shadow-md"
          >
            <Save size={12} /> Apply Changes
          </button>
        </div>
      </div>

      {/* Hero Section - Name & Level */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5">
        <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-start sm:gap-5">
          <div className="w-16 h-16 rounded-xl bg-linear-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white text-2xl font-bold shrink-0 shadow-lg shadow-teal-200/40 mx-auto sm:mx-0">
            {save.data.PlayerName?.charAt(0).toUpperCase() || "?"}
          </div>
          <div className="flex-1 min-w-0 space-y-3">
            <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-[1fr_120px]">
              <div>
                <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">
                  Display Name
                </label>
                <input
                  readOnly
                  title="Name is read-only in this editor"
                  className="w-full px-3 py-2 text-sm font-medium bg-gray-100 border border-gray-200 rounded-lg text-gray-700 cursor-default"
                  value={save.data.PlayerName ?? ""}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">
                  Level
                </label>
                <input
                  className="w-full px-3 py-2 text-sm font-bold text-center bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
                  type="number"
                  min={1}
                  max={100}
                  value={levelStr}
                  onChange={(e) => setLevelStr(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">
                  Experience
                </label>
                <input
                  className="w-full px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
                  type="number"
                  min={0}
                  value={form.xp}
                  onChange={(e) => handleChange("xp", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">
                  Faction CP
                </label>
                <input
                  className="w-full px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
                  type="number"
                  min={0}
                  value={form.cp}
                  onChange={(e) => handleChange("cp", e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 text-[10px] font-medium text-gray-500 bg-gray-100 rounded-full">
                {savedShort}
              </span>
              <span className="px-2 py-0.5 text-[10px] font-medium text-gray-500 bg-gray-100 rounded-full">
                v{save.data.GameVersion}
              </span>
              <span className="px-2 py-0.5 text-[10px] font-medium text-gray-500 bg-gray-100 rounded-full">
                {factionData.ActiveFaction?.split("/")
                  .pop()
                  ?.replace(/^FD_/, "") ?? "—"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* World position — own card under profile header */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center gap-2 mb-3">
          <MapPin size={14} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700">
            World position
          </h3>
          <span className="text-[10px] font-medium text-gray-400">
            LVPL · PlayerDeathState
          </span>
        </div>
        {!canEditWorldPos && (
          <p className="text-[10px] text-amber-700/90 mb-3 leading-snug">
            This save has no PlayerDeathState block — world position cannot be
            written to the file.
          </p>
        )}
        <div
          className={`grid grid-cols-1 sm:grid-cols-3 gap-3 ${!canEditWorldPos ? "opacity-50 pointer-events-none" : ""}`}
        >
          {(["x", "y", "z"] as const).map((axis) => (
            <label key={axis} className="block min-w-0">
              <span className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">
                {axis}
              </span>
              <input
                type="text"
                inputMode="decimal"
                disabled={!canEditWorldPos}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 disabled:bg-gray-100"
                value={worldStr[axis]}
                onChange={(e) =>
                  setWorldStr((s) => ({ ...s, [axis]: e.target.value }))
                }
                placeholder="0"
              />
            </label>
          ))}
        </div>
        {canEditWorldPos &&
          parseWorldVec3Inputs(worldStr.x, worldStr.y, worldStr.z) ===
            undefined && (
            <p className="text-[10px] text-gray-400 mt-2">
              Enter three valid numbers to update position on Apply.
            </p>
          )}
      </div>

      {/* Two-column grid: Identity + Vitals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Identity */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <User size={14} className="text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-700">Identity</h3>
          </div>
          <dl className="space-y-3">
            {[
              {
                label: "Steam / Player ID",
                value: pcData?.OwningPlayer?.PlayerId ?? "—",
              },
              {
                label: "Last known as",
                value: pcData?.OwningPlayer?.LastKnownAs ?? "—",
              },
              {
                label: "Platform",
                value: pcData?.OwningPlayer?.LastPlatform ?? "—",
              },
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between gap-2 py-2 border-b border-gray-50 last:border-0"
              >
                <dt className="text-xs text-gray-400 inline-flex items-center gap-1.5 shrink-0">
                  {row.label}
                </dt>
                <dd className="text-xs font-medium text-gray-700 font-mono text-right break-all">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Vitals */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Heart size={14} className="text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-700">Vitals</h3>
          </div>
          <div className="space-y-3">
            {vitals.map((v) => (
              <div key={v.key} className="flex items-center gap-3">
                <span className="text-base w-6 text-center shrink-0">
                  {v.icon}
                </span>
                <span className="text-xs font-medium text-gray-500 w-20 shrink-0">
                  {v.label}
                </span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${v.colorClass}`}
                    style={{
                      width: `${Math.min(100, (Number(form[v.key]) / v.max) * 100)}%`,
                    }}
                  />
                </div>
                <input
                  className="w-24 shrink-0 px-2.5 py-1.5 text-sm tabular-nums text-right bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
                  type="number"
                  min={0}
                  max={v.max}
                  value={form[v.key]}
                  onChange={(e) => handleChange(v.key, e.target.value)}
                />
                {v.key === "health" ||
                v.key === "energy" ||
                v.key === "food" ? (
                  <button
                    type="button"
                    onClick={() => handleChange(v.key, v.max)}
                    className="shrink-0 px-2 py-1.5 text-[10px] font-bold text-teal-600 bg-teal-50 rounded hover:bg-teal-100 transition-colors"
                  >
                    MAX
                  </button>
                ) : (
                  <span
                    className="inline-flex w-10.5 shrink-0 justify-center py-1.5"
                    aria-hidden
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Attributes */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Swords size={14} className="text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-700">Attributes</h3>
            <span className="text-[10px] text-gray-400">
              Missing stats = 0 · set above 0 to write into save · cap = level
            </span>
          </div>
          <button
            type="button"
            onClick={() =>
              setAttrForm((prev) =>
                Object.keys(prev).reduce<Record<string, number>>((a, k) => {
                  a[k] = levelCap;
                  return a;
                }, {}),
              )
            }
            className="px-3 py-1 text-[11px] font-medium text-teal-600 bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors"
          >
            Max All (Lv {levelCap})
          </button>
        </div>
        <div className="space-y-2">
          {playerAttrItems.map((attr) => (
            <div key={attr.key} className="flex items-center gap-3">
              <span className="text-base w-6 text-center shrink-0">
                {attr.icon}
              </span>
              <span className="text-xs font-medium text-gray-600 w-28 shrink-0">
                {attr.label}
              </span>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (attr.value / levelCap) * 100)}%`,
                    background: attr.color,
                  }}
                />
              </div>
              <span
                className="text-sm font-bold w-8 text-right"
                style={{ color: attr.color }}
              >
                {attr.value}
              </span>
              <input
                className="w-16 px-2 py-1 text-xs text-right bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                type="number"
                min={0}
                max={levelCap}
                value={attr.value}
                onChange={(e) => handleAttrChange(attr.key, e.target.value)}
              />
              <button
                type="button"
                onClick={() => handleAttrChange(attr.key, levelCap)}
                className="min-w-8 px-2 py-1 text-[10px] font-bold text-gray-500 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                title={`Set to level cap (${levelCap})`}
              >
                {levelCap}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

export default PlayerPanel;
