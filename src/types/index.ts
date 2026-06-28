// ─── Platform Detection ────────────────────────────────────────────────────────

export type Platform =
  | "chatgpt" | "claude" | "gemini" | "copilot" | "perplexity"
  | "grok" | "lovable" | "bolt" | "v0" | "cursor" | "unknown";

export const PLATFORM_LABELS: Record<Platform, string> = {
  chatgpt: "ChatGPT", claude: "Claude", gemini: "Gemini",
  copilot: "Microsoft Copilot", perplexity: "Perplexity",
  grok: "Grok", lovable: "Lovable", bolt: "Bolt", v0: "v0",
  cursor: "Cursor", unknown: "Unknown",
};

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface Settings {
  licenseKey: string;      // empty = free tier
  model: string;           // selected model id
  shortcutEnabled: boolean;
  showHistory: boolean;
  maxHistoryItems: number;
}

export const DEFAULT_SETTINGS: Settings = {
  licenseKey: "",
  model: "llama-3.3-70b-versatile",
  shortcutEnabled: true,
  showHistory: true,
  maxHistoryItems: 50,
};

// ─── Groq Models (all free, current production lineup) ────────────────────────
// Verified against console.groq.com/docs/models. Preview-only and decommissioned
// models (e.g. mixtral-8x7b-32768, gemma2-9b-it) are intentionally excluded —
// selecting them returns a hard 400/404 from the API.

export const GROQ_MODELS = [
  {
    value: "llama-3.3-70b-versatile",
    label: "Llama 3.3 70B — Best quality",
    note: "Sharpest rewrites · 280 tok/s",
    recommended: true,
  },
  {
    value: "openai/gpt-oss-120b",
    label: "GPT-OSS 120B — Best reasoning",
    note: "Strong structure · 500 tok/s",
    recommended: false,
  },
  {
    value: "openai/gpt-oss-20b",
    label: "GPT-OSS 20B — Balanced",
    note: "Great quality/speed · 1000 tok/s",
    recommended: false,
  },
  {
    value: "llama-3.1-8b-instant",
    label: "Llama 3.1 8B — Fastest",
    note: "Instant · 560 tok/s",
    recommended: false,
  },
] as const;

export const VALID_GROQ_MODELS: readonly string[] = GROQ_MODELS.map((m) => m.value);

// ─── History ──────────────────────────────────────────────────────────────────

export interface PromptHistoryItem {
  id: string;
  original: string;
  improved: string;
  timestamp: number;
  platform: Platform;
  favorited: boolean;
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export type MessageType =
  | "IMPROVE_PROMPT" | "GET_SETTINGS" | "SAVE_SETTINGS" | "GET_HISTORY"
  | "ADD_HISTORY" | "CLEAR_HISTORY" | "DELETE_HISTORY_ITEM" | "TOGGLE_FAVORITE"
  | "PING" | "TRIGGER_IMPROVE" | "CONTEXT_MENU_RESULT";

export interface BaseMessage { type: MessageType; }

export interface ImprovePromptMessage extends BaseMessage {
  type: "IMPROVE_PROMPT";
  payload: { prompt: string; platform: Platform; mode?: string; context?: string };
}
export interface SaveSettingsMessage extends BaseMessage {
  type: "SAVE_SETTINGS";
  payload: Partial<Settings>;
}
export interface AddHistoryMessage extends BaseMessage {
  type: "ADD_HISTORY";
  payload: Omit<PromptHistoryItem, "id" | "timestamp">;
}
export interface DeleteHistoryMessage extends BaseMessage {
  type: "DELETE_HISTORY_ITEM";
  payload: { id: string };
}
export interface ToggleFavoriteMessage extends BaseMessage {
  type: "TOGGLE_FAVORITE";
  payload: { id: string };
}

export type ExtensionMessage =
  | ImprovePromptMessage | SaveSettingsMessage | AddHistoryMessage
  | DeleteHistoryMessage | ToggleFavoriteMessage
  | { type: "GET_SETTINGS" | "GET_HISTORY" | "CLEAR_HISTORY" | "PING" };

// ─── API Result ───────────────────────────────────────────────────────────────

export interface ApiResult {
  success: boolean;
  data?: string;
  error?: string;
  errorCode?: "NO_API_KEY" | "INVALID_KEY" | "RATE_LIMIT" | "TIMEOUT" | "NETWORK" | "UNKNOWN";
}
