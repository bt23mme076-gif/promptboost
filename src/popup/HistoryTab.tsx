import { useState } from "react";
import { Star, Copy, Check, Trash2, ChevronDown, FileText } from "lucide-react";
import { PLATFORM_LABELS, PromptHistoryItem } from "@/types";

interface HistoryTabProps {
  history: PromptHistoryItem[];
  favorites: PromptHistoryItem[];
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onClearAll: () => void;
  onCopy: (text: string, id: string) => void;
  copiedId: string | null;
}

export function HistoryTab({ history, favorites, onDelete, onToggleFavorite, onClearAll, onCopy, copiedId }: HistoryTabProps) {
  const [view, setView] = useState<"recent" | "favorites">("recent");
  const items = view === "favorites" ? favorites : history;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
        <div className="flex gap-1">
          {(["recent", "favorites"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                view === v
                  ? "bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300"
                  : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300"
              }`}
            >
              {v === "favorites" && <Star size={11} />}
              {v === "favorites" ? "Favorites" : "Recent"}
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

      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
        {items.length === 0 ? (
          <div className="py-10 text-center">
            {view === "favorites" ? <Star size={20} className="mx-auto mb-2 text-zinc-300 dark:text-zinc-700" /> : <FileText size={20} className="mx-auto mb-2 text-zinc-300 dark:text-zinc-700" />}
            <div className="text-xs text-zinc-400 dark:text-zinc-500">
              {view === "favorites" ? "No favorites yet" : "No history yet. Boost a prompt to get started."}
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
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 overflow-hidden">
      <button className="w-full text-left px-3 py-2.5" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-zinc-400 dark:text-zinc-500 mb-0.5">
              {PLATFORM_LABELS[item.platform]} · {formatTime(item.timestamp)}
            </div>
            <div className="text-xs text-zinc-700 dark:text-zinc-300 truncate font-medium">{item.original}</div>
          </div>
          <ChevronDown size={13} className={`mt-0.5 shrink-0 text-zinc-300 dark:text-zinc-600 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t border-zinc-100 dark:border-zinc-700">
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mt-2 mb-1">Improved prompt</div>
          <div className="text-xs text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-900 rounded-lg p-2.5 border border-zinc-100 dark:border-zinc-700 max-h-28 overflow-y-auto whitespace-pre-wrap leading-relaxed">
            {item.improved}
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <button
              onClick={() => onCopy(item.improved, item.id)}
              className="flex items-center gap-1 px-2 py-1 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 rounded-md text-[10px] font-medium hover:bg-brand-100 dark:hover:bg-brand-900/50 transition-colors"
            >
              {isCopied ? <Check size={11} /> : <Copy size={11} />}
              {isCopied ? "Copied" : "Copy"}
            </button>
            <button
              onClick={() => onToggleFavorite(item.id)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${
                item.favorited
                  ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                  : "bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-600"
              }`}
            >
              <Star size={11} fill={item.favorited ? "currentColor" : "none"} />
              {item.favorited ? "Saved" : "Save"}
            </button>
            <button
              onClick={() => onDelete(item.id)}
              className="ml-auto flex items-center gap-1 px-2 py-1 bg-red-50 dark:bg-red-950/30 text-red-500 dark:text-red-400 rounded-md text-[10px] font-medium hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors"
            >
              <Trash2 size={11} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
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
