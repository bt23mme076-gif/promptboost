import { Router } from "express";
import Groq from "groq-sdk";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { freeLimiter } from "../middleware/rateLimiter.js";
import { requireLicense } from "../middleware/auth.js";

const router = Router();

// ─── Model catalogue ──────────────────────────────────────────────────────────

export const FREE_MODELS = [
  { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B",      provider: "groq", tier: "free" },
  { id: "openai/gpt-oss-20b",  label: "GPT-OSS 20B (Fast)", provider: "groq", tier: "free" },
  { id: "qwen/qwen3.8-27b",    label: "Qwen3 27B",         provider: "groq", tier: "free" },
];

export const PRO_MODELS = [
  { id: "gpt-5",                      label: "GPT-5",                 provider: "openai",    tier: "pro" },
  { id: "claude-opus-4-1",           label: "Claude Opus 4.1",       provider: "anthropic", tier: "pro" },
  { id: "claude-sonnet-4",           label: "Claude Sonnet 4",       provider: "anthropic", tier: "pro" },
  { id: "gemini-2.5-pro",            label: "Gemini 2.5 Pro",        provider: "google",    tier: "pro" },
  { id: "grok-4",                    label: "Grok 4",                provider: "xai",       tier: "pro" },
  { id: "deepseek-r1",               label: "DeepSeek R1",           provider: "deepseek",  tier: "pro" },
  { id: "kimi-k2",                   label: "Kimi K2",               provider: "moonshot",  tier: "pro" },
  { id: "qwen3-235b-a22b",           label: "Qwen3 235B",            provider: "alibaba",   tier: "pro" },
  { id: "gpt-4o",                     label: "GPT-4o",                provider: "openai",    tier: "pro" },
  { id: "o3-mini",                    label: "OpenAI o3-mini",        provider: "openai",    tier: "pro" },
  { id: "gpt-4o-mini",                label: "GPT-4o Mini",           provider: "openai",    tier: "pro" },
  { id: "claude-3-7-sonnet-20250219",  label: "Claude 3.7 Sonnet",     provider: "anthropic", tier: "pro" },
  { id: "claude-3-5-haiku-20241022",   label: "Claude 3.5 Haiku",      provider: "anthropic", tier: "pro" },
];

export const ALL_MODELS = [...FREE_MODELS, ...PRO_MODELS];

// Groq-decommissioned model IDs that already-installed extension versions still
// send. Route them to the current default so old installs keep working until
// users update.
const DEFAULT_FREE_MODEL = "openai/gpt-oss-120b";
const LEGACY_FREE_MODELS = new Set([
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "mixtral-8x7b-32768",
  "deepseek-r1-distill-llama-70b",
]);

// ─── GET /models — return catalogue to extension ──────────────────────────────

router.get("/models", (req, res) => {
  res.json({ free: FREE_MODELS, pro: PRO_MODELS });
});

// ─── POST /improve (free) ─────────────────────────────────────────────────────

router.post("/improve", freeLimiter, async (req, res) => {
  const { prompt, platform, mode, context, model: requestedModel = DEFAULT_FREE_MODEL } = req.body;
  const model = LEGACY_FREE_MODELS.has(requestedModel) ? DEFAULT_FREE_MODEL : requestedModel;

  const modelMeta = FREE_MODELS.find((m) => m.id === model);
  if (!modelMeta) {
    return res.status(400).json({ error: "Invalid model for free tier", errorCode: "INVALID_MODEL" });
  }

  if (!prompt?.trim()) {
    return res.status(400).json({ error: "Prompt is required", errorCode: "NO_PROMPT" });
  }

  try {
    const { systemPrompt, userMessage } = buildMessages(prompt, platform, mode, context);
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    // Streaming response
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const stream = await groq.chat.completions.create({
      model,
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }],
      temperature: 0.7,
      max_tokens: 2000,
      stream: true,
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content ?? "";
      if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error("[free/improve]", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "AI request failed", errorCode: "AI_ERROR" });
    }
  }
});

// ─── POST /improve/pro (premium) ─────────────────────────────────────────────

router.post("/improve/pro", requireLicense, async (req, res) => {
  const { prompt, platform, mode, context, model = "gpt-4o" } = req.body;

  const modelMeta = PRO_MODELS.find((m) => m.id === model);
  if (!modelMeta) {
    return res.status(400).json({ error: "Invalid model for pro tier", errorCode: "INVALID_MODEL" });
  }

  if (!prompt?.trim()) {
    return res.status(400).json({ error: "Prompt is required", errorCode: "NO_PROMPT" });
  }

  try {
    const { systemPrompt, userMessage } = buildMessages(prompt, platform, mode, context);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    if (modelMeta.provider === "openai") {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const stream = await openai.chat.completions.create({
        model,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }],
        temperature: 0.7,
        max_tokens: 2000,
        stream: true,
      });
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? "";
        if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    } else if (modelMeta.provider === "anthropic") {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const stream = anthropic.messages.stream({
        model,
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      });
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
        }
      }
    } else {
      const openrouterApiKey = process.env.OPENROUTER_API_KEY;
      if (!openrouterApiKey) {
        throw new Error("OPENROUTER_API_KEY is not configured");
      }

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openrouterApiKey}`,
          "HTTP-Referer": "https://github.com/promptboost",
          "X-Title": "PromptBoost",
        },
        body: JSON.stringify({
          model,
          temperature: 0.7,
          max_tokens: 2000,
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }],
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error?.message || `OpenRouter error ${response.status}`);
      }

      const data = await response.json();
      const text = data?.choices?.[0]?.message?.content?.trim();
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error("[pro/improve]", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "AI request failed", errorCode: "AI_ERROR" });
    }
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MODE_PROMPTS = {
  improve:   "You are an expert prompt engineer. Rewrite the user's prompt to be clearer, more specific, and more likely to get an excellent AI response. Return only the improved prompt, no explanation.",
  detailed:  "You are an expert prompt engineer. Expand the user's prompt into a detailed, structured version with clear sections, specific requirements, examples where helpful, and explicit success criteria. Return only the improved prompt.",
  concise:   "You are an expert prompt engineer. Rewrite the user's prompt to be as sharp and concise as possible — every word must earn its place. Remove all filler. Return only the improved prompt.",
  technical: "You are an expert prompt engineer specialising in technical topics. Rewrite the user's prompt with engineering precision — specify stack, patterns, constraints, error handling, and edge cases where relevant. Return only the improved prompt.",
  creative:  "You are an expert prompt engineer specialising in creative work. Rewrite the user's prompt with rich creative direction — tone, voice, style, narrative approach, and aesthetic intent. Return only the improved prompt.",
};

function buildMessages(prompt, platform, mode, context) {
  const systemPrompt = MODE_PROMPTS[mode] ?? MODE_PROMPTS.improve;
  const platformNote = platform && platform !== "unknown" ? `\nPlatform context: ${platform}` : "";
  const contextNote = context ? `\n\nConversation context so far:\n${context}` : "";
  const userMessage = `Improve this prompt:${platformNote}${contextNote}\n\n${prompt}`;
  return { systemPrompt, userMessage };
}

export default router;
