import { ApiResult } from "@/types";
import { IMPROVE_SYSTEM_PROMPT, IMPROVE_USER_TEMPLATE, TIMEOUT_MS } from "@/utils/constants";
import type { Platform } from "@/types";

export async function improveWithOpenAI(
  prompt: string,
  platform: Platform,
  apiKey: string,
  model: string,
  temperature: number
): Promise<ApiResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
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
      choices: Array<{ message: { content: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();
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
