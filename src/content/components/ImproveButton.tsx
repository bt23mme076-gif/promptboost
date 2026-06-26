import { useState, useCallback, useRef, useEffect, CSSProperties } from "react";
import { createPortal } from "react-dom";
import { PromptMode, MODES, MODE_ORDER } from "@/utils/promptModes";

type ButtonState = "idle" | "loading" | "success" | "error";

interface ImproveButtonProps {
  onImprove: (mode: PromptMode) => void;
  onUndo: () => void;
  onCancel?: () => void;
  hasUndo: boolean;
  errorMsg?: string;
  state: ButtonState;
}

const ACTIVE_MODE_KEY = "promptboost_active_mode";

export function ImproveButton({
  onImprove, onUndo, onCancel, hasUndo, errorMsg = "", state,
}: ImproveButtonProps) {
  const [activeMode, setActiveMode] = useState<PromptMode>("improve");
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ bottom: 0, left: 0 });
  const [hovered, setHovered] = useState(false);
  const wandRef = useRef<HTMLButtonElement>(null);
  const caretRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isLoading = state === "loading";
  const isSuccess = state === "success";
  const isError = state === "error";

  // Restore the last-used mode so the 1-click action is predictable.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(ACTIVE_MODE_KEY) as PromptMode | null;
      if (saved && saved in MODES) setActiveMode(saved);
    } catch { /* storage blocked — keep default */ }
  }, []);

  // Close menu on outside click (works across the Shadow DOM boundary).
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      const path = e.composedPath();
      const inCaret = caretRef.current && path.includes(caretRef.current);
      const inMenu = menuRef.current && path.includes(menuRef.current);
      if (!inCaret && !inMenu) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const openMenu = useCallback(() => {
    if (caretRef.current) {
      const rect = caretRef.current.getBoundingClientRect();
      setMenuPos({ bottom: window.innerHeight - rect.top + 10, left: rect.left });
    }
    setMenuOpen((v) => !v);
  }, []);

  const selectMode = useCallback((mode: PromptMode) => {
    setActiveMode(mode);
    try { localStorage.setItem(ACTIVE_MODE_KEY, mode); } catch { /* ignore */ }
    setMenuOpen(false);
    onImprove(mode);
  }, [onImprove]);

  // Primary action: single click improves immediately; while loading it cancels.
  const handleWandClick = useCallback(() => {
    if (isLoading) { onCancel?.(); return; }
    setMenuOpen(false);
    onImprove(activeMode);
  }, [isLoading, onCancel, onImprove, activeMode]);

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

      {/* Mode menu — portalled to escape the composer's overflow:hidden */}
      {menuOpen && createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label="Improve modes"
          style={{
            position: "fixed", bottom: menuPos.bottom, left: menuPos.left,
            zIndex: 2147483647, background: "#1e1e1e", border: "1px solid #3a3a3a",
            borderRadius: "14px", boxShadow: "0 10px 40px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)",
            minWidth: "224px", overflow: "hidden", padding: "6px",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            animation: "pb-slide-up 0.14s ease-out both",
          }}
        >
          <div style={{
            padding: "5px 10px 6px", fontSize: "10px", fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.08em", color: "#6b6b6b",
          }}>
            Improve as…
          </div>
          {MODE_ORDER.map((mode) => {
            const m = MODES[mode];
            const isActive = activeMode === mode;
            return (
              <button
                key={mode}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                onClick={() => selectMode(mode)}
                style={{
                  display: "flex", alignItems: "center", gap: "9px",
                  width: "100%", padding: "8px 10px", border: "none", borderRadius: "9px",
                  background: isActive ? "rgba(139,92,246,0.18)" : "transparent",
                  cursor: "pointer", textAlign: "left", transition: "background 0.1s",
                }}
                onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.07)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = isActive ? "rgba(139,92,246,0.18)" : "transparent"; }}
              >
                <span style={{ fontSize: "15px", width: "20px", textAlign: "center", flexShrink: 0 }}>{m.emoji}</span>
                <div style={{ display: "flex", flexDirection: "column", gap: "1px", flex: 1 }}>
                  <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#f2f2f2" }}>{m.label}</span>
                  <span style={{ fontSize: "10.5px", color: "#8a8a8a" }}>{m.description}</span>
                </div>
                {isActive && <span style={{ color: accent, fontWeight: 700, fontSize: "12px" }}>✓</span>}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
