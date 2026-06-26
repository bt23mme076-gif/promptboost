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

  // Select all existing content
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(el);
  selection?.removeAllRanges();
  selection?.addRange(range);

  // Use execCommand for broad compatibility with ProseMirror / Quill
  // Falls back to direct innerHTML manipulation
  const inserted = document.execCommand("insertText", false, text);
  if (!inserted) {
    el.innerHTML = text.replace(/\n/g, "<br>");
    el.dispatchEvent(new InputEvent("input", { bubbles: true, data: text }));
  }

  // Move cursor to end
  const endRange = document.createRange();
  endRange.selectNodeContents(el);
  endRange.collapse(false);
  selection?.removeAllRanges();
  selection?.addRange(endRange);
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
