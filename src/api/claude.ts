import { ApiResult, Platform } from "@/types";
import { IMPROVE_SYSTEM_PROMPT, IMPROVE_USER_TEMPLATE, TIMEOUT_MS } from "@/utils/constants";

export async function improveWithClaude(
  prompt: string,
  platform: Platform,
  apiKey: string,
  model: string,
  temperature: number
): Promise<ApiResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        // Required for cross-origin requests from extensions
        "anthropic-dangerous-direct-browser-access": "true",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        temperature,
        system: IMPROVE_SYSTEM_PROMPT,
        messages: [
          { role: "user", content: IMPROVE_USER_TEMPLATE(prompt, platform) },
        ],
      }),
    });

    clearTimeout(timer);

    if (response.status === 401) {
      return { success: false, error: "Invalid API key.", errorCode: "INVALID_KEY" };
    }
    if (response.status === 429) {
      return { success: false, error: "Rate limit exceeded. Try again in a moment.", errorCode: "RATE_LIMIT" };
    }
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return {
        success: false,
        error: (body as { error?: { message?: string } }).error?.message ?? `API error ${response.status}`,
        errorCode: "UNKNOWN",
      };
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text: string }>;
    };
    const content = data.content?.find((c) => c.type === "text")?.text?.trim();
    if (!content) return { success: false, error: "Empty response from API.", errorCode: "UNKNOWN" };

    return { success: true, data: content };
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      return { success: false, error: "Request timed out. Check your connection.", errorCode: "TIMEOUT" };
    }
    return { success: false, error: "Network error. Check your internet connection.", errorCode: "NETWORK" };
  }
}
