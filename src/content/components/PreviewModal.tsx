import { useEffect, useRef, useState, useCallback } from "react";
import { scorePrompt, scoreLabel } from "@/utils/promptScore";
import { PromptMode, MODES } from "@/utils/promptModes";

interface PreviewModalProps {
  original: string;
  mode: PromptMode;
  platform: string;
  context: string;
  onAccept: (improved: string) => void;
  onCancel: () => void;
}

export function PreviewModal({ original, mode, platform, context, onAccept, onCancel }: PreviewModalProps) {
  const [improved, setImproved] = useState("");
  const [streaming, setStreaming] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const improvedRef = useRef("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const originalScore = scorePrompt(original);
  const improvedScore = scorePrompt(improved);

  // Start streaming on mount
  useEffect(() => {
    const port = chrome.runtime.connect({ name: "promptboost-stream" });
    portRef.current = port;

    port.onMessage.addListener((msg: { type: string; data?: string; error?: string }) => {
      if (msg.type === "chunk" && msg.data) {
        improvedRef.current += msg.data;
        setImproved(improvedRef.current);
        // Auto-scroll improved pane
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      } else if (msg.type === "done") {
        setStreaming(false);
      } else if (msg.type === "error") {
        setError(msg.error ?? "Unknown error");
        setStreaming(false);
      }
    });

    port.onDisconnect.addListener(() => {
      setStreaming(false);
    });

    port.postMessage({
      type: "STREAM_IMPROVE",
      payload: { prompt: original, platform, mode, context },
    });

    return () => {
      try { port.disconnect(); } catch { /* already closed */ }
    };
  }, []);

  const handleAccept = useCallback(() => {
    if (improvedRef.current) onAccept(improvedRef.current);
  }, [onAccept]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(improvedRef.current);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  // Keyboard: Escape to cancel, Enter to accept
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !streaming) handleAccept();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [streaming, handleAccept, onCancel]);

  const modeConfig = MODES[mode];
  const origLabel = scoreLabel(originalScore.total);
  const impLabel = scoreLabel(improvedScore.total);

  return (
    <div className="pb-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="pb-modal">
        {/* Header */}
        <div className="pb-modal-header">
          <div className="flex items-center gap-2">
            <span className="text-lg">{modeConfig.emoji}</span>
            <div>
              <div className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                {modeConfig.label} Mode
              </div>
              <div className="text-[11px] text-zinc-400">{modeConfig.description}</div>
            </div>
          </div>
          <button onClick={onCancel} className="pb-modal-close">✕</button>
        </div>

        {/* Score bar */}
        <div className="pb-score-row">
          <ScoreBar label="Before" score={originalScore.total} scoreInfo={origLabel} />
          <div className="pb-score-arrow">
            {streaming ? (
              <svg className="pb-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            ) : (
              <span style={{ color: "#8b5cf6", fontSize: "18px" }}>→</span>
            )}
          </div>
          <ScoreBar label="After" score={improved ? improvedScore.total : 0} scoreInfo={impLabel} streaming={streaming} />
        </div>

        {/* Content panes */}
        <div className="pb-panes">
          {/* Original */}
          <div className="pb-pane">
            <div className="pb-pane-label">Original</div>
            <div className="pb-pane-content pb-original-text">{original}</div>
          </div>

          {/* Improved */}
          <div className="pb-pane pb-pane-improved">
            <div className="pb-pane-label" style={{ color: "#7c3aed" }}>
              Improved {streaming && <span className="pb-streaming-dot" />}
            </div>
            <div className="pb-pane-content pb-improved-text" ref={scrollRef}>
              {error ? (
                <span style={{ color: "#dc2626" }}>✗ {error}</span>
              ) : improved ? (
                <span>
                  {improved}
                  {streaming && <span className="pb-cursor">|</span>}
                </span>
              ) : (
                <span style={{ color: "#a1a1aa", fontStyle: "italic" }}>Generating…</span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="pb-modal-footer">
          <button onClick={onCancel} className="pb-btn-ghost">Cancel</button>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={handleCopy}
              disabled={!improved || streaming}
              className="pb-btn-outline"
            >
              {copied ? "✓ Copied" : "📋 Copy"}
            </button>
            <button
              onClick={handleAccept}
              disabled={!improved || streaming || !!error}
              className="pb-btn-primary"
            >
              {streaming ? "Generating…" : "Use this  ↵"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Score Bar ────────────────────────────────────────────────────────────────

interface ScoreBarProps {
  label: string;
  score: number;
  scoreInfo: { label: string; color: string };
  streaming?: boolean;
}

function ScoreBar({ label, score, scoreInfo, streaming }: ScoreBarProps) {
  return (
    <div className="pb-score-block">
      <div className="pb-score-top">
        <span className="pb-score-label">{label}</span>
        <span className="pb-score-num" style={{ color: streaming ? "#a1a1aa" : scoreInfo.color }}>
          {streaming ? "—" : `${score}/100`}
        </span>
      </div>
      <div className="pb-score-track">
        <div
          className="pb-score-fill"
          style={{
            width: streaming ? "0%" : `${score}%`,
            background: scoreInfo.color,
            transition: "width 0.4s ease",
          }}
        />
      </div>
      <div className="pb-score-tag" style={{ color: streaming ? "#a1a1aa" : scoreInfo.color }}>
        {streaming ? "…" : scoreInfo.label}
      </div>
    </div>
  );
}
