import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

import { detectPlatform, findVisibleInputElement } from "./utils/platformDetector";
import { getTextFromElement, setTextToElement, captureSnapshot, restoreSnapshot } from "./utils/textareaUtils";
import { readConversationContext } from "./utils/contextReader";
import { ImproveButton } from "./components/ImproveButton";
import { PromptMode } from "@/utils/promptModes";
import { BoostOptions, VariationResult, buildStyleContext } from "@/utils/boostOptions";

import styles from "./content.css?inline";

// ─── Toast ────────────────────────────────────────────────────────────────────

type ToastType = "success" | "error" | "info";
type BtnState = "idle" | "loading" | "success" | "error";

interface ToastAction {
  label: string;
  onClick: () => void;
}

function showToast(shadow: ShadowRoot, message: string, type: ToastType, action?: ToastAction, duration = 4000) {
  const el = document.createElement("div");
  el.className = `pb-toast pb-toast-${type} pb-slide-up`;
  el.style.cssText = "position:fixed;bottom:24px;right:24px;z-index:2147483647;display:flex;align-items:center;gap:10px;";

  const textSpan = document.createElement("span");
  textSpan.textContent = message;
  el.appendChild(textSpan);

  if (action) {
    const btn = document.createElement("button");
    btn.textContent = action.label;
    btn.style.cssText = "background:#8b5cf6;color:#ffffff;border:none;padding:5px 12px;border-radius:6px;font-weight:600;cursor:pointer;font-size:12px;box-shadow:0 2px 8px rgba(139,92,246,0.4);";
    btn.onclick = (e) => {
      e.stopPropagation();
      action.onClick();
      el.remove();
    };
    el.appendChild(btn);
  }

  shadow.appendChild(el);
  setTimeout(() => el.remove(), duration);
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
  const [variationResults, setVariationResults] = useState<VariationResult[] | null>(null);
  const snapshotRef = useRef<string>("");
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const variationPortsRef = useRef<chrome.runtime.Port[]>([]);
  const limitToastShown = useRef(false);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => variationPortsRef.current.forEach((p) => { try { p.disconnect(); } catch { /* ok */ } }), []);

  const toast = useCallback((msg: string, type: ToastType, action?: ToastAction, duration?: number) => {
    const shadow = getShadow();
    if (shadow) showToast(shadow, msg, type, action, duration);
  }, [getShadow]);

  const handleImprove = useCallback((mode: PromptMode, styleContext?: string) => {
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
    const baseContext = readConversationContext(platform);
    const context = styleContext ? `${baseContext}\n\n${styleContext}` : baseContext;

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

        const isLimitErr = errMsg.toLowerCase().includes("limit") || errMsg.toLowerCase().includes("rate");
        if (isLimitErr) {
          toast(
            "Daily limit reached — 15 free improvements per day.",
            "error",
            {
              label: "Upgrade to Pro 🚀",
              onClick: () => {
                window.open("https://promptboost.atyant.in/pro", "_blank");
              },
            },
            7000
          );
        } else {
          toast(`✗ ${errMsg}`, "error");
        }
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
  }, [getInputEl, toast]);

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

  // 3-variations path — runs independently of the wand's single-shot flow so
  // the primary 1-click Improve stays exactly as it was.
  const handleBoostVariations = useCallback((mode: PromptMode, styleContext?: string) => {
    const el = getInputEl();
    if (!el) { toast("Could not find the input field.", "error"); return; }

    const text = getTextFromElement(el);
    if (!text.trim()) { toast("Write something first, then click Improve.", "info"); return; }

    variationPortsRef.current.forEach((p) => { try { p.disconnect(); } catch { /* ok */ } });
    variationPortsRef.current = [];
    limitToastShown.current = false;

    snapshotRef.current = captureSnapshot(el);
    const platform = detectPlatform();
    const baseContext = readConversationContext(platform);
    setVariationResults(Array.from({ length: 3 }, () => ({ text: "", done: false, error: null })));

    for (let i = 0; i < 3; i++) {
      const idx = i;
      const variationNote = `This is variation ${idx + 1} of 3 — make it distinctly different in angle and wording from the other variations.`;
      const context = [baseContext, styleContext, variationNote].filter(Boolean).join("\n\n");

      const port = chrome.runtime.connect({ name: "promptboost-stream" });
      variationPortsRef.current.push(port);

      port.onMessage.addListener((msg: { type: string; data?: string; error?: string }) => {
        if (msg.type === "chunk" && msg.data) {
          setVariationResults((prev) => prev?.map((r, i2) => (i2 === idx ? { ...r, text: r.text + msg.data } : r)) ?? prev);
        } else if (msg.type === "done") {
          try { port.disconnect(); } catch { /* ok */ }
          setVariationResults((prev) => prev?.map((r, i2) => (i2 === idx ? { ...r, text: msg.data ?? r.text, done: true } : r)) ?? prev);
        } else if (msg.type === "error") {
          try { port.disconnect(); } catch { /* ok */ }
          const errMsg = msg.error ?? "Something went wrong";
          setVariationResults((prev) => prev?.map((r, i2) => (i2 === idx ? { ...r, done: true, error: errMsg } : r)) ?? prev);

          // All 3 streams fail together when the daily cap is hit — surface the
          // upgrade CTA once, not once per stream.
          const isLimitErr = errMsg.toLowerCase().includes("limit") || errMsg.toLowerCase().includes("rate");
          if (isLimitErr && !limitToastShown.current) {
            limitToastShown.current = true;
            toast(
              "Daily limit reached — 15 free improvements per day.",
              "error",
              { label: "Upgrade to Pro 🚀", onClick: () => window.open("https://promptboost.atyant.in/pro", "_blank") },
              7000
            );
          }
        }
      });

      port.postMessage({ type: "STREAM_IMPROVE", payload: { prompt: text, platform, mode, context } });
    }
  }, [getInputEl, toast]);

  const handleBoost = useCallback((opts: BoostOptions) => {
    const styleContext = buildStyleContext(opts.tone, opts.length);
    if (opts.variations) {
      handleBoostVariations(opts.mode, styleContext);
    } else {
      handleImprove(opts.mode, styleContext);
    }
  }, [handleImprove, handleBoostVariations]);

  const handlePickVariation = useCallback((text: string) => {
    const el = getInputEl();
    if (!el) return;
    setTextToElement(el, text);
    setHasUndo(true);
    setVariationResults(null);
    toast("✓ Prompt improved!", "success");
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setHasUndo(false), 15_000);
  }, [getInputEl, toast]);

  const handleCloseVariations = useCallback(() => {
    variationPortsRef.current.forEach((p) => { try { p.disconnect(); } catch { /* ok */ } });
    variationPortsRef.current = [];
    setVariationResults(null);
  }, []);

  const handlePickTemplate = useCallback((text: string) => {
    const el = getInputEl();
    if (!el) return;
    snapshotRef.current = captureSnapshot(el);
    setTextToElement(el, text);
    setHasUndo(true);
    toast("✓ Template inserted — fill in the brackets.", "success");
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setHasUndo(false), 15_000);
  }, [getInputEl, toast]);

  return (
    <ImproveButton
      state={btnState}
      onImprove={handleImprove}
      onBoost={handleBoost}
      onUndo={handleUndo}
      onCancel={handleCancel}
      hasUndo={hasUndo}
      errorMsg={errorMsg}
      variationResults={variationResults}
      onPickVariation={handlePickVariation}
      onCloseVariations={handleCloseVariations}
      onPickTemplate={handlePickTemplate}
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
  // ChatGPT
  'button[data-testid="send-button"]',
  'button[id="composer-submit-button"]',
  // Claude
  'button[aria-label="Send Message"]',
  // Generic send patterns (covers most platforms)
  'button[aria-label="Send prompt"]',
  'button[aria-label*="send" i]',
  'button[aria-label*="submit" i]',
  // Gemini — uses data-tooltip / mattooltip / aria-label variants
  'button[data-tooltip*="Send" i]',
  'button[mattooltip*="Send" i]',
  'button[aria-label*="Send" i]',
  // Perplexity — search/ask submit button
  'button[aria-label*="search" i]',
  'button[aria-label*="ask" i]',
  // Voice/mic buttons (ChatGPT fallback on empty composer)
  'button[data-testid="composer-speech-button"]',
  'button[aria-label="Start voice mode"]',
  'button[aria-label*="voice" i]',
  'button[aria-label*="dictate" i]',
  'button[aria-label*="micro" i]',
  'button[aria-label*="mic" i]',
  // Last-resort: visible submit-type button
  'button[type="submit"]',
];

