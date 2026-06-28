import { useCallback, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

import { detectPlatform, findVisibleInputElement } from "./utils/platformDetector";
import { getTextFromElement, setTextToElement, captureSnapshot, restoreSnapshot } from "./utils/textareaUtils";
import { readConversationContext } from "./utils/contextReader";
import { ImproveButton } from "./components/ImproveButton";
import { PromptMode } from "@/utils/promptModes";

import styles from "./content.css?inline";

// ─── Toast ────────────────────────────────────────────────────────────────────

type ToastType = "success" | "error" | "info";
type BtnState = "idle" | "loading" | "success" | "error";

function showToast(shadow: ShadowRoot, message: string, type: ToastType) {
  const el = document.createElement("div");
  el.className = `pb-toast pb-toast-${type} pb-slide-up`;
  el.style.cssText = "position:fixed;bottom:24px;right:24px;z-index:2147483647;";
  el.textContent = message;
  shadow.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ─── Root App ─────────────────────────────────────────────────────────────────

interface AppProps {
  getInputEl: () => HTMLElement | null;
  getShadow: () => ShadowRoot | null;
}

function App({ getInputEl, getShadow }: AppProps) {
  const [btnState, setBtnState] = useState<BtnState>("idle");
  const [hasUndo, setHasUndo] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const snapshotRef = useRef<string>("");
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((msg: string, type: ToastType) => {
    const shadow = getShadow();
    if (shadow) showToast(shadow, msg, type);
  }, [getShadow]);

  const handleImprove = useCallback((mode: PromptMode) => {
    const el = getInputEl();
    if (!el) { toast("Could not find the input field.", "error"); return; }

    const text = getTextFromElement(el);
    if (!text.trim()) { toast("Write something first, then click Improve.", "info"); return; }

    // Disconnect any existing stream
    try { portRef.current?.disconnect(); } catch { /* ok */ }

    snapshotRef.current = captureSnapshot(el);
    setBtnState("loading");
    setErrorMsg("");

    const platform = detectPlatform();
    const context = readConversationContext(platform);

    let accumulated = "";

    const port = chrome.runtime.connect({ name: "promptboost-stream" });
    portRef.current = port;

    port.onMessage.addListener((msg: { type: string; data?: string; error?: string }) => {
      if (msg.type === "chunk" && msg.data) {
        accumulated += msg.data;
      } else if (msg.type === "done") {
        port.disconnect();
        portRef.current = null;

        // Prefer the server-cleaned final text (fences/preamble stripped);
        // fall back to the locally accumulated stream.
        const finalText = msg.data ?? accumulated;
        if (finalText) {
          setTextToElement(el, finalText);
          setBtnState("success");
          setHasUndo(true);
          toast("✓ Prompt improved!", "success");

          if (undoTimer.current) clearTimeout(undoTimer.current);
          undoTimer.current = setTimeout(() => setHasUndo(false), 15_000);

          // Auto-reset button
          setTimeout(() => setBtnState("idle"), 2500);
        } else {
          setBtnState("error");
          setErrorMsg("Empty response from AI");
          toast("Empty response — try again.", "error");
          setTimeout(() => setBtnState("idle"), 3000);
        }
      } else if (msg.type === "error") {
        port.disconnect();
        portRef.current = null;
        const errMsg = msg.error ?? "Unknown error";
        setBtnState("error");
        setErrorMsg(errMsg);
        toast(`✗ ${errMsg}`, "error");
        setTimeout(() => setBtnState("idle"), 3000);
      }
    });

    port.onDisconnect.addListener(() => {
      portRef.current = null;
      if (btnState === "loading") {
        setBtnState("idle");
      }
    });

    port.postMessage({ type: "STREAM_IMPROVE", payload: { prompt: text, platform, mode, context } });
  }, [getInputEl, getShadow, toast]);

  const handleUndo = useCallback(() => {
    const el = getInputEl();
    if (el && snapshotRef.current !== undefined) {
      restoreSnapshot(el, snapshotRef.current);
      setHasUndo(false);
      toast("Reverted to original.", "info");
    }
  }, [getInputEl, toast]);

  const handleCancel = useCallback(() => {
    try { portRef.current?.disconnect(); } catch { /* already closed */ }
    portRef.current = null;
    setBtnState("idle");
    toast("Cancelled.", "info");
  }, [toast]);

  return (
    <ImproveButton
      state={btnState}
      onImprove={handleImprove}
      onUndo={handleUndo}
      onCancel={handleCancel}
      hasUndo={hasUndo}
      errorMsg={errorMsg}
    />
  );
}

// ─── Injection ────────────────────────────────────────────────────────────────

const SHADOW_HOST_ID = "promptboost-root";

let shadowRef: ShadowRoot | null = null;

/**
 * Find an anchor button that lives in ChatGPT's BOTTOM TOOLBAR ROW
 * (not the absolute overlay inside the textarea).
 *
 * Strategy: prefer the send/submit button — it's always bottom-right and
 * never floats inside the textarea. Fall back to mic/voice selectors.
 */
function findToolbarAnchor(): HTMLElement | null {
  // Send button is the most reliable: it's always in the bottom toolbar row.
  const sendSelectors = [
    'button[data-testid="send-button"]',
    'button[aria-label="Send prompt"]',
    'button[aria-label*="send" i]',
    'button[aria-label*="submit" i]',
  ];
  for (const sel of sendSelectors) {
    try {
      const btn = document.querySelector<HTMLElement>(sel);
      if (btn && btn.offsetParent !== null) return btn;
    } catch { /* skip */ }
  }

  // Voice-mode button (circular waveform icon) — lives in bottom toolbar.
  // Different from the overlay mic icon which is *inside* the textarea box.
  const voiceSelectors = [
    'button[aria-label="Start voice mode"]',
    'button[data-testid="composer-speech-button"]',
    'button[data-testid*="voice"]',
    'button[aria-label*="voice" i]',
    'button[aria-label*="micro" i]',
    'button[aria-label*="audio" i]',
  ];
  for (const sel of voiceSelectors) {
    try {
      const btn = document.querySelector<HTMLElement>(sel);
      if (btn && btn.offsetParent !== null) return btn;
    } catch { /* skip */ }
  }
  return null;
}

/**
 * Walk UP from `anchor` until we find the first ancestor that is a
 * HORIZONTAL flex row (siblings share the same Y coordinate).
 * Returns the container and the direct child of that container that
 * contains `anchor` (so we can insertBefore it).
 */
function findHorizontalRow(anchor: HTMLElement): { container: HTMLElement; ref: HTMLElement } | null {
  let ref: HTMLElement = anchor;
  let parent: HTMLElement | null = anchor.parentElement;

  while (parent && parent !== document.body) {
    const children = Array.from(parent.children) as HTMLElement[];

    if (children.length >= 2) {
      // Collect Y-midpoints of visible children
      const midpoints = children
        .map((c) => {
          const r = c.getBoundingClientRect();
          return r.height > 0 ? r.top + r.height / 2 : null;
        })
        .filter((y): y is number => y !== null);

      if (midpoints.length >= 2) {
        const spread = Math.max(...midpoints) - Math.min(...midpoints);
        if (spread < 12) {
          // All children at the same Y → this is a horizontal row.
          return { container: parent, ref };
        }
      }
    }

    ref = parent;
    parent = parent.parentElement;
  }
  return null;
}

function injectButton(inputEl: HTMLElement) {
  const existing = document.getElementById(SHADOW_HOST_ID);
  if (existing) {
    // If the host is still connected AND its sibling is still the toolbar anchor → keep it
    const anchor = findToolbarAnchor();
    if (
      existing.isConnected &&
      existing.offsetParent !== null &&
      anchor &&
      existing.parentElement === anchor.parentElement
    ) return;
    // Otherwise the toolbar was rebuilt — remove and re-inject
    existing.remove();
    shadowRef = null;
  }

  const anchor = findToolbarAnchor();

  let insertContainer: HTMLElement | null = null;
  let insertRef: HTMLElement | null = null;

  if (anchor) {
    const row = findHorizontalRow(anchor);
    if (row) {
      insertContainer = row.container;
      insertRef = row.ref; // insert BEFORE the anchor's group
    } else {
      // anchor.parentElement is already the row
      insertContainer = anchor.parentElement;
      insertRef = anchor;
    }
  }

  // Ultimate fallback: append to the input element's parent
  if (!insertContainer) insertContainer = inputEl.parentElement;
  if (!insertContainer) return;

  const host = document.createElement("div");
  host.id = SHADOW_HOST_ID;
  host.style.cssText = [
    "display:inline-flex",
    "align-items:center",
    "justify-content:center",
    "align-self:center",
    "position:relative",
    "z-index:9999",
    "flex-shrink:0",
  ].join(";");

  const shadow = host.attachShadow({ mode: "open" });
  shadowRef = shadow;

  const styleEl = document.createElement("style");
  styleEl.textContent = styles;
  shadow.appendChild(styleEl);

  const mountPoint = document.createElement("div");
  shadow.appendChild(mountPoint);

  try {
    if (insertRef && insertRef.parentNode === insertContainer) {
      insertContainer.insertBefore(host, insertRef);
    } else {
      insertContainer.appendChild(host);
    }
  } catch {
    try { insertContainer.appendChild(host); } catch { return; }
  }

  createRoot(mountPoint).render(
    <App
      getInputEl={() => findVisibleInputElement(detectPlatform())}
      getShadow={() => shadowRef}
    />
  );
}

function cleanup() {
  document.getElementById(SHADOW_HOST_ID)?.remove();
  shadowRef = null;
}

// ─── Observer ─────────────────────────────────────────────────────────────────

function tryInject() {
  const platform = detectPlatform();
  if (platform === "unknown") return;
  const el = findVisibleInputElement(platform);
  if (el) injectButton(el);
}

function startObserver() {
  tryInject();

  let debounce: ReturnType<typeof setTimeout> | null = null;
  const observer = new MutationObserver(() => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => {
      if (!document.getElementById(SHADOW_HOST_ID)) tryInject();
    }, 250);
  });

  observer.observe(document.body, { childList: true, subtree: true });

  let lastHref = location.href;
  setInterval(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      cleanup();
      setTimeout(tryInject, 1200);
    }
  }, 1000);

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "TRIGGER_IMPROVE") {
      // Keyboard shortcut: trigger the primary improve action
      shadowRef?.querySelector<HTMLButtonElement>('[data-pb-action="improve"]')?.click();
    }
    if (msg.type === "CONTEXT_MENU_RESULT") {
      const { improved, error } = msg.payload as { improved?: string; error?: string };
      if (improved) {
        const el = findVisibleInputElement(detectPlatform());
        if (el) setTextToElement(el, improved);
        if (shadowRef) showToast(shadowRef, "✓ Prompt improved!", "success");
      } else if (error) {
        if (shadowRef) showToast(shadowRef, `✗ ${error}`, "error");
      }
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startObserver);
} else {
  startObserver();
}
