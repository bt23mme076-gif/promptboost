import { ApiResult, Platform } from "@/types";
import { IMPROVE_SYSTEM_PROMPT, IMPROVE_USER_TEMPLATE, TIMEOUT_MS } from "@/utils/constants";

export async function improveWithOpenRouter(
  prompt: string,
  platform: Platform,
  apiKey: string,
  model: string,
  temperature: number
): Promise<ApiResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        // OpenRouter requires these for free tier access
        "HTTP-Referer": "https://github.com/promptboost",
        "X-Title": "PromptBoost",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: 2048,
        messages: [
          { role: "system", content: IMPROVE_SYSTEM_PROMPT },
          { role: "user", content: IMPROVE_USER_TEMPLATE(prompt, platform) },
        ],
      }),
    });

    clearTimeout(timer);

    if (response.status === 401) {
      return {
        success: false,
        error: "Invalid OpenRouter API key. Check your key at openrouter.ai/keys",
        errorCode: "INVALID_KEY",
      };
    }
    if (response.status === 429) {
      return {
        success: false,
        error: "Rate limit hit. Free tier has limits — wait a moment and retry.",
        errorCode: "RATE_LIMIT",
      };
    }
    if (response.status === 402) {
      return {
        success: false,
        error: "No credits. Switch to a free model (marked :free) or add credits at openrouter.ai",
        errorCode: "UNKNOWN",
      };
    }
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return {
        success: false,
        error:
          (body as { error?: { message?: string } }).error?.message ??
          `OpenRouter error ${response.status}`,
        errorCode: "UNKNOWN",
      };
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
      error?: { message: string };
    };

    // OpenRouter sometimes returns 200 with an error body
    if (data.error) {
      return { success: false, error: data.error.message, errorCode: "UNKNOWN" };
    }

    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return { success: false, error: "Empty response. The model may be overloaded — retry.", errorCode: "UNKNOWN" };
    }

    return { success: true, data: content };
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      return {
        success: false,
        error: "Request timed out. Free models can be slow — try again.",
        errorCode: "TIMEOUT",
      };
    }
    return {
      success: false,
      error: "Network error. Check your internet connection.",
      errorCode: "NETWORK",
    };
  }
}
