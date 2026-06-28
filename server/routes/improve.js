import { Router } from "express";
import Groq from "groq-sdk";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { freeLimiter } from "../middleware/rateLimiter.js";
import { requireLicense } from "../middleware/auth.js";

const router = Router();

// ─── Model catalogue ──────────────────────────────────────────────────────────

export const FREE_MODELS = [
  { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B", provider: "groq", tier: "free" },
  { id: "llama-3.1-8b-instant",    label: "Llama 3.1 8B (Fast)", provider: "groq", tier: "free" },
];

export const PRO_MODELS = [
  { id: "gpt-4o",                  label: "GPT-4o",            provider: "openai",     tier: "pro" },
  { id: "gpt-4o-mini",             label: "GPT-4o Mini",       provider: "openai",     tier: "pro" },
  { id: "claude-sonnet-4-6",       label: "Claude Sonnet 4.6", provider: "anthropic",  tier: "pro" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", provider: "anthropic", tier: "pro" },
];

export const ALL_MODELS = [...FREE_MODELS, ...PRO_MODELS];

// ─── GET /models — return catalogue to extension ──────────────────────────────

router.get("/models", (req, res) => {
  res.json({ free: FREE_MODELS, pro: PRO_MODELS });
});

// ─── POST /improve (free) ─────────────────────────────────────────────────────

router.post("/improve", freeLimiter, async (req, res) => {
  const { prompt, platform, mode, context, model = "llama-3.3-70b-versatile" } = req.body;

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
