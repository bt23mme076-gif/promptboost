import { ApiResult, Platform } from "@/types";
import { IMPROVE_SYSTEM_PROMPT, IMPROVE_USER_TEMPLATE, TIMEOUT_MS } from "@/utils/constants";

export async function improveWithGemini(
  prompt: string,
  platform: Platform,
  apiKey: string,
  model: string,
  temperature: number
): Promise<ApiResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: IMPROVE_SYSTEM_PROMPT }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: IMPROVE_USER_TEMPLATE(prompt, platform) }],
          },
        ],
        generationConfig: {
          temperature,
          maxOutputTokens: 2048,
        },
      }),
    });

    clearTimeout(timer);

    if (response.status === 400 || response.status === 403) {
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
      candidates: Array<{
        content: { parts: Array<{ text: string }> };
      }>;
    };
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
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