// Gemini-specific: find the send OR stop OR mic button by direct selector and anchor
// immediately before it. Gemini rebuilds its toolbar between conversations and
// the stop/send buttons can be at different DOM depths.
const GEMINI_PRIMARY_SELECTORS = [
  'button[aria-label*="Send" i]',
  'button[mattooltip*="Send" i]',
  'button[data-tooltip*="Send" i]',
  'button.send-button',
  'button[aria-label*="Stop" i]',
  'button[mattooltip*="Stop" i]',
  'button[aria-label*="Mic" i]',
  'button[aria-label*="Microphone" i]',
  'button[aria-label*="Use microphone" i]',
];

/**
 * Walk UP from a primary action button to the nearest HORIZONTAL row (its
 * visible siblings share a Y baseline), and return where to insert.
 *
 * Anchoring straight to `primary.parentElement` is not safe: on Gemini the
 * mic/send button often sits in a VERTICAL stack (mic under the model
 * dropdown), so inserting there stacks our button above the mic instead of
 * placing it inline. Finding a horizontal row first is what keeps the button
 * on the same baseline as the other composer actions.
 */
function findHorizontalRow(primary: HTMLElement): { container: HTMLElement; ref: HTMLElement } | null {
  // Accept a single-child container too — on platforms like Gemini the stop
  // button can be the sole visible child, and if we require >= 2 we overshoot
  // to a larger ancestor and land in a different position than the send state.
  let ref: HTMLElement = primary;
  let parent: HTMLElement | null = primary.parentElement;
  while (parent && parent !== document.body) {
    const visible = (Array.from(parent.children) as HTMLElement[])
      .filter((c) => c.getBoundingClientRect().height > 0);
    if (visible.length >= 1) {
      const ys = visible.map((c) => {
        const r = c.getBoundingClientRect();
        return r.top + r.height / 2;
      });
      const isHorizontal = visible.length === 1 || Math.max(...ys) - Math.min(...ys) < 16;
      if (isHorizontal && visible.length >= 2) {
        return { container: parent, ref };
      }
      // Single-child horizontal row — only stop here if ref itself contains buttons
      // (i.e. we're already at the right level, not at an outer wrapper).
      if (isHorizontal && ref.querySelector("button") !== null) {
        return { container: parent, ref };
      }
    }
    ref = parent;
    parent = parent.parentElement;
  }
  return null;
}

