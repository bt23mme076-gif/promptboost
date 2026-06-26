import { Settings, DEFAULT_SETTINGS, PromptHistoryItem, VALID_GROQ_MODELS } from "@/types";
import { STORAGE_KEYS } from "@/utils/constants";
import { encryptApiKey, decryptApiKey } from "@/utils/encryption";

export async function getSettings(): Promise<Settings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(STORAGE_KEYS.SETTINGS, async (result) => {
      const raw = result[STORAGE_KEYS.SETTINGS] as Partial<Settings> | undefined;
      if (!raw) { resolve(DEFAULT_SETTINGS); return; }

      // Migrate: decommissioned/preview models (mixtral, gemma2, OpenRouter slugs)
      // are auto-reset to the default so the user never hits a dead-model error.
      const model =
        raw.model && VALID_GROQ_MODELS.includes(raw.model)
          ? raw.model
          : DEFAULT_SETTINGS.model;

      const settings: Settings = {
        ...DEFAULT_SETTINGS,
        ...raw,
        model,
        groqKey: raw.groqKey ? await decryptApiKey(raw.groqKey) : "",
      };
      resolve(settings);
    });
  });
}

export async function saveSettings(updates: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  const merged: Settings = { ...current, ...updates };
  const toStore: Settings = {
    ...merged,
    groqKey: merged.groqKey ? await encryptApiKey(merged.groqKey) : "",
  };
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set({ [STORAGE_KEYS.SETTINGS]: toStore }, () => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve();
    });
  });
}

export async function resetSettings(): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.remove(STORAGE_KEYS.SETTINGS, () => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve();
    });
  });
}

export async function getHistory(): Promise<PromptHistoryItem[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEYS.HISTORY, (result) => {
      resolve((result[STORAGE_KEYS.HISTORY] as PromptHistoryItem[]) ?? []);
    });
  });
}

export async function addHistoryItem(
  item: Omit<PromptHistoryItem, "id" | "timestamp">
): Promise<PromptHistoryItem> {
  const history = await getHistory();
  const settings = await getSettings();
  const newItem: PromptHistoryItem = { ...item, id: crypto.randomUUID(), timestamp: Date.now() };
  const updated = [newItem, ...history].slice(0, settings.maxHistoryItems);
  await new Promise<void>((resolve, reject) => {
    chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: updated }, () => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve();
    });
  });
  return newItem;
}

export async function deleteHistoryItem(id: string): Promise<void> {
  const history = await getHistory();
  const updated = history.filter((item) => item.id !== id);
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: updated }, () => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve();
    });
  });
}

export async function toggleFavorite(id: string): Promise<void> {
  const history = await getHistory();
  const updated = history.map((item) =>
    item.id === id ? { ...item, favorited: !item.favorited } : item
  );
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: updated }, () => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve();
    });
  });
}

export async function clearHistory(): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(STORAGE_KEYS.HISTORY, () => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve();
    });
  });
}

export async function exportHistory(): Promise<string> {
  return JSON.stringify(await getHistory(), null, 2);
}

export async function importHistory(json: string): Promise<void> {
  const parsed = JSON.parse(json) as PromptHistoryItem[];
  if (!Array.isArray(parsed)) throw new Error("Invalid format");
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: parsed }, () => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve();
    });
  });
}
