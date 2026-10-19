import { useState, useCallback, useRef, useEffect, CSSProperties } from "react";
import { createPortal } from "react-dom";
import { PromptMode, MODES } from "@/utils/promptModes";
import { BoostOptions, Tone, Length, VariationResult, DEFAULT_TONE, DEFAULT_LENGTH } from "@/utils/boostOptions";
import { BoostPanel } from "./BoostPanel";
import { STORAGE_KEYS } from "@/utils/constants";

type ButtonState = "idle" | "loading" | "success" | "error";

interface ImproveButtonProps {
  onImprove: (mode: PromptMode) => void;
  onBoost: (opts: BoostOptions) => void;
  onUndo: () => void;
  onCancel?: () => void;
  hasUndo: boolean;
  errorMsg?: string;
  state: ButtonState;
  variationResults: VariationResult[] | null;
  onPickVariation: (text: string) => void;
  onCloseVariations: () => void;
  onPickTemplate: (text: string) => void;
}

const ACTIVE_MODE_KEY = "promptboost_active_mode";
const BOOST_PREFS_KEY = "promptboost_boost_prefs";

interface BoostPrefs { tone: Tone; length: Length; variations: boolean; }

export function ImproveButton({
  onImprove, onBoost, onUndo, onCancel, hasUndo, errorMsg = "", state,
  variationResults, onPickVariation, onCloseVariations, onPickTemplate,
}: ImproveButtonProps) {
  const [activeMode, setActiveMode] = useState<PromptMode>("improve");
  const [tone, setTone] = useState<Tone>(DEFAULT_TONE);
  const [length, setLength] = useState<Length>(DEFAULT_LENGTH);
  const [variations, setVariations] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ bottom: 0, left: 0 });
  const [hovered, setHovered] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardPos, setOnboardPos] = useState({ bottom: 0, left: 0 });
  const wandRef = useRef<HTMLButtonElement>(null);
  const caretRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isLoading = state === "loading";
  const isSuccess = state === "success";
  const isError = state === "error";

  // Restore the last-used mode/tone/length/variations so the panel opens predictably.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(ACTIVE_MODE_KEY) as PromptMode | null;
      if (saved && saved in MODES) setActiveMode(saved);
      const prefsRaw = localStorage.getItem(BOOST_PREFS_KEY);
      if (prefsRaw) {
        const prefs = JSON.parse(prefsRaw) as Partial<BoostPrefs>;
        if (prefs.tone) setTone(prefs.tone);
        if (prefs.length) setLength(prefs.length);
        if (typeof prefs.variations === "boolean") setVariations(prefs.variations);
      }
    } catch { /* storage blocked — keep defaults */ }
  }, []);

  // First-use discoverability — show a one-time callout pointing at the wand.
  // chrome.storage.local (not localStorage) so it's seen once across every
  // platform, not once per site.
  useEffect(() => {
    try {
      chrome.storage.local.get(STORAGE_KEYS.ONBOARDED, (result) => {
        if (result[STORAGE_KEYS.ONBOARDED] || !wandRef.current) return;
        const rect = wandRef.current.getBoundingClientRect();
        const width = 230;
        const margin = 8;
        const left = Math.min(rect.left, window.innerWidth - width - margin);
        setOnboardPos({ bottom: window.innerHeight - rect.top + 10, left: Math.max(margin, left) });
        setShowOnboarding(true);
      });
    } catch { /* storage unavailable — skip onboarding */ }
  }, []);

  const dismissOnboarding = useCallback(() => {
    setShowOnboarding(false);
    try { chrome.storage.local.set({ [STORAGE_KEYS.ONBOARDED]: true }); } catch { /* ignore */ }
  }, []);

  // Close menu on outside click (works across the Shadow DOM boundary).
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      const path = e.composedPath();
      const inCaret = caretRef.current && path.includes(caretRef.current);
      const inMenu = menuRef.current && path.includes(menuRef.current);
      if (!inCaret && !inMenu) closeMenu();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeMenu(); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuOpen]);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    if (variationResults) onCloseVariations();
  }, [variationResults, onCloseVariations]);

  const openMenu = useCallback(() => {
    dismissOnboarding();
    if (caretRef.current) {
      const rect = caretRef.current.getBoundingClientRect();
      const panelWidth = 260; // matches BoostPanel's PANEL_WIDTH
      const margin = 8;
      const left = Math.min(rect.left, window.innerWidth - panelWidth - margin);
      setMenuPos({ bottom: window.innerHeight - rect.top + 10, left: Math.max(margin, left) });
    }
    setMenuOpen((v) => !v);
  }, [dismissOnboarding]);

  const persistPrefs = useCallback((next: Partial<BoostPrefs>) => {
    try {
      localStorage.setItem(BOOST_PREFS_KEY, JSON.stringify({ tone, length, variations, ...next }));
    } catch { /* ignore */ }
  }, [tone, length, variations]);

  const handleModeChange = useCallback((mode: PromptMode) => {
    setActiveMode(mode);
    try { localStorage.setItem(ACTIVE_MODE_KEY, mode); } catch { /* ignore */ }
  }, []);

  const handleToneChange = useCallback((t: Tone) => { setTone(t); persistPrefs({ tone: t }); }, [persistPrefs]);
  const handleLengthChange = useCallback((l: Length) => { setLength(l); persistPrefs({ length: l }); }, [persistPrefs]);
  const handleVariationsChange = useCallback((v: boolean) => { setVariations(v); persistPrefs({ variations: v }); }, [persistPrefs]);

  const handlePanelBoost = useCallback(() => {
    const opts: BoostOptions = { mode: activeMode, tone, length, variations };
    onBoost(opts);
    if (!variations) setMenuOpen(false);
  }, [activeMode, tone, length, variations, onBoost]);

  const handlePickVariation = useCallback((text: string) => {
    onPickVariation(text);
    setMenuOpen(false);
  }, [onPickVariation]);

  const handlePickTemplate = useCallback((text: string) => {
    onPickTemplate(text);
    setMenuOpen(false);
  }, [onPickTemplate]);

  // Primary action: single click improves immediately with the last-used mode
  // (tone/length/variations live only in the panel); while loading it cancels.
  const handleWandClick = useCallback(() => {
    dismissOnboarding();
    if (isLoading) { onCancel?.(); return; }
    setMenuOpen(false);
    onImprove(activeMode);
  }, [isLoading, onCancel, onImprove, activeMode, dismissOnboarding]);

  const accent = "#8b5cf6";
  const iconColor = isSuccess ? "#16a34a" : isError ? "#dc2626" : hovered || menuOpen ? accent : "#9b9b9b";

  const wandTitle = isError
    ? errorMsg || "Something went wrong"
    : isSuccess ? "Improved!"
    : isLoading ? "Improving… (click to cancel)"
    : `Improve prompt · ${MODES[activeMode].label} mode`;

  const ghostBtn: CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    border: "none", background: "transparent", cursor: "pointer",
    padding: 0, outline: "none", flexShrink: 0,
    transition: "background 0.15s ease, transform 0.1s ease",
  };

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "1px" }}>
      {/* Primary — wand (improve / cancel) */}
      <button
        ref={wandRef}
        type="button"
        data-pb-action="improve"
        onClick={handleWandClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-label={wandTitle}
        title={wandTitle}
        style={{
          ...ghostBtn,
          width: "32px", height: "32px", borderRadius: "50%",
          background: hovered || menuOpen ? "rgba(139,92,246,0.12)" : "transparent",
          cursor: isLoading ? "progress" : "pointer",
          transform: hovered && !isLoading ? "scale(1.08)" : "scale(1)",
        }}
      >
        {isLoading ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accent}
            strokeWidth="2.5" strokeLinecap="round" style={{ animation: "pb-spin 0.8s linear infinite" }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        ) : isSuccess ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : isError ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 4V2" /><path d="M15 16v-2" /><path d="M8 9h2" /><path d="M20 9h2" />
            <path d="M17.8 11.8 19 13" /><path d="M15 9h0" /><path d="M17.8 6.2 19 5" />
            <path d="m3 21 9-9" /><path d="M12.2 6.2 11 5" />
          </svg>
        )}
      </button>

      {/* Caret — opens the mode menu */}
      <button
        ref={caretRef}
        type="button"
        onClick={openMenu}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-label="Choose improve mode"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        title="Choose mode"
        style={{
          ...ghostBtn,
          width: "16px", height: "32px", borderRadius: "6px",
          background: menuOpen ? "rgba(139,92,246,0.12)" : "transparent",
        }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={menuOpen || hovered ? accent : "#9b9b9b"}
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: menuOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Undo pill */}
      {hasUndo && (
        <button
          type="button"
          onClick={onUndo}
          aria-label="Undo improvement"
          title="Undo — restore your original prompt"
          style={{
            ...ghostBtn,
            gap: "3px", padding: "3px 8px", marginLeft: "2px",
            borderRadius: "999px",
            border: "1px solid rgba(139,92,246,0.3)",
            background: "rgba(139,92,246,0.08)",
            color: "#7c3aed", fontSize: "11px", fontWeight: 500,
            whiteSpace: "nowrap", fontFamily: "inherit",
          }}
        >
          ↩ Undo
        </button>
      )}

      {/* First-use callout — shown once, until the user clicks the wand or caret */}
      {showOnboarding && !menuOpen && createPortal(
        <div
          role="status"
          style={{
            position: "fixed", bottom: onboardPos.bottom, left: onboardPos.left,
            zIndex: 2147483646, width: "230px", padding: "10px 11px",
            background: "#1e1e1e", border: `1px solid ${accent}`, borderRadius: "12px",
            boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            animation: "pb-slide-up 0.2s ease-out both",
          }}
        >
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#e4e4e7", marginBottom: "4px" }}>
            ✨ PromptBoost is ready
          </div>
          <div style={{ fontSize: "11px", lineHeight: 1.5, color: "#a1a1aa", marginBottom: "8px" }}>
            Write a rough prompt, then click the wand to improve it — or the ▾ for modes, tone, and templates.
          </div>
          <button
            onClick={dismissOnboarding}
            style={{
              width: "100%", padding: "5px 0", borderRadius: "8px", border: "none",
              background: accent, color: "#fff", fontSize: "11px", fontWeight: 600, cursor: "pointer",
            }}
          >
            Got it
          </button>
        </div>,
        document.body
      )}

      {/* Boost panel — portalled to escape the composer's overflow:hidden */}
      {menuOpen && createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label="Boost prompt"
          style={{
            position: "fixed", bottom: menuPos.bottom, left: menuPos.left,
            zIndex: 2147483647, background: "#1e1e1e", border: "1px solid #3a3a3a",
            borderRadius: "14px", boxShadow: "0 10px 40px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)",
            overflow: "hidden",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            animation: "pb-slide-up 0.14s ease-out both",
          }}
        >
          <BoostPanel
            mode={activeMode}
            onModeChange={handleModeChange}
            tone={tone}
            onToneChange={handleToneChange}
            length={length}
            onLengthChange={handleLengthChange}
            variations={variations}
            onVariationsChange={handleVariationsChange}
            onBoost={handlePanelBoost}
            results={variationResults}
            onPickVariation={handlePickVariation}
            onCloseResults={closeMenu}
            onPickTemplate={handlePickTemplate}
          />
        </div>,
        document.body
      )}
    </div>
  );
}
