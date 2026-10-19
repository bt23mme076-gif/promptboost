import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

import { detectPlatform, findVisibleInputElement } from "./utils/platformDetector";
import { getTextFromElement, setTextToElement, captureSnapshot, restoreSnapshot } from "./utils/textareaUtils";
import { readConversationContext } from "./utils/contextReader";
import { ImproveButton } from "./components/ImproveButton";
import { PromptMode, cleanPromptOutput } from "@/utils/promptModes";
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
        const finalText = cleanPromptOutput(msg.data ?? accumulated);
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
          setVariationResults((prev) => prev?.map((r, i2) => (i2 === idx ? { ...r, text: cleanPromptOutput(msg.data ?? r.text), done: true } : r)) ?? prev);
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
//
// PromptBoost floats over the page (position: fixed) and tracks the composer's
// action buttons from the outside, instead of splicing itself into each site's
// DOM. Every site lays out its composer differently (flex rows, vertical
// stacks, grids), and frameworks rebuild those subtrees at will — so inserting
// into them breaks placement on some sites and gets wiped on others. A fixed
// overlay positioned from measured rects behaves the same everywhere.

const SHADOW_HOST_ID = "promptboost-root";
const BTN_HEIGHT = 32;
/** Gap between our button and the composer's action cluster. */
const CLUSTER_GAP = 6;
/** Action buttons closer than this to the cluster are treated as part of it. */
const CLUSTER_JOIN_DISTANCE = 64;

let shadowRef: ShadowRoot | null = null;
let placerEl: HTMLElement | null = null;
let hostEl: HTMLElement | null = null;

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
  "button.send-button",
  'button[aria-label*="Stop" i]',
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

