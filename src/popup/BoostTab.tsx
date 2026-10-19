import { useCallback, useEffect, useRef, useState } from "react";
import { Wand2, Copy, Check, X, Loader2, RefreshCw } from "lucide-react";
import { MODES, MODE_ORDER, PromptMode, cleanPromptOutput } from "@/utils/promptModes";
import { TONES, LENGTHS, DEFAULT_TONE, DEFAULT_LENGTH } from "@/utils/boostOptions";
import { Settings } from "@/types";

interface StreamResult {
  text: string;
  done: boolean;
  error: string | null;
}

interface BoostTabProps {
  draft: string;
  onDraftChange: (v: string) => void;
  settings: Settings;
  onBoosted: () => void;
}

export function BoostTab({ draft, onDraftChange, settings, onBoosted }: BoostTabProps) {
  const [mode, setMode] = useState<PromptMode>("improve");
  const [tone, setTone] = useState<(typeof TONES)[number]>(DEFAULT_TONE);
  const [length, setLength] = useState<"short" | "medium" | "long">(DEFAULT_LENGTH);
  const [variations, setVariations] = useState(false);
  const [results, setResults] = useState<StreamResult[] | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const portsRef = useRef<chrome.runtime.Port[]>([]);

  useEffect(() => () => portsRef.current.forEach((p) => { try { p.disconnect(); } catch { /* ok */ } }), []);

  const busy = results !== null && results.some((r) => !r.done && !r.error);

  const handleBoost = useCallback(() => {
    if (!draft.trim() || busy) return;

    portsRef.current.forEach((p) => { try { p.disconnect(); } catch { /* ok */ } });
    portsRef.current = [];

    const count = variations ? 3 : 1;
    const baseContext = `Style requirements — Tone: ${tone}. Desired length: ${length}.`;
    setResults(Array.from({ length: count }, () => ({ text: "", done: false, error: null })));

    for (let i = 0; i < count; i++) {
      const idx = i;
      const context = count > 1
        ? `${baseContext} This is variation ${idx + 1} of ${count} — make it distinctly different in angle and wording from the other variations.`
        : baseContext;

      const port = chrome.runtime.connect({ name: "promptboost-stream" });
      portsRef.current.push(port);

      port.onMessage.addListener((msg: { type: string; data?: string; error?: string }) => {
        if (msg.type === "chunk" && msg.data) {
          setResults((prev) => prev?.map((r, i2) => (i2 === idx ? { ...r, text: r.text + msg.data } : r)) ?? prev);
        } else if (msg.type === "done") {
          try { port.disconnect(); } catch { /* ok */ }
          setResults((prev) => prev?.map((r, i2) => (i2 === idx ? { ...r, text: cleanPromptOutput(r.text || msg.data || ""), done: true } : r)) ?? prev);
          onBoosted();
        } else if (msg.type === "error") {
          try { port.disconnect(); } catch { /* ok */ }
          setResults((prev) => prev?.map((r, i2) => (i2 === idx ? { ...r, done: true, error: msg.error ?? "Something went wrong" } : r)) ?? prev);
        }
      });

      port.postMessage({
        type: "STREAM_IMPROVE",
        payload: { prompt: draft, platform: "unknown", mode, context, model: settings.model },
      });
    }
  }, [draft, busy, variations, tone, length, mode, settings.model, onBoosted]);

  const copy = async (text: string, idx: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1600);
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto px-4 py-3.5 gap-4">
      {/* Mode */}
      <div>
        <div className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-1.5">Mode</div>
        <div className="flex flex-wrap gap-1.5">
          {MODE_ORDER.map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                mode === m
                  ? "bg-brand-600 border-brand-600 text-white shadow-sm shadow-brand-500/30"
                  : "bg-white dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-brand-300 dark:hover:border-brand-700"
              }`}
            >
              <span className="mr-1">{MODES[m].emoji}</span>{MODES[m].label}
            </button>
          ))}
        </div>
      </div>

      {/* Tone + Length */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-1.5">Tone</div>
          <div className="flex flex-wrap gap-1.5">
            {TONES.map((t) => (
              <button key={t} onClick={() => setTone(t)}
                className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                  tone === t
                    ? "bg-brand-50 dark:bg-brand-900/40 border-brand-400 text-brand-700 dark:text-brand-300"
                    : "bg-white dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400"
                }`}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-1.5">Length</div>
          <div className="flex gap-1.5">
            {LENGTHS.map((l) => (
              <button key={l.id} onClick={() => setLength(l.id)}
                className={`flex-1 px-2 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                  length === l.id
                    ? "bg-brand-50 dark:bg-brand-900/40 border-brand-400 text-brand-700 dark:text-brand-300"
                    : "bg-white dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400"
                }`}>
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Variations toggle */}
      <div className="flex items-center justify-between py-2 px-3 bg-white dark:bg-zinc-800/80 rounded-lg border border-zinc-200 dark:border-zinc-700">
        <div className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Generate 3 variations</div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" className="sr-only peer" checked={variations} onChange={(e) => setVariations(e.target.checked)} />
          <div className="w-9 h-5 bg-zinc-200 dark:bg-zinc-700 peer-checked:bg-brand-600 rounded-full transition-colors" />
          <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
        </label>
      </div>

      {/* Input */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Your rough idea</div>
          <span className="text-[10px] text-zinc-300 dark:text-zinc-600">{draft.length}/2000</span>
        </div>
        <textarea
          value={draft}
          maxLength={2000}
          onChange={(e) => onDraftChange(e.target.value)}
          placeholder="Type or paste a rough idea, or pick a template…"
          rows={4}
          className="w-full resize-none px-3 py-2.5 text-xs leading-relaxed bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 transition-colors"
        />
      </div>

      <button
        onClick={handleBoost}
        disabled={!draft.trim() || busy}
        className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shadow-sm shadow-brand-500/20"
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
        {busy ? "Boosting…" : "Boost prompt"}
      </button>

      {/* Results */}
      {results && (
        <div className="flex flex-col gap-2.5 pb-1">
          {results.map((r, i) => (
            <div key={i} className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 overflow-hidden">
              {results.length > 1 && (
                <div className="px-3 pt-2 text-[10px] font-semibold text-brand-600 dark:text-brand-400 uppercase tracking-wide">
                  Variation {i + 1}
                </div>
              )}
              {r.error ? (
                <div className="p-3 text-xs text-red-500 flex items-center gap-1.5"><X size={13} /> {r.error}</div>
              ) : (
                <>
                  <div className="px-3 pt-2 pb-1 text-xs leading-relaxed text-zinc-700 dark:text-zinc-200 whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {r.text || <span className="text-zinc-400 flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Thinking…</span>}
                  </div>
                  {r.done && r.text && (
                    <div className="flex items-center gap-1.5 px-3 pb-2.5">
                      <button onClick={() => copy(r.text, i)}
                        className="flex items-center gap-1 px-2 py-1 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 rounded-md text-[10px] font-medium hover:bg-brand-100 dark:hover:bg-brand-900/50 transition-colors">
                        {copiedIdx === i ? <Check size={11} /> : <Copy size={11} />}
                        {copiedIdx === i ? "Copied" : "Copy"}
                      </button>
                      <button onClick={handleBoost}
                        className="flex items-center gap-1 px-2 py-1 bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 rounded-md text-[10px] font-medium hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors">
                        <RefreshCw size={11} /> Redo
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
