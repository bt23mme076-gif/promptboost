import { ExtensionMessage, ApiResult } from "@/types";
import { PromptMode } from "@/utils/promptModes";
import { improvePrompt, streamImprovePrompt } from "@/api";
import {
  getSettings, saveSettings, getHistory,
  addHistoryItem, deleteHistoryItem, toggleFavorite, clearHistory,
} from "@/storage";

// ─── Standard Message Router ───────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse).catch((err: unknown) => {
    sendResponse({ success: false, error: err instanceof Error ? err.message : "Unknown error" });
  });
  return true;
});

async function handleMessage(message: ExtensionMessage): Promise<unknown> {
  switch (message.type) {
    case "PING": return { success: true };
    case "IMPROVE_PROMPT": {
      const settings = await getSettings();
      const result: ApiResult = await improvePrompt(
        message.payload.prompt, message.payload.platform, settings,
        (message.payload as { mode?: PromptMode }).mode ?? "improve",
        (message.payload as { context?: string }).context ?? ""
      );
      if (result.success && result.data) {
        addHistoryItem({
          original: message.payload.prompt,
          improved: result.data,
          platform: message.payload.platform,
          favorited: false,
        }).catch(console.error);
      }
      return result;
    }
    case "GET_SETTINGS": return { success: true, data: await getSettings() };
    case "SAVE_SETTINGS": await saveSettings(message.payload); return { success: true };
    case "GET_HISTORY": return { success: true, data: await getHistory() };
    case "ADD_HISTORY": return { success: true, data: await addHistoryItem(message.payload) };
    case "DELETE_HISTORY_ITEM": await deleteHistoryItem(message.payload.id); return { success: true };
    case "TOGGLE_FAVORITE": await toggleFavorite(message.payload.id); return { success: true };
    case "CLEAR_HISTORY": await clearHistory(); return { success: true };
    default: return { success: false, error: "Unknown message type" };
  }
}

// ─── Streaming Port Connection ────────────────────────────────────────────────

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "promptboost-stream") return;

  port.onMessage.addListener(async (msg: {
    type: string;
    payload: { prompt: string; platform: string; mode: PromptMode; context: string };
  }) => {
    if (msg.type !== "STREAM_IMPROVE") return;

    const settings = await getSettings();
    const { prompt, platform, mode, context } = msg.payload;

    if (!settings.groqKey) {
      port.postMessage({ type: "error", error: "No Groq API key. Open PromptBoost settings." });
      return;
    }

    await streamImprovePrompt(
      prompt,
      platform as Parameters<typeof streamImprovePrompt>[1],
      settings,
      mode,
      context,
      (chunk) => {
        try { port.postMessage({ type: "chunk", data: chunk }); } catch { /* port closed */ }
      },
      (fullText) => {
        // Save to history
        addHistoryItem({
          original: prompt,
          improved: fullText,
          platform: platform as Parameters<typeof addHistoryItem>[0]["platform"],
          favorited: false,
        }).catch(console.error);
        try { port.postMessage({ type: "done", data: fullText }); } catch { /* port closed */ }
      },
      (error) => {
        try { port.postMessage({ type: "error", error }); } catch { /* port closed */ }
      }
    );
  });
});

// ─── Context Menu ─────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "promptboost-improve",
    title: "✨ Improve with PromptBoost",
    contexts: ["selection"],
  });

  chrome.contextMenus.create({
    id: "promptboost-concise",
    title: "⚡ Make Concise",
    contexts: ["selection"],
  });

  chrome.contextMenus.create({
    id: "promptboost-technical",
    title: "⚙️ Make Technical",
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id || !info.selectionText) return;

  const modeMap: Record<string, PromptMode> = {
    "promptboost-improve": "improve",
    "promptboost-concise": "concise",
    "promptboost-technical": "technical",
  };

  const mode = modeMap[info.menuItemId as string];
  if (!mode) return;

  const settings = await getSettings();
  const result = await improvePrompt(info.selectionText, "unknown", settings, mode);

  chrome.tabs.sendMessage(tab.id, {
    type: "CONTEXT_MENU_RESULT",
    payload: { improved: result.data, error: result.error, original: info.selectionText },
  }).catch(() => {});
});

// ─── Keyboard Shortcut ────────────────────────────────────────────────────────

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "improve-prompt") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  chrome.tabs.sendMessage(tab.id, { type: "TRIGGER_IMPROVE" }).catch(() => {});
});

// ─── First Install ────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("src/options/index.html") });
  }
});