function isShown(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

/**
 * The composer's trailing action cluster: starting from the bottom-right-most
 * action button (send / voice), gather neighbours to its left that sit on the
 * same row (vertically overlapping) and are close enough to read as one group.
 */
function findActionCluster(inputEl: HTMLElement): HTMLElement[] | null {
  // Walk UP from the input until the enclosing composer contains action buttons.
  let scope: HTMLElement | null = inputEl;
  let candidates: HTMLElement[] = [];
  for (let depth = 0; depth < 14 && scope && scope !== document.body; depth++) {
    const found = new Set<HTMLElement>();
    for (const sel of ACTION_BUTTON_SELECTORS) {
      try {
        scope.querySelectorAll<HTMLElement>(sel).forEach((b) => { if (isShown(b)) found.add(b); });
      } catch { /* invalid selector — skip */ }
    }
    if (found.size) { candidates = [...found]; break; }
    scope = scope.parentElement;
  }
  if (!candidates.length) return null;

  const rects = new Map(candidates.map((b) => [b, b.getBoundingClientRect()] as const));
  const primary = candidates.reduce((best, b) => {
    const rb = rects.get(b)!, rBest = rects.get(best)!;
    return rb.right + rb.bottom > rBest.right + rBest.bottom ? b : best;
  });
  const pr = rects.get(primary)!;

  const sameRow = candidates
    .filter((b) => {
      const r = rects.get(b)!;
      return r.top < pr.bottom && r.bottom > pr.top; // vertical overlap
    })
    .sort((a, b) => rects.get(b)!.right - rects.get(a)!.right);

  const cluster: HTMLElement[] = [primary];
  let left = pr.left;
  for (const b of sameRow) {
    if (b === primary) continue;
    const r = rects.get(b)!;
    if (r.right > pr.right + 1) continue; // never to the right of primary
    if (left - r.right > CLUSTER_JOIN_DISTANCE) continue;
    cluster.push(b);
    left = Math.min(left, r.left);
  }
  return cluster;
}

let cachedInput: HTMLElement | null = null;
let cachedCluster: HTMLElement[] | null = null;
let lastFullScan = 0;
let rafId = 0;

function hidePlacer() {
  if (placerEl) placerEl.style.visibility = "hidden";
}

function reposition(force = false) {
  const platform = detectPlatform();
  if (platform === "unknown") { hidePlacer(); return; }

  const now = performance.now();
  const stale =
    force ||
    !cachedInput || !cachedInput.isConnected || !isShown(cachedInput) ||
    !cachedCluster || cachedCluster.some((b) => !b.isConnected) ||
    now - lastFullScan > 600;

  if (stale) {
    lastFullScan = now;
    cachedInput = findVisibleInputElement(platform);
    cachedCluster = cachedInput ? findActionCluster(cachedInput) : null;
  }

  const input = cachedInput;
  if (!input || !isShown(input)) { hidePlacer(); return; }
  mountIfNeeded();
  if (!placerEl) return;

  const ir = input.getBoundingClientRect();
  if (ir.bottom < 0 || ir.top > window.innerHeight) { hidePlacer(); return; }

  let right: number;
  let top: number;

  const shown = (cachedCluster ?? []).filter(isShown);
  if (shown.length) {
    const rects = shown.map((b) => b.getBoundingClientRect());
    const clusterLeft = Math.min(...rects.map((r) => r.left));
    const clusterTop = Math.min(...rects.map((r) => r.top));
    const clusterBottom = Math.max(...rects.map((r) => r.bottom));
    right = window.innerWidth - (clusterLeft - CLUSTER_GAP);
    top = (clusterTop + clusterBottom) / 2 - BTN_HEIGHT / 2;
  } else {
    // No recognisable action buttons — tuck into the input's bottom-right corner.
    right = window.innerWidth - (ir.right - 8);
    top = ir.bottom - BTN_HEIGHT - 8;
  }

  top = Math.max(4, Math.min(top, window.innerHeight - BTN_HEIGHT - 4));
  right = Math.max(4, right);

  placerEl.style.right = `${Math.round(right)}px`;
  placerEl.style.top = `${Math.round(top)}px`;
  placerEl.style.visibility = "visible";
}

function scheduleReposition() {
  if (rafId) return;
  rafId = requestAnimationFrame(() => { rafId = 0; reposition(); });
}

function mountIfNeeded() {
  if (hostEl && hostEl.isConnected) return;

  document.getElementById(SHADOW_HOST_ID)?.remove();

  const host = document.createElement("div");
  host.id = SHADOW_HOST_ID;
  host.style.cssText = "all:initial;position:fixed;top:0;left:0;width:0;height:0;overflow:visible;pointer-events:none;z-index:2147483646;";
  const shadow = host.attachShadow({ mode: "open" });

  const styleEl = document.createElement("style");
  styleEl.textContent = styles;
  shadow.appendChild(styleEl);

  const placer = document.createElement("div");
  placer.style.cssText = `position:fixed;top:0;right:0;height:${BTN_HEIGHT}px;display:flex;align-items:center;pointer-events:auto;visibility:hidden;`;
  shadow.appendChild(placer);

  const mountPoint = document.createElement("div");
  placer.appendChild(mountPoint);

  document.documentElement.appendChild(host);
  hostEl = host;
  shadowRef = shadow;
  placerEl = placer;

  createRoot(mountPoint).render(
    <App
      getInputEl={() => findVisibleInputElement(detectPlatform())}
      getShadow={() => shadowRef}
    />
  );
}

// ─── Observer ─────────────────────────────────────────────────────────────────

function startObserver() {
  reposition(true);

  // Cheap, rAF-coalesced: reads cached rects, only rescans when stale.
  new MutationObserver(scheduleReposition).observe(document.body, { childList: true, subtree: true });
  window.addEventListener("scroll", scheduleReposition, { capture: true, passive: true });
  window.addEventListener("resize", scheduleReposition, { passive: true });
  document.addEventListener("input", scheduleReposition, true);
  document.addEventListener("focusin", scheduleReposition, true);

  // Safety net for layout shifts nothing above reports (animations, SPA nav).
  setInterval(() => reposition(true), 800);

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
