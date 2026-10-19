import { useState, useEffect } from "react";
import { Settings as SettingsIcon, Wand2, LayoutGrid, History as HistoryIcon, Sparkles } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { useHistory } from "@/hooks/useHistory";
import { Platform, PLATFORM_LABELS } from "@/types";
import { FREE_MODELS, PRO_MODELS } from "@/api/backend";
import { PromptTemplate } from "@/data/templates";
import { BoostTab } from "./BoostTab";
import { TemplatesTab } from "./TemplatesTab";
import { HistoryTab } from "./HistoryTab";

type Tab = "boost" | "templates" | "history";

export function Popup() {
  const { settings } = useSettings();
  const { history, deleteItem, toggleFavorite, clearAll, refresh } = useHistory();
  const [activeTab, setActiveTab] = useState<Tab>("boost");
  const [currentPlatform, setCurrentPlatform] = useState<Platform | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url ?? "";
      setCurrentPlatform(detectPlatformFromUrl(url));
    });
  }, []);

  const openOptions = () => chrome.runtime.openOptionsPage();

  const isPro = !!settings.licenseKey;
  const allModels = [...FREE_MODELS, ...PRO_MODELS];
  const modelLabel = allModels.find((m) => m.id === settings.model)?.label ?? settings.model;

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const useTemplate = (template: PromptTemplate) => {
    setDraft(template.prompt);
    setActiveTab("boost");
  };

  const goTo = (tab: Tab) => {
    setActiveTab(tab);
    if (tab === "history") refresh();
  };

  const recentHistory = history.slice(0, 8);
  const favorites = history.filter((h) => h.favorited);

  const TABS: { id: Tab; label: string; icon: typeof Wand2 }[] = [
    { id: "boost", label: "Boost", icon: Wand2 },
    { id: "templates", label: "Templates", icon: LayoutGrid },
    { id: "history", label: "History", icon: HistoryIcon },
  ];

  return (
    <div className={isDark ? "dark" : ""}>
      <div className="w-[400px] h-[560px] bg-zinc-50 dark:bg-zinc-950 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 pt-3.5 pb-3 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center shadow-sm shadow-brand-500/30">
                <Sparkles size={15} className="text-white" strokeWidth={2.25} />
              </div>
              <div>
                <div className="text-sm font-bold text-zinc-900 dark:text-zinc-50 leading-none tracking-tight">PromptBoost</div>
                <div className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                  {isPro ? `Pro · ${modelLabel}` : `Free · ${modelLabel}`}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {!isPro && (
                <button
                  onClick={() => chrome.tabs.create({ url: "https://wa.me/919753324876?text=Hi%2C%20I%20want%20to%20upgrade%20to%20PromptBoost%20Pro" })}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-brand-600 hover:bg-brand-700 transition-colors"
                >
                  Upgrade
                </button>
              )}
              <button
                onClick={openOptions}
                className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 dark:text-zinc-500 transition-colors"
                title="Settings"
              >
                <SettingsIcon size={15} />
              </button>
            </div>
          </div>

          {currentPlatform && currentPlatform !== "unknown" && (
            <div className="flex items-center gap-1.5 mt-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Active on <span className="font-medium text-zinc-700 dark:text-zinc-300">{PLATFORM_LABELS[currentPlatform]}</span>
              </span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => goTo(id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors border-b-2 ${
                activeTab === id
                  ? "text-brand-600 dark:text-brand-400 border-brand-600 dark:border-brand-400"
                  : "text-zinc-400 dark:text-zinc-500 border-transparent hover:text-zinc-600 dark:hover:text-zinc-300"
              }`}
            >
              <Icon size={13} />
              {label}
              {id === "history" && history.length > 0 && (
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{history.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === "boost" && (
          <BoostTab draft={draft} onDraftChange={setDraft} settings={settings} onBoosted={refresh} />
        )}
        {activeTab === "templates" && <TemplatesTab onUse={useTemplate} />}
        {activeTab === "history" && (
          <HistoryTab
            history={recentHistory}
            favorites={favorites}
            onDelete={deleteItem}
            onToggleFavorite={toggleFavorite}
            onClearAll={clearAll}
            onCopy={copyToClipboard}
            copiedId={copiedId}
          />
        )}

        {/* Shortcut hint */}
        <div className="py-1.5 text-center border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
          <span className="text-[10px] text-zinc-300 dark:text-zinc-600">
            Shortcut: <kbd className="font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-1 py-0.5 rounded text-[9px]">Ctrl+Shift+P</kbd>
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function detectPlatformFromUrl(url: string): Platform {
  if (url.includes("chatgpt.com") || url.includes("chat.openai.com")) return "chatgpt";
  if (url.includes("claude.ai")) return "claude";
  if (url.includes("gemini.google.com") || url.includes("bard.google.com")) return "gemini";
  if (url.includes("copilot.microsoft.com") || url.includes("bing.com/chat")) return "copilot";
  if (url.includes("perplexity.ai")) return "perplexity";
  if (url.includes("grok.com") || url.includes("x.com/i/grok")) return "grok";
  if (url.includes("lovable.dev")) return "lovable";
  if (url.includes("bolt.new")) return "bolt";
  if (url.includes("v0.dev")) return "v0";
  if (url.includes("cursor.com") || url.includes("cursor.sh")) return "cursor";
  return "unknown";
}
