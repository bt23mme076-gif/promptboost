import { ApiResult, Platform } from "@/types";
import { TIMEOUT_MS } from "@/utils/constants";
import { ModeConfig, cleanPromptOutput } from "@/utils/promptModes";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// Neutral framing: the active mode's system prompt fully controls style/length,
// so the user message must NOT bias toward any one mode (e.g. "detailed").
function buildUserMessage(prompt: string, platform: string, context: string): string {
  return `Rewrite the following prompt. It will be sent to the "${platform}" AI assistant.

<original_prompt>
${prompt}
</original_prompt>${context}`;
}

// ─── Non-streaming (for background service worker) ────────────────────────────

export async function improveWithGroq(
  prompt: string,
  platform: Platform,
  apiKey: string,
  model: string,
  temperature: number,
  mode: ModeConfig,
  context = ""
): Promise<ApiResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: mode.maxTokens,
        stream: false,
        messages: [
          { role: "system", content: mode.systemPrompt },
          { role: "user", content: buildUserMessage(prompt, platform, context) },
        ],
      }),
    });

    clearTimeout(timer);

    if (response.status === 401) return { success: false, error: "Invalid Groq API key.", errorCode: "INVALID_KEY" };
    if (response.status === 429) return { success: false, error: "Rate limit hit. Wait a moment.", errorCode: "RATE_LIMIT" };
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return {
        success: false,
        error: (body as { error?: { message?: string } }).error?.message ?? `Groq error ${response.status}`,
        errorCode: "UNKNOWN",
      };
    }

    const data = (await response.json()) as { choices: Array<{ message: { content: string } }> };
    const content = cleanPromptOutput(data.choices?.[0]?.message?.content ?? "");
    if (!content) return { success: false, error: "Empty response. Retry.", errorCode: "UNKNOWN" };
    return { success: true, data: content };
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError")
      return { success: false, error: "Request timed out.", errorCode: "TIMEOUT" };
    return { success: false, error: "Network error.", errorCode: "NETWORK" };
  }
}

// ─── Streaming (called from background via port connection) ──────────────────

export async function streamImproveWithGroq(
  prompt: string,
  platform: Platform,
  apiKey: string,
  model: string,
  temperature: number,
  mode: ModeConfig,
  context: string,
  onChunk: (text: string) => void,
  onDone: (fullText: string) => void,
  onError: (err: string) => void
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
    onError("Request timed out.");
  }, TIMEOUT_MS);

  try {
    const response = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: mode.maxTokens,
        stream: true,
        messages: [
          { role: "system", content: mode.systemPrompt },
          { role: "user", content: buildUserMessage(prompt, platform, context) },
        ],
      }),
    });

    clearTimeout(timer);

    if (response.status === 401) { onError("Invalid Groq API key."); return; }
    if (response.status === 429) { onError("Rate limit hit. Wait a moment."); return; }
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      onError((body as { error?: { message?: string } }).error?.message ?? `Groq error ${response.status}`);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) { onError("Streaming not supported."); return; }

    const decoder = new TextDecoder();
    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const raw = decoder.decode(value, { stream: true });
      const lines = raw.split("\n");

      for (const line of lines) {
        const stripped = line.replace(/^data: /, "").trim();
        if (!stripped || stripped === "[DONE]") continue;
        try {
          const parsed = JSON.parse(stripped) as { choices: Array<{ delta: { content?: string } }> };
          const chunk = parsed.choices?.[0]?.delta?.content ?? "";
          if (chunk) {
            fullText += chunk;
            onChunk(chunk);
          }
        } catch {
          // skip malformed SSE line
        }
      }
    }

    onDone(cleanPromptOutput(fullText));
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name !== "AbortError") {
      onError("Network error.");
    }
  }
}
