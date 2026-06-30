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
 * Trailing action buttons that live in the composer's bottom-right button
 * group (send / voice / dictate / mic). On ChatGPT the send button only
 * exists once you've typed — when the composer is empty it shows a voice
 * button instead — so we accept any of them.
 */
const ACTION_BUTTON_SELECTORS = [
  'button[data-testid="send-button"]',
  'button[id="composer-submit-button"]',
  'button[aria-label="Send prompt"]',
  'button[aria-label*="send" i]',
  'button[aria-label*="submit" i]',
  'button[data-testid="composer-speech-button"]',
  'button[aria-label="Start voice mode"]',
  'button[aria-label*="voice" i]',
  'button[aria-label*="dictate" i]',
  'button[aria-label*="micro" i]',
];

/**
 * Find the composer's trailing button group by walking UP from the input
 * element (so the search is SCOPED to this composer, not the whole page).
 * Returns the container that holds the action buttons and the specific
 * button to insert before, so PromptBoost sits inline with send/voice.
 */
function findComposerAnchor(inputEl: HTMLElement): { container: HTMLElement; ref: HTMLElement } | null {
  let scope: HTMLElement | null = inputEl;
  for (let depth = 0; depth < 8 && scope && scope !== document.body; depth++) {
    for (const sel of ACTION_BUTTON_SELECTORS) {
      try {
        const btn = scope.querySelector<HTMLElement>(sel);
        if (btn && btn.offsetParent !== null && btn.parentElement) {
          return { container: btn.parentElement, ref: btn };
        }
      } catch { /* invalid selector — skip */ }
    }
    scope = scope.parentElement;
  }
  return null;
}

function injectButton(inputEl: HTMLElement) {
  const existing = document.getElementById(SHADOW_HOST_ID);
  if (existing) {
    // Keep it as long as it's still attached and visible. Only re-inject when
    // the host has been detached (e.g. ChatGPT rebuilt the composer after a
    // message) — re-injecting puts it back in the same spot in the action row.
    if (existing.isConnected && existing.offsetParent !== null) return;
    existing.remove();
    shadowRef = null;
  }

  const anchor = findComposerAnchor(inputEl);

  let insertContainer: HTMLElement | null = null;
  let insertRef: HTMLElement | null = null;

  if (anchor) {
    insertContainer = anchor.container;
    insertRef = anchor.ref; // insert BEFORE the send/voice button
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
    // tryInject is a cheap no-op when the button is already attached + visible,
    // so we can safely run it on every settle to recover from composer rebuilds.
    debounce = setTimeout(tryInject, 150);
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
