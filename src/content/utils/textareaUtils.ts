/**
 * Read and write text from various textarea types used by AI chatbots.
 *
 * Challenge: React/Vue-controlled inputs override the native value setter.
 * We use the native setter from HTMLTextAreaElement.prototype to bypass
 * the JS-controlled value and then fire synthetic events so the framework
 * picks up the change.
 */

export function getTextFromElement(el: HTMLElement): string {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    return el.value;
  }
  if (el.isContentEditable) {
    return el.innerText;
  }
  return "";
}

export function setTextToElement(el: HTMLElement, text: string): void {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    setValueNative(el, text);
  } else if (el.isContentEditable) {
    setContentEditable(el, text);
  }
}

// ─── Textarea / Input ──────────────────────────────────────────────────────────

function setValueNative(el: HTMLTextAreaElement | HTMLInputElement, value: string): void {
  // React overrides the value setter — grab the original from the prototype
  const proto =
    el instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;

  const nativeSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (nativeSetter) {
    nativeSetter.call(el, value);
  } else {
    el.value = value;
  }

  // Fire both events — React listens to `input`, Vue listens to both
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.focus();
}

// ─── ContentEditable (ProseMirror, Quill, etc.) ────────────────────────────────

function setContentEditable(el: HTMLElement, text: string): void {
  el.focus();

  // Select all existing content so the insert below replaces it
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(el);
  selection?.removeAllRanges();
  selection?.addRange(range);

  // 1. A synthetic paste is the most reliable way to insert MULTI-LINE text
  //    into ProseMirror / Quill / Lexical editors — they own paste handling and
  //    turn newlines into paragraphs. A bare insertText with "\n" gets
  //    truncated to the first line on some of them (e.g. Claude).
  // 2. Otherwise insert line by line with explicit paragraph breaks.
  // 3. Last resort: write the DOM directly.
  if (!pasteText(el, text)) {
    const lines = text.split("\n");
    let ok = true;
    lines.forEach((line, i) => {
      if (i > 0) ok = document.execCommand("insertParagraph") && ok;
      if (line) ok = document.execCommand("insertText", false, line) && ok;
    });
    if (!ok || !el.innerText.trim()) {
      el.innerHTML = text.split("\n").map((l) => `<p>${escapeHtml(l) || "<br>"}</p>`).join("");
      el.dispatchEvent(new InputEvent("input", { bubbles: true, data: text }));
    }
  }

  // Move cursor to end
  const endRange = document.createRange();
  endRange.selectNodeContents(el);
  endRange.collapse(false);
  selection?.removeAllRanges();
  selection?.addRange(endRange);
}

function pasteText(el: HTMLElement, text: string): boolean {
  try {
    const data = new DataTransfer();
    data.setData("text/plain", text);
    const ev = new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true });
    el.dispatchEvent(ev);
    return ev.defaultPrevented;
  } catch {
    return false;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ─── Undo Support ─────────────────────────────────────────────────────────────

export function captureSnapshot(el: HTMLElement): string {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    return el.value;
  }
  if (el.isContentEditable) {
    return el.innerHTML;
  }
  return "";
}

export function restoreSnapshot(el: HTMLElement, snapshot: string): void {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    setValueNative(el, snapshot);
  } else if (el.isContentEditable) {
    el.innerHTML = snapshot;
    el.dispatchEvent(new InputEvent("input", { bubbles: true }));
  }
}
