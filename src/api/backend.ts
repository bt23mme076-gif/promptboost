import { ModeConfig } from "@/utils/promptModes";

export const BACKEND_URL = "https://apipromptboost.atyant.in";

export interface ModelOption {
  id: string;
  label: string;
  description: string;
  provider: "groq" | "openai" | "anthropic" | "deepseek" | "mistral" | "google" | "xai" | "moonshot" | "alibaba" | "openrouter";
  tier: "free" | "pro";
  badge?: string;
}

export const FREE_MODELS: ModelOption[] = [
  { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B",       description: "Strong reasoning & structure for prompt rewrites", provider: "groq", tier: "free", badge: "Popular" },
  { id: "openai/gpt-oss-20b",  label: "GPT-OSS 20B (Fast)", description: "Lightning-fast rewrites for quick iterations",     provider: "groq", tier: "free", badge: "Fast" },
  { id: "qwen/qwen3.8-27b",    label: "Qwen3 27B",          description: "Balanced open model for general-purpose rewrites", provider: "groq", tier: "free" },
];

export const PRO_MODELS: ModelOption[] = [
  { id: "gpt-5",                      label: "GPT-5",                description: "Best overall intelligence for nuanced reasoning and writing", provider: "openai",    tier: "pro", badge: "Best Overall" },
  { id: "claude-opus-4-1",           label: "Claude Opus 4.1",      description: "Deep analysis, synthesis, and high-quality writing",      provider: "anthropic", tier: "pro", badge: "Deep Analysis" },
  { id: "claude-sonnet-4",           label: "Claude Sonnet 4",      description: "Strong coding and prompt engineering performance",       provider: "anthropic", tier: "pro", badge: "Best Code" },
  { id: "gemini-2.5-pro",            label: "Gemini 2.5 Pro",       description: "Research-heavy workflows with long-context reasoning",  provider: "google",    tier: "pro", badge: "Long Context" },
  { id: "grok-4",                    label: "Grok 4",               description: "Creative ideation and fast reasoning",                  provider: "xai",       tier: "pro", badge: "Creative" },
  { id: "deepseek-r1",               label: "DeepSeek R1",          description: "Sharp logical reasoning and math-heavy problem solving", provider: "deepseek",  tier: "pro", badge: "Reasoning" },
  { id: "kimi-k2",                   label: "Kimi K2",              description: "Long-context coding and broad knowledge work",         provider: "moonshot",  tier: "pro", badge: "Coding" },
  { id: "qwen3-235b-a22b",           label: "Qwen3 235B",           description: "Open frontier model for ambitious research and generation", provider: "alibaba", tier: "pro", badge: "Open Frontier" },
  { id: "gpt-4o",                     label: "GPT-4o",                description: "OpenAI flagship multimodal intelligence model",         provider: "openai",    tier: "pro", badge: "Flagship" },
  { id: "o3-mini",                    label: "OpenAI o3-mini",        description: "Next-gen STEM & complex coding reasoning engine",       provider: "openai",    tier: "pro", badge: "Reasoning" },
  { id: "gpt-4o-mini",                label: "GPT-4o Mini",           description: "Compact & powerful model for general rewrites",        provider: "openai",    tier: "pro" },
  { id: "claude-3-7-sonnet-20250219",  label: "Claude 3.7 Sonnet",     description: "State-of-the-art creative writing & code refactoring", provider: "anthropic", tier: "pro", badge: "Best Code" },
  { id: "claude-3-5-haiku-20241022",   label: "Claude 3.5 Haiku",      description: "Blazing fast Claude model for concise rewrites",       provider: "anthropic", tier: "pro" },
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
