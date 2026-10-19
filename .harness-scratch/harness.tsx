// Preview-only harness: mounts the real ImproveButton/BoostPanel components
// with a fake composer + mocked chrome.runtime.connect, to visually verify
// the on-page boost panel without needing a real chatgpt.com/claude.ai tab.
import { useCallback, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ImproveButton } from "@/content/components/ImproveButton";
import { PromptMode } from "@/utils/promptModes";
import { BoostOptions, VariationResult, buildStyleContext } from "@/utils/boostOptions";

type BtnState = "idle" | "loading" | "success" | "error";

function fakeStream(onChunk: (c: string) => void, onDone: (full: string) => void, sample: string) {
  let i = 0;
  const id = setInterval(() => {
    if (i >= sample.length) { clearInterval(id); onDone(sample); return; }
    onChunk(sample.slice(i, i + 5));
    i += 5;
  }, 20);
}

function App() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [btnState, setBtnState] = useState<BtnState>("idle");
  const [hasUndo, setHasUndo] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [variationResults, setVariationResults] = useState<VariationResult[] | null>(null);
  const snapshotRef = useRef("");

  const getEl = () => textareaRef.current;

  const handleImprove = useCallback((mode: PromptMode, styleContext?: string) => {
    const el = getEl();
    if (!el || !el.value.trim()) return;
    snapshotRef.current = el.value;
    setBtnState("loading"); setErrorMsg("");
    const sample = `[${mode}${styleContext ? " + style" : ""}] You are an expert prompt engineer. Rewrite this into a clear, structured request with explicit context, constraints, and desired output format.`;
    fakeStream(() => {}, (full) => {
      el.value = full;
      setBtnState("success"); setHasUndo(true);
      setTimeout(() => setBtnState("idle"), 2000);
    }, sample);
  }, []);

  const handleBoostVariations = useCallback((mode: PromptMode, styleContext?: string) => {
    const el = getEl();
    if (!el || !el.value.trim()) return;
    snapshotRef.current = el.value;
    setVariationResults(Array.from({ length: 3 }, () => ({ text: "", done: false, error: null })));
    for (let i = 0; i < 3; i++) {
      const idx = i;
      const sample = `Variation ${idx + 1}/3 [${mode}${styleContext ? " + style" : ""}]: A distinctly rephrased version of the boosted prompt, angle ${idx + 1}.`;
      fakeStream(
        (c) => setVariationResults((prev) => prev?.map((r, i2) => i2 === idx ? { ...r, text: r.text + c } : r) ?? prev),
        (full) => setVariationResults((prev) => prev?.map((r, i2) => i2 === idx ? { ...r, text: full, done: true } : r) ?? prev),
        sample
      );
    }
  }, []);

  const handleBoost = useCallback((opts: BoostOptions) => {
    const styleContext = buildStyleContext(opts.tone, opts.length);
    if (opts.variations) handleBoostVariations(opts.mode, styleContext);
    else handleImprove(opts.mode, styleContext);
  }, [handleImprove, handleBoostVariations]);

  const handlePickVariation = useCallback((text: string) => {
    const el = getEl();
    if (!el) return;
    el.value = text;
    setHasUndo(true);
    setVariationResults(null);
  }, []);

  const handleUndo = useCallback(() => {
    const el = getEl();
    if (el) el.value = snapshotRef.current;
    setHasUndo(false);
  }, []);

  const handleCloseVariations = useCallback(() => setVariationResults(null), []);

  return (
    <div style={{ padding: "60px", fontFamily: "sans-serif", background: "#0f0f10", minHeight: "100vh" }}>
      <div style={{ maxWidth: "560px", margin: "0 auto", background: "#1a1a1a", borderRadius: "16px", padding: "12px", border: "1px solid #2a2a2a" }}>
        <textarea
          ref={textareaRef}
          defaultValue="write a blog post about remote work productivity"
          rows={4}
          style={{ width: "100%", background: "transparent", border: "none", color: "#eee", fontSize: "15px", resize: "none", outline: "none", fontFamily: "inherit" }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "4px", marginTop: "8px" }}>
          <ImproveButton
            state={btnState}
            onImprove={handleImprove}
            onBoost={handleBoost}
            onUndo={handleUndo}
            onCancel={() => setBtnState("idle")}
            hasUndo={hasUndo}
            errorMsg={errorMsg}
            variationResults={variationResults}
            onPickVariation={handlePickVariation}
            onCloseVariations={handleCloseVariations}
          />
          <button type="submit" style={{ width: 32, height: 32, borderRadius: "50%", background: "#333", border: "none", color: "#fff" }}>↑</button>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
