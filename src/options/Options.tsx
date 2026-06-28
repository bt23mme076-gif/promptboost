import React, { useState, useEffect } from "react";
import { useSettings } from "@/hooks/useSettings";
import { useHistory } from "@/hooks/useHistory";
import { Settings } from "@/types";
import { exportHistory, importHistory, resetSettings } from "@/storage";
import { FREE_MODELS, PRO_MODELS, ModelOption } from "@/api/backend";

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
      const res = await fetch("https://api.promptboost.in/api/payment/verify-license", {
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
  const availableModels: ModelOption[] = isPro ? [...FREE_MODELS, ...PRO_MODELS] : FREE_MODELS;

  const nav: { id: Section; label: string; icon: string }[] = [
    { id: "plan",    label: "Plan",    icon: "⚡" },
    { id: "model",   label: "Model",   icon: "🤖" },
    { id: "history", label: "History", icon: "🕐" },
    { id: "about",   label: "About",   icon: "ℹ️" },
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
                <div className={`text-[10px] font-semibold ${isPro ? "text-violet-600" : "text-zinc-400"}`}>
                  {isPro ? "⚡ Pro" : "Free"}
                </div>
              </div>
            </div>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1">
            {nav.map((item) => (
              <button key={item.id} onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
                  activeSection === item.id
                    ? "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}>
                <span>{item.icon}</span>{item.label}
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
            <div className="mb-4 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl text-sm text-emerald-700 dark:text-emerald-400 font-medium">
              ✓ Saved
            </div>
          )}

          {status === "loading" ? <div className="text-sm text-zinc-400 py-8">Loading…</div> : (
            <>
              {/* ── Plan ── */}
              {activeSection === "plan" && (
                <div className="space-y-6">
                  <div>
                    <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Your Plan</h1>
                    <p className="text-sm text-zinc-500 mt-1">Free forever. Upgrade for GPT-4o and Claude access.</p>
                  </div>

                  {/* Plan cards */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Free */}
                    <div className={`rounded-2xl border-2 p-5 ${!isPro ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20" : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"}`}>
                      <div className="text-xs font-bold text-zinc-400 uppercase tracking-wide mb-2">Free</div>
                      <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-1">₹0</div>
                      <div className="text-xs text-zinc-400 mb-4">forever</div>
                      <div className="space-y-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                        <div>✓ Llama 3.3 70B (Groq)</div>
                        <div>✓ 20 improvements / hour</div>
                        <div>✓ All 5 modes</div>
                        <div>✓ Prompt history</div>
                      </div>
                    </div>

                    {/* Pro */}
                    <div className={`rounded-2xl border-2 p-5 relative ${isPro ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20" : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"}`}>
                      <div className="text-xs font-bold text-violet-600 uppercase tracking-wide mb-2">Pro ⚡</div>
                      <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-1">₹299</div>
                      <div className="text-xs text-zinc-400 mb-4">per month</div>
                      <div className="space-y-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                        <div className="font-semibold text-zinc-700 dark:text-zinc-300">Everything in Free, plus:</div>
                        <div>✓ GPT-4o (OpenAI)</div>
                        <div>✓ GPT-4o Mini</div>
                        <div>✓ Claude Sonnet 4.6</div>
                        <div>✓ Claude Haiku 4.5</div>
                        <div>✓ Unlimited improvements</div>
                      </div>
                      {!isPro && (
                        <button
                          onClick={() => chrome.tabs.create({ url: "https://promptboost.in/pro" })}
                          className="mt-4 w-full py-2 text-xs font-bold bg-gradient-to-r from-violet-600 to-purple-700 text-white rounded-xl hover:opacity-90 transition-opacity">
                          Upgrade to Pro →
                        </button>
                      )}
                    </div>
                  </div>

                  {/* License key input */}
                  <div className="space-y-3">
                    <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                      {isPro ? "Pro License Key" : "Have a license key?"}
                    </div>

                    {isPro ? (
                      <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-xl">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 text-sm">✓</div>
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
                            className="flex-1 px-4 py-3 text-sm font-mono bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-50 placeholder-zinc-300 focus:outline-none focus:border-violet-500 transition-colors"
                          />
                          <button type="button" onClick={() => setShowKey(!showKey)}
                            className="px-3 text-xs text-zinc-400 hover:text-zinc-700 bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl">
                            {showKey ? "Hide" : "Show"}
                          </button>
                        </div>
                        <button onClick={handleVerifyLicense} disabled={!licenseLocal.trim() || verifying}
                          className="w-full py-2.5 text-sm font-semibold bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-50">
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
                      {isPro ? "Pro: all models available." : "Free: Groq models only. Upgrade for GPT-4o and Claude."}
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
                    <div className="text-xs font-bold text-zinc-400 uppercase tracking-wide flex items-center gap-2">
                      Pro Models ⚡
                      {!isPro && <span className="text-violet-500 normal-case font-normal">Upgrade to unlock</span>}
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
                          <div className="w-10 h-5 bg-zinc-200 dark:bg-zinc-700 peer-checked:bg-violet-600 rounded-full transition-colors" />
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
                      className="flex-1 py-2.5 px-4 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-semibold rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 transition-colors disabled:opacity-40">
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
                      className="w-full py-2.5 px-4 bg-red-50 dark:bg-red-950/30 text-red-600 text-sm font-semibold rounded-xl border border-red-200 hover:bg-red-100 transition-colors">
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
                        <div className="font-bold text-zinc-900 dark:text-zinc-50">PromptBoost v1.2.0</div>
                        <div className="text-xs text-zinc-400">{isPro ? "Pro Plan ⚡" : "Free Plan"}</div>
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
  const providerBadge: Record<string, string> = {
    groq: "bg-green-100 text-green-700", openai: "bg-blue-100 text-blue-700",
    anthropic: "bg-orange-100 text-orange-700",
  };

  return (
    <button onClick={onClick} className={`w-full text-left px-4 py-3.5 rounded-xl border-2 transition-all relative ${
      selected ? "border-violet-500 bg-violet-50 dark:bg-violet-900/30"
      : locked ? "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 opacity-60"
      : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-zinc-300"
    }`}>
      <div className="flex items-center gap-2">
        <span className={`text-sm font-semibold ${selected ? "text-violet-700 dark:text-violet-300" : "text-zinc-800 dark:text-zinc-200"}`}>
          {model.label}
        </span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${providerBadge[model.provider] ?? ""}`}>
          {model.provider}
        </span>
        {model.tier === "pro" && <span className="text-[10px] font-bold text-violet-600 bg-violet-100 px-2 py-0.5 rounded-full">Pro</span>}
        {locked && <span className="ml-auto text-zinc-300 text-sm">🔒</span>}
      </div>
      <div className="text-[10px] font-mono text-zinc-300 dark:text-zinc-600 mt-1">{model.id}</div>
    </button>
  );
}
