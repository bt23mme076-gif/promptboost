import { ModeConfig } from "@/utils/promptModes";

export const BACKEND_URL = "https://apipromptboost.atyant.in";

export interface ModelOption {
  id: string;
  label: string;
  provider: string;
  tier: "free" | "pro";
}

export const FREE_MODELS: ModelOption[] = [
  { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B",       provider: "groq", tier: "free" },
  { id: "llama-3.1-8b-instant",    label: "Llama 3.1 8B (Fast)", provider: "groq", tier: "free" },
];

export const PRO_MODELS: ModelOption[] = [
  { id: "gpt-4o",                    label: "GPT-4o",             provider: "openai",    tier: "pro" },
  { id: "gpt-4o-mini",               label: "GPT-4o Mini",        provider: "openai",    tier: "pro" },
  { id: "claude-sonnet-4-6",         label: "Claude Sonnet 4.6",  provider: "anthropic", tier: "pro" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5",   provider: "anthropic", tier: "pro" },
];

export async function streamFromBackend(
  prompt: string,
  platform: string,
  mode: ModeConfig,
  context: string,
  model: string,
  licenseKey: string | null,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
) {
  const isPro = !!licenseKey;
  const endpoint = isPro ? `${BACKEND_URL}/api/improve/pro` : `${BACKEND_URL}/api/improve`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (isPro && licenseKey) headers["x-license-key"] = licenseKey;

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ prompt, platform, mode: mode.label.toLowerCase(), context, model }),
    });
  } catch {
    onError("Network error — check your connection.");
    return;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string; message?: string };
    onError(body.message ?? body.error ?? `Server error ${res.status}`);
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) { onError("No response stream"); return; }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") { onDone(); return; }
      try {
        const parsed = JSON.parse(payload) as { text?: string };
        if (parsed.text) onChunk(parsed.text);
      } catch { /* skip */ }
    }
  }
  onDone();
}
