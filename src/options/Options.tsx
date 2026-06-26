import React, { useState, useEffect } from "react";
import { useSettings } from "@/hooks/useSettings";
import { useHistory } from "@/hooks/useHistory";
import { GROQ_MODELS, Settings } from "@/types";
import { exportHistory, importHistory, resetSettings } from "@/storage";

type Section = "api" | "model" | "history" | "about";

export function Options() {
  const { settings, status, save } = useSettings();
  const { history, clearAll } = useHistory();
  const [activeSection, setActiveSection] = useState<Section>("api");
  const [saved, setSaved] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [importError, setImportError] = useState("");
  const [keyLocal, setKeyLocal] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [keyDirty, setKeyDirty] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDark(mq.matches);
    mq.addEventListener("change", (e) => setIsDark(e.matches));
  }, []);

  useEffect(() => {
    if (status === "ready") setKeyLocal(settings.groqKey);
  }, [status, settings.groqKey]);

  const handleSave = async (updates: Partial<Settings>) => {
    await save(updates);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleKeySave = () => {
    if (keyDirty) {
      handleSave({ groqKey: keyLocal.trim() });
      setKeyDirty(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Reset all settings? History is preserved.")) return;
    await resetSettings();
    window.location.reload();
  };

  const handleExport = async () => {
    const json = await exportHistory();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `promptboost-history-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importHistory(await file.text());
      setImportError("");
      window.location.reload();
    } catch {
      setImportError("Invalid file. Select a valid PromptBoost export.");
    }
  };

  const navItems: { id: Section; label: string; icon: string }[] = [
    { id: "api", label: "API Key", icon: "🔑" },
    { id: "model", label: "Model", icon: "🤖" },
    { id: "history", label: "History", icon: "🕐" },
    { id: "about", label: "About", icon: "ℹ️" },
  ];

  return (
    <div className={isDark ? "dark" : ""}>
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex">
        {/* Sidebar */}
        <div className="w-56 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col">
          <div className="px-5 py-5 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-sm">
                <span className="text-white text-base">✨</span>
              </div>
              <div>
                <div className="text-sm font-bold text-zinc-900 dark:text-zinc-50">PromptBoost</div>
                <div className="text-[10px] text-zinc-400">Settings</div>
              </div>
            </div>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
                  activeSection === item.id
                    ? "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>

          <div className="px-4 py-4 border-t border-zinc-100 dark:border-zinc-800">
            <button onClick={handleReset} className="w-full text-xs text-zinc-400 hover:text-red-500 transition-colors text-left">
              Reset to defaults
            </button>
          </div>
        </div>

        {/* Main */}
        <div className="flex-1 max-w-2xl mx-auto px-8 py-8">
          {saved && (
            <div className="mb-4 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl text-sm text-emerald-700 dark:text-emerald-400 font-medium">
              ✓ Saved
            </div>
          )}

          {status === "loading" ? (
            <div className="text-sm text-zinc-400 py-8">Loading…</div>
          ) : (
            <>
              {/* ── API Key ── */}
              {activeSection === "api" && (
                <div className="space-y-6">
                  <div>
                    <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Groq API Key</h1>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                      Groq is 100% free. No credit card. 14,400 requests/day.
                    </p>
                  </div>

                  {/* Steps */}
                  <div className="p-4 rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 space-y-2">
                    <div className="text-sm font-semibold text-violet-800 dark:text-violet-300 mb-3">
                      Get your free key in 60 seconds
                    </div>
                    {[
                      ["1", "Go to console.groq.com", "Sign up free (Google login works)"],
                      ["2", "Click API Keys → Create API Key", "Name it anything"],
                      ["3", "Copy the key (starts with gsk_…)", "Paste it below"],
                    ].map(([num, step, sub]) => (
                      <div key={num} className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {num}
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-violet-700 dark:text-violet-300">{step}</div>
                          <div className="text-[11px] text-violet-500 dark:text-violet-400">{sub}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Key input */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                      Paste your Groq API key
                    </label>
                    <div className="relative">
                      <input
                        type={showKey ? "text" : "password"}
                        value={keyLocal}
                        onChange={(e) => { setKeyLocal(e.target.value); setKeyDirty(true); }}
                        onBlur={handleKeySave}
                        placeholder="gsk_…"
                        className="w-full px-4 py-3 pr-16 text-sm font-mono bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-50 placeholder-zinc-300 dark:placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-zinc-700 transition-colors"
                      >
                        {showKey ? "Hide" : "Show"}
                      </button>
                    </div>
                    {keyLocal && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-xs text-emerald-600 dark:text-emerald-400">Key saved and encrypted</span>
                      </div>
                    )}
                  </div>

                  <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 space-y-1.5">
                    <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Free Tier</div>
                    {[
                      ["✓", "No credit card required"],
                      ["✓", "14,400 requests / day"],
                      ["✓", "30 requests / minute"],
                      ["✓", "Llama 70B, Mixtral, Gemma — all free"],
                    ].map(([icon, text]) => (
                      <div key={text} className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                        <span className="text-emerald-500 font-bold">{icon}</span>
                        {text}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Model ── */}
              {activeSection === "model" && (
                <div className="space-y-6">
                  <div>
                    <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Model</h1>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">All models are free on Groq.</p>
                  </div>

                  <div className="space-y-2">
                    {GROQ_MODELS.map((m) => (
                      <button
                        key={m.value}
                        onClick={() => handleSave({ model: m.value })}
                        className={`w-full text-left px-4 py-3.5 rounded-xl border-2 transition-all ${
                          settings.model === m.value
                            ? "border-violet-500 bg-violet-50 dark:bg-violet-900/30"
                            : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-semibold ${settings.model === m.value ? "text-violet-700 dark:text-violet-300" : "text-zinc-800 dark:text-zinc-200"}`}>
                            {m.label}
                          </span>
                          {m.recommended && (
                            <span className="text-[10px] font-bold text-violet-600 bg-violet-100 dark:bg-violet-900/40 dark:text-violet-400 px-2 py-0.5 rounded-full">
                              Recommended
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-400 mt-0.5">{m.note}</div>
                        <div className="text-[10px] font-mono text-zinc-300 dark:text-zinc-600 mt-1">{m.value}</div>
                      </button>
                    ))}
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Temperature</label>
                      <span className="text-sm font-mono text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30 px-2 py-0.5 rounded-lg">
                        {settings.temperature.toFixed(1)}
                      </span>
                    </div>
                    <input
                      type="range" min="0" max="1" step="0.1"
                      value={settings.temperature}
                      onChange={(e) => handleSave({ temperature: parseFloat(e.target.value) })}
                      className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full appearance-none cursor-pointer accent-violet-600"
                    />
                    <div className="flex justify-between text-[10px] text-zinc-400">
                      <span>Focused (0.0)</span>
                      <span>Balanced (0.7)</span>
                      <span>Creative (1.0)</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-3 px-4 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700">
                    <div>
                      <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Keyboard Shortcut</div>
                      <div className="text-xs text-zinc-400 mt-0.5">Ctrl+Shift+P</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={settings.shortcutEnabled}
                        onChange={(e) => handleSave({ shortcutEnabled: e.target.checked })} />
                      <div className="w-10 h-5 bg-zinc-200 dark:bg-zinc-700 peer-checked:bg-violet-600 rounded-full transition-colors" />
                      <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
                    </label>
                  </div>
                </div>
              )}

              {/* ── History ── */}
              {activeSection === "history" && (
                <div className="space-y-5">
                  <div>
                    <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">History</h1>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                      {history.length} improvement{history.length !== 1 ? "s" : ""} stored locally.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-3 px-4 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700">
                      <div>
                        <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Save History</div>
                        <div className="text-xs text-zinc-400 mt-0.5">Store improvements locally</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={settings.showHistory}
                          onChange={(e) => handleSave({ showHistory: e.target.checked })} />
                        <div className="w-10 h-5 bg-zinc-200 dark:bg-zinc-700 peer-checked:bg-violet-600 rounded-full transition-colors" />
                        <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
                      </label>
                    </div>

                    <div className="flex items-center justify-between py-3 px-4 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700">
                      <div>
                        <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Max Items</div>
                        <div className="text-xs text-zinc-400 mt-0.5">Older items auto-removed</div>
                      </div>
                      <select value={settings.maxHistoryItems}
                        onChange={(e) => handleSave({ maxHistoryItems: parseInt(e.target.value) })}
                        className="text-sm bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg px-2 py-1 border-none outline-none">
                        {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button onClick={handleExport} disabled={history.length === 0}
                      className="flex-1 py-2.5 px-4 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-semibold rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                      ↓ Export JSON
                    </button>
                    <label className="flex-1 py-2.5 px-4 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-semibold rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer text-center">
                      ↑ Import JSON
                      <input type="file" accept=".json" className="hidden" onChange={handleImport} />
                    </label>
                  </div>
                  {importError && <p className="text-xs text-red-500">{importError}</p>}

                  {history.length > 0 && (
                    <button onClick={() => { if (confirm("Clear all history?")) clearAll(); }}
                      className="w-full py-2.5 px-4 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm font-semibold rounded-xl border border-red-200 dark:border-red-900 hover:bg-red-100 transition-colors">
                      Clear all history
                    </button>
                  )}
                </div>
              )}

              {/* ── About ── */}
              {activeSection === "about" && (
                <div className="space-y-6">
                  <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">About</h1>
                  <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-md">
                        <span className="text-white text-xl">✨</span>
                      </div>
                      <div>
                        <div className="font-bold text-zinc-900 dark:text-zinc-50">PromptBoost v1.0.0</div>
                        <div className="text-xs text-zinc-400">Powered by Groq</div>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm border-t border-zinc-100 dark:border-zinc-700 pt-4">
                      {[
                        ["API", "Groq (free, fast)"],
                        ["Platforms", "10 AI chatbots"],
                        ["Shortcut", "Ctrl+Shift+P"],
                        ["Data", "Local only"],
                        ["Keys", "AES-256-GCM encrypted"],
                      ].map(([k, v]) => (
                        <div key={k} className="flex justify-between">
                          <span className="text-zinc-400">{k}</span>
                          <span className="text-zinc-700 dark:text-zinc-300 font-medium">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
