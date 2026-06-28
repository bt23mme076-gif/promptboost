import { ExtensionMessage } from "@/types";
import { PromptMode, MODES } from "@/utils/promptModes";
import { streamFromBackend } from "@/api/backend";
import {
  getSettings, saveSettings, getHistory,
  addHistoryItem, deleteHistoryItem, toggleFavorite, clearHistory,
} from "@/storage";

// ─── Standard Message Router ──────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse).catch((err: unknown) => {
    sendResponse({ success: false, error: err instanceof Error ? err.message : "Unknown error" });
  });
  return true;
});

async function handleMessage(message: ExtensionMessage): Promise<unknown> {
  switch (message.type) {
    case "PING": return { success: true };
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

// ─── Streaming Port (content script → background → backend) ──────────────────

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "promptboost-stream") return;

  port.onMessage.addListener(async (msg: {
    type: string;
    payload: { prompt: string; platform: string; mode: PromptMode; context: string; model?: string };
  }) => {
    if (msg.type !== "STREAM_IMPROVE") return;

    const settings = await getSettings();
    const { prompt, platform, mode, context, model } = msg.payload;

    // Pick model: use payload model if provided, else default free model
    const selectedModel = model ?? "llama-3.3-70b-versatile";
    const modeConfig = MODES[mode] ?? MODES.improve;
    const licenseKey = (settings as { licenseKey?: string }).licenseKey ?? null;

    let fullText = "";

    await streamFromBackend(
      prompt, platform, modeConfig, context, selectedModel, licenseKey,
      (chunk) => {
        fullText += chunk;
        try { port.postMessage({ type: "chunk", data: chunk }); } catch { /* port closed */ }
      },
      () => {
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
  chrome.contextMenus.create({ id: "pb-improve",   title: "✨ Improve with PromptBoost", contexts: ["selection"] });
  chrome.contextMenus.create({ id: "pb-concise",   title: "⚡ Make Concise",             contexts: ["selection"] });
  chrome.contextMenus.create({ id: "pb-technical", title: "⚙️ Make Technical",            contexts: ["selection"] });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id || !info.selectionText) return;
  const modeMap: Record<string, PromptMode> = {
    "pb-improve": "improve", "pb-concise": "concise", "pb-technical": "technical",
  };
  const mode = modeMap[info.menuItemId as string];
  if (!mode) return;

  const settings = await getSettings();
  const licenseKey = (settings as { licenseKey?: string }).licenseKey ?? null;
  let result = "";

  await streamFromBackend(
    info.selectionText, "unknown", MODES[mode], "", "llama-3.3-70b-versatile", licenseKey,
    (chunk) => { result += chunk; },
    () => {
      chrome.tabs.sendMessage(tab.id!, {
        type: "CONTEXT_MENU_RESULT",
        payload: { improved: result, original: info.selectionText },
      }).catch(() => {});
    },
    (error) => {
      chrome.tabs.sendMessage(tab.id!, {
        type: "CONTEXT_MENU_RESULT",
        payload: { error, original: info.selectionText },
      }).catch(() => {});
    }
  );
});

// ─── Keyboard Shortcut ────────────────────────────────────────────────────────

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "improve-prompt") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "TRIGGER_IMPROVE" }).catch(() => {});
});

// ─── First Install — open options ─────────────────────────────────────────────

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("src/options/index.html") });
  }
});
