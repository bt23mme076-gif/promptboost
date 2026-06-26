import { useState, useEffect } from "react";
import { useSettings } from "@/hooks/useSettings";
import { useHistory } from "@/hooks/useHistory";
import { Platform, PLATFORM_LABELS, PromptHistoryItem, GROQ_MODELS } from "@/types";

type Tab = "home" | "history";

export function Popup() {
  const { settings } = useSettings();
  const { history, deleteItem, toggleFavorite, clearAll } = useHistory();
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [currentPlatform, setCurrentPlatform] = useState<Platform | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Detect dark mode
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Detect platform from active tab
  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url ?? "";
      setCurrentPlatform(detectPlatformFromUrl(url));
    });
  }, []);

  const openOptions = () => chrome.runtime.openOptionsPage();

  const isConfigured = !!settings.groqKey;
  const modelLabel = GROQ_MODELS.find((m) => m.value === settings.model)?.label ?? settings.model;

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const recentHistory = history.slice(0, 8);
  const favorites = history.filter((h) => h.favorited);

  return (
    <div className={isDark ? "dark" : ""}>
      <div className="w-[360px] min-h-[400px] bg-white dark:bg-zinc-900 flex flex-col">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-sm">
                <span className="text-white text-sm font-bold">✨</span>
              </div>
              <div>
                <div className="text-sm font-bold text-zinc-900 dark:text-zinc-50 leading-none">
                  PromptBoost
                </div>
                <div className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                  AI Prompt Engineer
                </div>
              </div>
            </div>
            <button
              onClick={openOptions}
              className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 dark:text-zinc-500 transition-colors"
              title="Settings"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-100 dark:border-zinc-800">
          {(["home", "history"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-xs font-semibold transition-colors capitalize ${
                activeTab === tab
                  ? "text-violet-600 dark:text-violet-400 border-b-2 border-violet-600 dark:border-violet-400"
                  : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300"
              }`}
            >
              {tab === "history" ? `History (${history.length})` : "Home"}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === "home" ? (
          <div className="flex-1 p-4 flex flex-col gap-3">
            {/* Status card */}
            <div className={`rounded-xl p-3 flex items-center gap-3 ${
              isConfigured
                ? "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900"
                : "bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900"
            }`}>
              <div className={`w-2 h-2 rounded-full ${isConfigured ? "bg-emerald-500" : "bg-amber-500"}`} />
              <div className="flex-1 min-w-0">
                <div className={`text-xs font-semibold ${
                  isConfigured ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"
                }`}>
                  {isConfigured ? "Connected" : "Setup required"}
                </div>
                <div className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate mt-0.5">
                  {isConfigured
                    ? `Groq · ${modelLabel}`
                    : "Add Groq API key to get started"}
                </div>
              </div>
            </div>

            {/* Platform badge */}
            {currentPlatform && currentPlatform !== "unknown" && (
              <div className="flex items-center gap-2 px-3 py-2 bg-violet-50 dark:bg-violet-950/40 rounded-xl border border-violet-100 dark:border-violet-900">
                <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
                <span className="text-xs text-violet-700 dark:text-violet-300 font-medium">
                  Active on {PLATFORM_LABELS[currentPlatform]}
                </span>
              </div>
            )}

            {/* Not configured CTA */}
            {!isConfigured && (
              <button
                onClick={openOptions}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-violet-600 to-purple-700 text-white text-sm font-semibold rounded-xl hover:from-violet-700 hover:to-purple-800 transition-all shadow-sm hover:shadow-md"
              >
                Add API Key →
              </button>
            )}

            {/* Quick actions */}
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                onClick={openOptions}
                className="flex items-center gap-2 px-3 py-2.5 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-xl text-xs font-medium text-zinc-700 dark:text-zinc-300 transition-colors border border-zinc-200 dark:border-zinc-700"
              >
                <span>⚙️</span> Settings
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className="flex items-center gap-2 px-3 py-2.5 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-xl text-xs font-medium text-zinc-700 dark:text-zinc-300 transition-colors border border-zinc-200 dark:border-zinc-700"
              >
                <span>🕐</span> History
              </button>
            </div>

            {/* Shortcut hint */}
            <div className="mt-auto pt-2 text-center">
              <span className="text-[10px] text-zinc-300 dark:text-zinc-600">
                Shortcut: <kbd className="font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-1 py-0.5 rounded text-[9px]">Ctrl+Shift+P</kbd>
              </span>
            </div>
          </div>
        ) : (
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
      </div>
    </div>
  );
}

// ─── History Tab ───────────────────────────────────────────────────────────────

interface HistoryTabProps {
  history: PromptHistoryItem[];
  favorites: PromptHistoryItem[];
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onClearAll: () => void;
  onCopy: (text: string, id: string) => void;
  copiedId: string | null;
}

function HistoryTab({ history, favorites, onDelete, onToggleFavorite, onClearAll, onCopy, copiedId }: HistoryTabProps) {
  const [view, setView] = useState<"recent" | "favorites">("recent");
  const items = view === "favorites" ? favorites : history;

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex gap-1">
          {(["recent", "favorites"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors capitalize ${
                view === v
                  ? "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300"
                  : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300"
              }`}
            >
              {v === "favorites" ? `★ Favorites` : "Recent"}
            </button>
          ))}
        </div>
        {history.length > 0 && (
          <button
            onClick={onClearAll}
            className="text-[10px] text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2 max-h-[320px]">
        {items.length === 0 ? (
          <div className="py-8 text-center">
            <div className="text-2xl mb-2">{view === "favorites" ? "★" : "📝"}</div>
            <div className="text-xs text-zinc-400 dark:text-zinc-500">
              {view === "favorites" ? "No favorites yet" : "No history yet. Improve a prompt to get started."}
            </div>
          </div>
        ) : (
          items.map((item) => (
            <HistoryCard
              key={item.id}
              item={item}
              onDelete={onDelete}
              onToggleFavorite={onToggleFavorite}
              onCopy={onCopy}
              isCopied={copiedId === item.id}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── History Card ──────────────────────────────────────────────────────────────

interface HistoryCardProps {
  item: PromptHistoryItem;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onCopy: (text: string, id: string) => void;
  isCopied: boolean;
}

function HistoryCard({ item, onDelete, onToggleFavorite, onCopy, isCopied }: HistoryCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 overflow-hidden">
      <button
        className="w-full text-left px-3 py-2.5"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-zinc-400 dark:text-zinc-500 mb-0.5">
              {PLATFORM_LABELS[item.platform]} · {formatTime(item.timestamp)}
            </div>
            <div className="text-xs text-zinc-700 dark:text-zinc-300 truncate font-medium">
              {item.original}
            </div>
          </div>
          <span className="text-zinc-300 dark:text-zinc-600 text-[10px] mt-0.5 shrink-0">
            {expanded ? "▲" : "▼"}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t border-zinc-100 dark:border-zinc-700">
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mt-2 mb-1">
            Improved prompt
          </div>
          <div className="text-xs text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 rounded-lg p-2.5 border border-zinc-100 dark:border-zinc-700 max-h-28 overflow-y-auto whitespace-pre-wrap leading-relaxed">
            {item.improved}
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <button
              onClick={() => onCopy(item.improved, item.id)}
              className="flex items-center gap-1 px-2 py-1 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded-lg text-[10px] font-medium hover:bg-violet-200 dark:hover:bg-violet-900/50 transition-colors"
            >
              {isCopied ? "✓ Copied" : "📋 Copy"}
            </button>
            <button
              onClick={() => onToggleFavorite(item.id)}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors ${
                item.favorited
                  ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                  : "bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-600"
              }`}
            >
              {item.favorited ? "★ Saved" : "☆ Save"}
            </button>
            <button
              onClick={() => onDelete(item.id)}
              className="ml-auto flex items-center gap-1 px-2 py-1 bg-red-50 dark:bg-red-950/30 text-red-500 dark:text-red-400 rounded-lg text-[10px] font-medium hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors"
            >
              🗑
            </button>
          </div>
        </div>
      )}
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


function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return d.toLocaleDateString();
}
