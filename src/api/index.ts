import { ApiResult, Platform, Settings } from "@/types";
import { MAX_PROMPT_LENGTH } from "@/utils/constants";
import { PromptMode, MODES } from "@/utils/promptModes";
import { improveWithGroq, streamImproveWithGroq } from "./groq";

export async function improvePrompt(
  prompt: string,
  platform: Platform,
  settings: Settings,
  mode: PromptMode = "improve",
  context = ""
): Promise<ApiResult> {
  if (!prompt.trim()) return { success: false, error: "Prompt is empty.", errorCode: "UNKNOWN" };
  if (prompt.length > MAX_PROMPT_LENGTH)
    return { success: false, error: `Prompt too long (max ${MAX_PROMPT_LENGTH.toLocaleString()} chars).`, errorCode: "UNKNOWN" };
  if (!settings.groqKey)
    return { success: false, error: "No Groq API key. Open PromptBoost settings.", errorCode: "NO_API_KEY" };

  return improveWithGroq(prompt, platform, settings.groqKey, settings.model, settings.temperature, MODES[mode], context);
}

export async function streamImprovePrompt(
  prompt: string,
  platform: Platform,
  settings: Settings,
  mode: PromptMode,
  context: string,
  onChunk: (text: string) => void,
  onDone: (fullText: string) => void,
  onError: (err: string) => void
): Promise<void> {
  if (!settings.groqKey) { onError("No Groq API key. Open PromptBoost settings."); return; }
  if (!prompt.trim()) { onError("Prompt is empty."); return; }

  return streamImproveWithGroq(
    prompt, platform, settings.groqKey, settings.model,
    settings.temperature, MODES[mode], context,
    onChunk, onDone, onError
  );
}