function findGeminiAnchor(): { container: HTMLElement; ref: HTMLElement } | null {
  for (const sel of GEMINI_PRIMARY_SELECTORS) {
    try {
      const btn = document.querySelector<HTMLElement>(sel);
      if (!btn) continue;
      const r = btn.getBoundingClientRect();
      if (r.width === 0 && btn.offsetParent === null) continue;
      const row = findHorizontalRow(btn);
      if (row) return row;
    } catch { /* skip */ }
  }
  return null;
}

/**
 * Find where to drop PromptBoost in the composer's trailing action row.
 *
 * 1. Scoped to this composer (walk UP from the input), collect the visible
 *    action buttons and pick the bottom-right-most one — that's the primary
 *    send / voice button.
 * 2. Walk UP from that button to the nearest horizontal row (see
 *    findHorizontalRow). That row holds each action button's wrapper.
 * 3. Insert our host as a sibling in that row, before the branch that contains
 *    the primary button — so we sit inline with mic / voice / send.
 */
function findComposerAnchor(inputEl: HTMLElement): { container: HTMLElement; ref: HTMLElement } | null {
  // 1. Locate the primary action button within this composer.
  let primary: HTMLElement | null = null;
  let scope: HTMLElement | null = inputEl;
  for (let depth = 0; depth < 14 && scope && scope !== document.body; depth++) {
    const candidates: HTMLElement[] = [];
    for (const sel of ACTION_BUTTON_SELECTORS) {
      try {
        scope.querySelectorAll<HTMLElement>(sel).forEach((b) => {
          const r = b.getBoundingClientRect();
          if (b.offsetParent !== null || r.width > 0) candidates.push(b);
        });
      } catch { /* invalid selector — skip */ }
    }
    if (candidates.length) {
      // Bottom-right-most = the primary send/voice button.
      primary = candidates.reduce((best, b) => {
        const rb = b.getBoundingClientRect();
        const rBest = best.getBoundingClientRect();
        return rb.right + rb.bottom > rBest.right + rBest.bottom ? b : best;
      });
      break;
    }
    scope = scope.parentElement;
  }
  if (!primary) return null;

  // 2. Walk up to the horizontal action row.
  const row = findHorizontalRow(primary);
  if (row) return row;

  // Fallback: drop it right before the primary button.
  return primary.parentElement ? { container: primary.parentElement, ref: primary } : null;
}

function injectButton(inputEl: HTMLElement) {
  const existing = document.getElementById(SHADOW_HOST_ID);
  if (existing) {
    // Keep it as long as it's still attached and visible. Only re-inject when
    // the host has been detached (e.g. ChatGPT rebuilt the composer after a
    // message) — re-injecting puts it back in the same spot in the action row.
    if (existing.isConnected && existing.getBoundingClientRect().height > 0) return;
    existing.remove();
    shadowRef = null;
  }

  const platform = detectPlatform();
  // Gemini gets a direct-selector anchor so the position stays fixed across
  // page refreshes and subsequent searches (the generic heuristic is sensitive
  // to whether the stop or send button is active, causing the insertion level
  // to shift).
  const anchor = platform === "gemini" ? findGeminiAnchor() ?? findComposerAnchor(inputEl) : findComposerAnchor(inputEl);

  let insertContainer: HTMLElement | null = null;
  let insertRef: HTMLElement | null = null;

  if (anchor) {
    insertContainer = anchor.container;
    insertRef = anchor.ref; // insert BEFORE the send/voice button
  }

  // Ultimate fallback: append to the input element's parent
  if (!insertContainer) insertContainer = inputEl.parentElement;
  if (!insertContainer) return;

  // Match the height of the sibling we sit next to so flex centring lines our
  // button up with the mic / voice / send icons instead of floating high or low.
  const refHeight = insertRef ? Math.round(insertRef.getBoundingClientRect().height) : 0;

  const host = document.createElement("div");
  host.id = SHADOW_HOST_ID;
  host.style.cssText = [
    "display:inline-flex",
    "align-items:center",
    "justify-content:center",
    "align-self:center",
    refHeight ? `height:${refHeight}px` : "",
    "box-sizing:border-box",
    "margin:0 2px",
    "position:relative",
    "z-index:9999",
    "flex-shrink:0",
  ].filter(Boolean).join(";");

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
