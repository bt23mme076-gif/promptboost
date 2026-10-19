import React, { useState, useEffect } from "react";
import { Zap, Bot, History as HistoryIcon, Info, Sparkles, Check, Lock, Download, Upload, Trash2, X } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { useHistory } from "@/hooks/useHistory";
import { Settings } from "@/types";
import { exportHistory, importHistory, resetSettings } from "@/storage";
import { FREE_MODELS, PRO_MODELS, ModelOption, BACKEND_URL } from "@/api/backend";

type Section = "plan" | "model" | "history" | "about";

export function Options() {
  const { settings, status, save } = useSettings();
  const { history, clearAll } = useHistory();
  const [activeSection, setActiveSection] = useState<Section>("plan");
  const [saved, setSaved] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [importError, setImportError] = useState("");
  const [licenseLocal, setLicenseLocal] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [licenseStatus, setLicenseStatus] = useState<"none" | "valid" | "invalid">("none");
  const [freeConnected, setFreeConnected] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDark(mq.matches);
    mq.addEventListener("change", (e) => setIsDark(e.matches));
  }, []);

  useEffect(() => {
    if (status === "ready") {
      setLicenseLocal(settings.licenseKey ?? "");
      if (settings.licenseKey) setLicenseStatus("valid");
    }
  }, [status, settings.licenseKey]);

  const handleSave = async (updates: Partial<Settings>) => {
    await save(updates);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleVerifyLicense = async () => {
    if (!licenseLocal.trim()) return;
    setVerifying(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/payment/verify-license`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseKey: licenseLocal.trim() }),
      });
      const data = await res.json() as { valid: boolean };
      if (data.valid) {
        await handleSave({ licenseKey: licenseLocal.trim() });
        setLicenseStatus("valid");
      } else {
        setLicenseStatus("invalid");
      }
    } catch {
      setLicenseStatus("invalid");
    }
    setVerifying(false);
  };

  const handleRemoveLicense = async () => {
    await handleSave({ licenseKey: "" });
    setLicenseLocal("");
    setLicenseStatus("none");
  };

  const handleExport = async () => {
    const json = await exportHistory();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `promptboost-history-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importHistory(await file.text());
      setImportError(""); window.location.reload();
    } catch { setImportError("Invalid file. Select a valid PromptBoost export."); }
  };

  const isPro = licenseStatus === "valid";

  const nav: { id: Section; label: string; icon: typeof Zap }[] = [
    { id: "plan",    label: "Plan",    icon: Zap },
    { id: "model",   label: "Model",   icon: Bot },
    { id: "history", label: "History", icon: HistoryIcon },
    { id: "about",   label: "About",   icon: Info },
  ];

  return (
    <div className={isDark ? "dark" : ""}>
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex">

        {/* Sidebar */}
        <div className="w-56 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col">
          <div className="px-5 py-5 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center shadow-sm shadow-brand-500/30">
                <Sparkles size={16} className="text-white" strokeWidth={2.25} />
              </div>
              <div>
                <div className="text-sm font-bold text-zinc-900 dark:text-zinc-50">PromptBoost</div>
                <div className={`flex items-center gap-1 text-[10px] font-semibold ${isPro ? "text-brand-600" : "text-zinc-400"}`}>
                  {isPro && <Zap size={9} fill="currentColor" />}{isPro ? "Pro" : "Free"}
                </div>
              </div>
            </div>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1">
            {nav.map((item) => (
              <button key={item.id} onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
                  activeSection === item.id
                    ? "bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}>
                <item.icon size={15} />{item.label}
              </button>
            ))}
          </nav>

          <div className="px-4 py-4 border-t border-zinc-100 dark:border-zinc-800">
            <button onClick={async () => { if (confirm("Reset all settings?")) { await resetSettings(); window.location.reload(); } }}
              className="w-full text-xs text-zinc-400 hover:text-red-500 transition-colors text-left">
              Reset to defaults
            </button>
          </div>
        </div>

        {/* Main */}
        <div className="flex-1 max-w-2xl mx-auto px-8 py-8">
          {saved && (
            <div className="mb-4 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl text-sm text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1.5">
              <Check size={14} /> Saved
            </div>
          )}

          {status === "loading" ? <div className="text-sm text-zinc-400 py-8">Loading…</div> : (
            <>
              {/* ── Plan ── */}
              {activeSection === "plan" && (
                <div className="space-y-6">
                  <div>
                    <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Your Plan</h1>
                    <p className="text-sm text-zinc-500 mt-1">Free forever. Upgrade for premium models like GPT-5, Claude Opus, Gemini, and more.</p>
                  </div>

                  {/* Plan cards */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Free */}
                    <div className={`rounded-2xl border-2 p-5 ${!isPro ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20" : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"}`}>
                      <div className="text-xs font-bold text-zinc-400 uppercase tracking-wide mb-2">Free</div>
                      <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-1">₹0</div>
                      <div className="text-xs text-zinc-400 mb-4">forever</div>
                      <div className="space-y-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                        {["Llama 3.3 70B (Groq)", "20 improvements / hour", "All 5 modes", "Prompt history"].map((f) => (
                          <div key={f} className="flex items-center gap-1.5"><Check size={12} className="text-emerald-500 shrink-0" />{f}</div>
                        ))}
                      </div>
                      {!isPro && (
                        <button
                          onClick={() => setFreeConnected(true)}
                          className="mt-4 w-full py-2 text-xs font-bold bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition-colors">
                          Use Free
                        </button>
                      )}
                    </div>

                    {/* Pro */}
                    <div className={`rounded-2xl border-2 p-5 relative ${isPro ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20" : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"}`}>
                      <div className="flex items-center gap-1 text-xs font-bold text-brand-600 uppercase tracking-wide mb-2"><Zap size={11} fill="currentColor" />Pro</div>
                      <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-1">₹299</div>
                      <div className="text-xs text-zinc-400 mb-4">per month</div>
                      <div className="space-y-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                        <div className="font-semibold text-zinc-700 dark:text-zinc-300">Everything in Free, plus:</div>
                        {["GPT-4o (OpenAI)", "GPT-4o Mini", "Claude Sonnet 4.6", "Claude Haiku 4.5", "Unlimited improvements"].map((f) => (
                          <div key={f} className="flex items-center gap-1.5"><Check size={12} className="text-emerald-500 shrink-0" />{f}</div>
                        ))}
                      </div>
                      {!isPro && (
                        <button
                          onClick={() => chrome.tabs.create({ url: "https://wa.me/919753324876?text=Hi%2C%20I%20want%20to%20upgrade%20to%20PromptBoost%20Pro" })}
                          className="mt-4 w-full py-2 text-xs font-bold bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition-colors">
                          Upgrade to Pro
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Free connected banner */}
                  {freeConnected && (
                    <div className="flex items-start gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 shrink-0"><Check size={14} /></div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">PromptBoost successfully connected!</div>
                        <div className="text-xs text-emerald-600 dark:text-emerald-500 mt-0.5">
                          Open ChatGPT, Claude, Gemini, or any supported AI platform — the improve button will appear in the composer automatically.
                        </div>
                      </div>
                      <button
                        onClick={() => setFreeConnected(false)}
                        className="text-emerald-400 hover:text-emerald-600 transition-colors shrink-0"
                        aria-label="Dismiss">
                        <X size={14} />
                      </button>
                    </div>
                  )}

                  {/* License key input */}
                  <div className="space-y-3">
                    <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                      {isPro ? "Pro License Key" : "Have a license key?"}
                    </div>

                    {isPro ? (
                      <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-xl">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600"><Check size={14} /></div>
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Pro active</div>
                          <div className="text-xs text-emerald-500 font-mono">{licenseLocal.slice(0, 24)}…</div>
                        </div>
                        <button onClick={handleRemoveLicense} className="text-xs text-zinc-400 hover:text-red-500 transition-colors">Remove</button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <input
                            type={showKey ? "text" : "password"}
                            value={licenseLocal}
                            onChange={(e) => { setLicenseLocal(e.target.value); setLicenseStatus("none"); }}
                            placeholder="Paste your license key…"
                            className="flex-1 px-4 py-3 text-sm font-mono bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-50 placeholder-zinc-300 focus:outline-none focus:border-brand-500 transition-colors"
                          />
                          <button type="button" onClick={() => setShowKey(!showKey)}
                            className="px-3 text-xs text-zinc-400 hover:text-zinc-700 bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl">
                            {showKey ? "Hide" : "Show"}
                          </button>
                        </div>
                        <button onClick={handleVerifyLicense} disabled={!licenseLocal.trim() || verifying}
                          className="w-full py-2.5 text-sm font-semibold bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition-colors disabled:opacity-50">
                          {verifying ? "Verifying…" : "Activate License"}
                        </button>
                        {licenseStatus === "invalid" && (
                          <p className="text-xs text-red-500">Invalid or expired license key. Check your purchase email.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Model ── */}
              {activeSection === "model" && (
                <div className="space-y-6">
                  <div>
                    <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Model</h1>
                    <p className="text-sm text-zinc-500 mt-1">
                      {isPro ? "Pro: all models available." : "Free: Groq models only. Upgrade for premium models."}
                    </p>
                  </div>

                  {/* Free models */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-zinc-400 uppercase tracking-wide">Free Models</div>
                    {FREE_MODELS.map((m) => (
                      <ModelCard key={m.id} model={m} selected={settings.model === m.id}
                        onClick={() => handleSave({ model: m.id })} />
                    ))}
                  </div>

                  {/* Pro models */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-zinc-400 uppercase tracking-wide flex items-center gap-1.5">
                      <Zap size={11} fill="currentColor" />Pro Models
                      {!isPro && <span className="text-brand-500 normal-case font-normal">Upgrade to unlock</span>}
                    </div>
                    {PRO_MODELS.map((m) => (
                      <ModelCard key={m.id} model={m} selected={settings.model === m.id}
                        locked={!isPro}
                        onClick={() => isPro ? handleSave({ model: m.id }) : setActiveSection("plan")} />
                    ))}
                  </div>

                  {/* Shortcut toggle */}
                  <div className="flex items-center justify-between py-3 px-4 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700">
                    <div>
                      <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Keyboard Shortcut</div>
                      <div className="text-xs text-zinc-400 mt-0.5">Ctrl+Shift+P</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={settings.shortcutEnabled}
                        onChange={(e) => handleSave({ shortcutEnabled: e.target.checked })} />
                      <div className="w-10 h-5 bg-zinc-200 dark:bg-zinc-700 peer-checked:bg-brand-600 rounded-full transition-colors" />
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
                    <p className="text-sm text-zinc-500 mt-1">{history.length} improvements stored locally.</p>
                  </div>
                  <div className="space-y-3">
                    {[
                      { label: "Save History", sub: "Store improvements locally", key: "showHistory" as const, val: settings.showHistory },
                    ].map(({ label, sub, key, val }) => (
                      <div key={key} className="flex items-center justify-between py-3 px-4 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700">
                        <div>
                          <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{label}</div>
                          <div className="text-xs text-zinc-400 mt-0.5">{sub}</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" checked={val}
                            onChange={(e) => handleSave({ [key]: e.target.checked })} />
                          <div className="w-10 h-5 bg-zinc-200 dark:bg-zinc-700 peer-checked:bg-brand-600 rounded-full transition-colors" />
                          <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
                        </label>
                      </div>
                    ))}
                    <div className="flex items-center justify-between py-3 px-4 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700">
                      <div>
                        <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Max Items</div>
                        <div className="text-xs text-zinc-400 mt-0.5">Older items auto-removed</div>
                      </div>
                      <select value={settings.maxHistoryItems} onChange={(e) => handleSave({ maxHistoryItems: parseInt(e.target.value) })}
                        className="text-sm bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg px-2 py-1 border-none outline-none">
                        {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={handleExport} disabled={history.length === 0}
                      className="flex-1 py-2.5 px-4 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-semibold rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-750 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5">
                      <Download size={14} /> Export JSON
                    </button>
                    <label className="flex-1 py-2.5 px-4 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-semibold rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer flex items-center justify-center gap-1.5">
                      <Upload size={14} /> Import JSON
                      <input type="file" accept=".json" className="hidden" onChange={handleImport} />
                    </label>
                  </div>
                  {importError && <p className="text-xs text-red-500">{importError}</p>}
                  {history.length > 0 && (
                    <button onClick={() => { if (confirm("Clear all history?")) clearAll(); }}
                      className="w-full py-2.5 px-4 bg-red-50 dark:bg-red-950/30 text-red-600 text-sm font-semibold rounded-xl border border-red-200 hover:bg-red-100 transition-colors flex items-center justify-center gap-1.5">
                      <Trash2 size={14} /> Clear all history
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
                      <div className="w-12 h-12 rounded-2xl bg-brand-600 flex items-center justify-center shadow-md shadow-brand-500/30">
                        <Sparkles size={20} className="text-white" strokeWidth={2.25} />
                      </div>
                      <div>
                        <div className="font-bold text-zinc-900 dark:text-zinc-50">PromptBoost v1.2.0</div>
                        <div className="flex items-center gap-1 text-xs text-zinc-400">{isPro && <Zap size={10} fill="currentColor" />}{isPro ? "Pro Plan" : "Free Plan"}</div>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm border-t border-zinc-100 dark:border-zinc-700 pt-4">
                      {[
                        ["Free model", "Llama 3.3 70B (Groq)"],
                        ["Pro models", "GPT-4o, Claude Sonnet"],
                        ["Platforms", "10 AI chatbots"],
                        ["Shortcut", "Ctrl+Shift+P"],
                        ["Data", "Prompts never stored on our servers"],
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

// ─── Model Card ───────────────────────────────────────────────────────────────

function ModelCard({ model, selected, locked, onClick }: {
  model: ModelOption; selected: boolean; locked?: boolean; onClick: () => void;
}) {
  const providerColors: Record<string, { bg: string; text: string; border: string }> = {
    groq:      { bg: "bg-emerald-500/10 dark:bg-emerald-400/10", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/30" },
    deepseek:  { bg: "bg-cyan-500/10 dark:bg-cyan-400/10",     text: "text-cyan-600 dark:text-cyan-400",     border: "border-cyan-500/30" },
    mistral:   { bg: "bg-amber-500/10 dark:bg-amber-400/10",   text: "text-amber-600 dark:text-amber-400",   border: "border-amber-500/30" },
    openai:    { bg: "bg-sky-500/10 dark:bg-sky-400/10",       text: "text-sky-600 dark:text-sky-400",       border: "border-sky-500/30" },
    anthropic: { bg: "bg-orange-500/10 dark:bg-orange-400/10", text: "text-orange-600 dark:text-orange-400", border: "border-orange-500/30" },
    google: { bg: "bg-blue-500/10 dark:bg-blue-400/10", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/30" },
    xai: { bg: "bg-fuchsia-500/10 dark:bg-fuchsia-400/10", text: "text-fuchsia-600 dark:text-fuchsia-400", border: "border-fuchsia-500/30" },
    moonshot: { bg: "bg-indigo-500/10 dark:bg-indigo-400/10", text: "text-indigo-600 dark:text-indigo-400", border: "border-indigo-500/30" },
    alibaba: { bg: "bg-rose-500/10 dark:bg-rose-400/10", text: "text-rose-600 dark:text-rose-400", border: "border-rose-500/30" },
    openrouter: { bg: "bg-brand-500/10 dark:bg-brand-400/10", text: "text-brand-600 dark:text-brand-400", border: "border-brand-500/30" },
  };

  const p = providerColors[model.provider] ?? { bg: "bg-brand-500/10", text: "text-brand-400", border: "border-brand-500/30" };

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 relative group overflow-hidden ${
        selected
          ? "border-brand-500 bg-brand-50 dark:bg-brand-900/30 shadow-sm shadow-brand-500/10 ring-1 ring-brand-500/40"
          : locked
          ? "border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/40 opacity-75 hover:opacity-95 hover:border-zinc-300 dark:hover:border-zinc-700"
          : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 hover:border-brand-300 dark:hover:border-brand-700/50 hover:shadow-md"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-base font-bold tracking-tight ${selected ? "text-brand-700 dark:text-brand-300" : "text-zinc-900 dark:text-zinc-100"}`}>
              {model.label}
            </span>
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${p.bg} ${p.text} ${p.border}`}>
              {model.provider}
            </span>
            {model.badge && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-600 dark:text-brand-400 border border-brand-500/20">
                {model.badge}
              </span>
            )}
            {model.tier === "pro" && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-0.5">
                <Zap size={9} fill="currentColor" />PRO
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-normal leading-relaxed">
            {model.description}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 pt-0.5">
          {selected && (
            <div className="w-6 h-6 rounded-full bg-brand-600 text-white flex items-center justify-center shadow-md shadow-brand-500/30">
              <Check size={13} strokeWidth={2.5} />
            </div>
          )}
          {locked && (
            <div className="px-3 py-1 rounded-full bg-zinc-200/80 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs font-semibold flex items-center gap-1">
              <Lock size={11} /> Upgrade
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
