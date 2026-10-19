import { ReactNode, useState, useRef, useEffect, useCallback } from "react";
import { MODES, MODE_ORDER, PromptMode } from "@/utils/promptModes";
import { TONES, LENGTHS, Tone, Length, VariationResult } from "@/utils/boostOptions";
import { CATEGORY_LABELS, TemplateCategory, searchTemplates } from "@/data/templates";

const CATEGORIES: (TemplateCategory | "all")[] = ["all", "content", "business", "research", "coding", "writing", "design", "hr", "sales", "personal"];

interface BoostPanelProps {
  mode: PromptMode;
  onModeChange: (m: PromptMode) => void;
  tone: Tone;
  onToneChange: (t: Tone) => void;
  length: Length;
  onLengthChange: (l: Length) => void;
  variations: boolean;
  onVariationsChange: (v: boolean) => void;
  onBoost: () => void;
  results: VariationResult[] | null;
  onPickVariation: (text: string) => void;
  onCloseResults: () => void;
  onPickTemplate: (text: string) => void;
}

const accent = "#8b5cf6";
const PANEL_WIDTH = "260px";

export function BoostPanel({
  mode, onModeChange, tone, onToneChange, length, onLengthChange,
  variations, onVariationsChange, onBoost, results, onPickVariation, onCloseResults,
  onPickTemplate,
}: BoostPanelProps) {
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateQuery, setTemplateQuery] = useState("");
  const [templateCategory, setTemplateCategory] = useState<TemplateCategory | "all">("all");

  if (results) {
    return (
      <div style={{ width: PANEL_WIDTH, padding: "8px" }}>
        <div className="flex items-center justify-between px-1 pb-2">
          <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6b6b6b" }}>
            {results.length > 1 ? "Pick a variation" : "Result"}
          </span>
          <button onClick={onCloseResults} aria-label="Close" style={{ background: "none", border: "none", color: "#8a8a8a", cursor: "pointer", fontSize: "13px", lineHeight: 1 }}>✕</button>
        </div>
        <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
          {results.map((r, i) => (
            <div key={i} className="rounded-lg" style={{ background: "#262626", border: "1px solid #3a3a3a" }}>
              {r.error ? (
                <div style={{ padding: "10px", fontSize: "11.5px", color: "#f87171" }}>✕ {r.error}</div>
              ) : (
                <>
                  <div style={{ padding: "9px 10px 4px", fontSize: "11.5px", lineHeight: 1.5, color: "#e4e4e7", whiteSpace: "pre-wrap", maxHeight: "140px", overflowY: "auto" }}>
                    {r.text || <span style={{ color: "#8a8a8a", fontStyle: "italic" }}>Generating…</span>}
                  </div>
                  {r.done && r.text && (
                    <div style={{ padding: "0 8px 8px" }}>
                      <button
                        onClick={() => onPickVariation(r.text)}
                        style={{
                          width: "100%", padding: "6px 0", borderRadius: "8px", border: "none",
                          background: accent, color: "#fff", fontSize: "11.5px", fontWeight: 600, cursor: "pointer",
                        }}
                      >
                        Use this
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (showTemplates) {
    const list = searchTemplates(templateQuery, templateCategory);
    return (
      <div style={{ width: PANEL_WIDTH, padding: "8px" }}>
        <div className="flex items-center justify-between px-1 pb-2">
          <button
            onClick={() => setShowTemplates(false)}
            style={{ background: "none", border: "none", color: "#a1a1aa", cursor: "pointer", fontSize: "11px", fontWeight: 600, padding: 0 }}
          >
            ← Back
          </button>
          <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6b6b6b" }}>
            Templates
          </span>
        </div>
        <input
          autoFocus
          value={templateQuery}
          onChange={(e) => setTemplateQuery(e.target.value)}
          placeholder="Search templates…"
          style={{
            width: "100%", boxSizing: "border-box", padding: "6px 8px", marginBottom: "6px",
            borderRadius: "8px", border: "1px solid #3a3a3a", background: "#262626",
            color: "#e4e4e7", fontSize: "11px", outline: "none",
          }}
        />
        <CategoryScroller>
          {CATEGORIES.map((c) => (
            <Chip key={c} small active={templateCategory === c} onClick={() => setTemplateCategory(c)}>
              {c === "all" ? "All" : CATEGORY_LABELS[c]}
            </Chip>
          ))}
        </CategoryScroller>
        <div className="flex flex-col gap-1.5 max-h-[260px] overflow-y-auto">
          {list.map((t) => (
            <button
              key={t.id}
              onClick={() => onPickTemplate(t.prompt)}
              style={{
                textAlign: "left", padding: "7px 9px", borderRadius: "8px",
                border: "1px solid #3a3a3a", background: "#262626", cursor: "pointer",
              }}
            >
              <div style={{ fontSize: "11.5px", fontWeight: 600, color: "#e4e4e7" }}>{t.title}</div>
              <div style={{ fontSize: "10px", color: "#8a8a8a", marginTop: "1px" }}>{CATEGORY_LABELS[t.category]}</div>
            </button>
          ))}
          {list.length === 0 && (
            <div style={{ padding: "10px 4px", fontSize: "11px", color: "#8a8a8a", textAlign: "center" }}>
              {templateQuery ? `No templates match "${templateQuery}"` : "No templates in this category"}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: PANEL_WIDTH, padding: "8px" }}>
      <PanelLabel>Mode</PanelLabel>
      <div className="flex flex-wrap gap-1 px-1 pb-2">
        {MODE_ORDER.map((m) => (
          <Chip key={m} small active={mode === m} onClick={() => onModeChange(m)}>
            <span style={{ marginRight: "3px" }}>{MODES[m].emoji}</span>{MODES[m].label}
          </Chip>
        ))}
        <Chip small active={false} tint="#f59e0b" onClick={() => setShowTemplates(true)}>
          <span style={{ marginRight: "3px" }}>📑</span>Templates
        </Chip>
      </div>

      <PanelLabel>Tone</PanelLabel>
      <div className="flex flex-wrap gap-1 px-1 pb-2">
        {TONES.map((t) => (
          <Chip key={t} active={tone === t} small onClick={() => onToneChange(t)}>{t}</Chip>
        ))}
      </div>

      <PanelLabel>Length</PanelLabel>
      <div className="flex gap-1 px-1 pb-2">
        {LENGTHS.map((l) => (
          <Chip key={l.id} active={length === l.id} small grow onClick={() => onLengthChange(l.id)}>{l.label}</Chip>
        ))}
      </div>

      <div className="flex items-center justify-between px-1 pb-2.5">
        <span style={{ fontSize: "11.5px", fontWeight: 500, color: "#d4d4d8" }}>Generate 3 variations</span>
        <label style={{ position: "relative", display: "inline-flex", alignItems: "center", cursor: "pointer" }}>
          <input type="checkbox" checked={variations} onChange={(e) => onVariationsChange(e.target.checked)}
            style={{ position: "absolute", opacity: 0, width: "34px", height: "18px", margin: 0, cursor: "pointer" }} />
          <span style={{
            width: "34px", height: "18px", borderRadius: "999px",
            background: variations ? accent : "#3f3f46", transition: "background 0.15s", display: "inline-block", position: "relative",
          }}>
            <span style={{
              position: "absolute", top: "2px", left: variations ? "18px" : "2px",
              width: "14px", height: "14px", borderRadius: "50%", background: "#fff", transition: "left 0.15s",
            }} />
          </span>
        </label>
      </div>

      <button
        onClick={onBoost}
        style={{
          width: "100%", padding: "7px 0", borderRadius: "10px", border: "none",
          background: accent, color: "#fff", fontSize: "12px", fontWeight: 700, cursor: "pointer",
        }}
      >
        ✨ Boost prompt
      </button>
    </div>
  );
}

/**
 * Horizontal chip strip with scroll arrows. The category list is wider than
 * the 260px panel, so without an affordance there's nothing to signal the
 * off-screen categories — arrows appear only on the side that has more.
 */
function CategoryScroller({ children }: { children: ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const sync = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 2);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => { sync(); }, [sync]);

  const nudge = (dir: -1 | 1) => {
    scrollRef.current?.scrollBy({ left: dir * 110, behavior: "smooth" });
  };

  const arrow: React.CSSProperties = {
    position: "absolute", top: 0, bottom: "8px", width: "20px",
    display: "flex", alignItems: "center", justifyContent: "center",
    border: "none", cursor: "pointer", color: "#e4e4e7",
    fontSize: "11px", lineHeight: 1, padding: 0, zIndex: 1,
  };

  return (
    <div style={{ position: "relative" }}>
      <div
        ref={scrollRef}
        onScroll={sync}
        className="flex gap-1 pb-2 overflow-x-auto"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {children}
      </div>
      {canLeft && (
        <button aria-label="Scroll categories left" onClick={() => nudge(-1)}
          style={{ ...arrow, left: 0, background: "linear-gradient(to right, #1e1e1e 55%, transparent)" }}>‹</button>
      )}
      {canRight && (
        <button aria-label="Scroll categories right" onClick={() => nudge(1)}
          style={{ ...arrow, right: 0, background: "linear-gradient(to left, #1e1e1e 55%, transparent)" }}>›</button>
      )}
    </div>
  );
}

function PanelLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: "9.5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6b6b6b", padding: "0 3px 4px" }}>
      {children}
    </div>
  );
}

function Chip({ active, small, grow, tint, onClick, children }: { active: boolean; small?: boolean; grow?: boolean; tint?: string; onClick: () => void; children: ReactNode }) {
  const c = tint ?? accent;
  const on = active || !!tint;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: grow ? 1 : undefined,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        padding: small ? "4px 7px" : "6px 10px",
        borderRadius: "7px",
        border: `1px solid ${on ? c : "#3a3a3a"}`,
        background: on ? `${c}2e` : "transparent",
        color: tint ? tint : active ? "#c4b5fd" : "#d4d4d8",
        fontSize: small ? "10.5px" : "11.5px",
        fontWeight: 600,
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "background 0.1s, border-color 0.1s",
      }}
    >
      {children}
    </button>
  );
}
