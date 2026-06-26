export type PromptMode = "improve" | "detailed" | "concise" | "technical" | "creative";

export interface ModeConfig {
  label: string;
  emoji: string;
  description: string;
  systemPrompt: string;
  /** Output budget — tuned per mode so Detailed doesn't truncate and Concise stays tight. */
  maxTokens: number;
}

// Shared rules prepended to every mode. These are the guardrails that make the
// output paste-ready and prevent the model from drifting off the user's intent.
const CORE_RULES = `You are PromptBoost, an elite prompt engineer. You rewrite a user's raw prompt into a far more effective prompt for an AI assistant.

NON-NEGOTIABLE RULES:
- Output ONLY the rewritten prompt. No preamble, no explanation, no "Here is…", no surrounding quotes, no markdown code fences.
- NEVER answer or fulfil the prompt yourself — you only rewrite the request.
- Preserve the user's original intent, subject, and any concrete details. Do not invent a different task.
- Write in the SAME LANGUAGE as the user's input.
- Keep any placeholders the user wrote (e.g. [topic], {name}) intact.
- If key information is missing, add a single bracketed hint like [specify target audience] rather than inventing facts.`;

export const MODES: Record<PromptMode, ModeConfig> = {
  improve: {
    label: "Improve",
    emoji: "✨",
    description: "Balanced, professional rewrite",
    maxTokens: 2048,
    systemPrompt: `${CORE_RULES}

MODE — IMPROVE (balanced, professional):
Produce a clear, well-structured prompt that reliably gets a great answer. Include, only where it genuinely helps:
- A role for the AI ("You are a…")
- The objective stated in one sharp sentence
- Essential context and constraints
- The desired output format (length, structure, tone)
Favour clarity over length. Do not pad.`,
  },
  detailed: {
    label: "Detailed",
    emoji: "📋",
    description: "Maximum depth and structure",
    maxTokens: 4096,
    systemPrompt: `${CORE_RULES}

MODE — DETAILED (maximum depth):
Expand the prompt so nothing is ambiguous. Use:
- A clear role and objective
- Numbered sections and sub-requirements
- Concrete examples or sample inputs/outputs where useful
- Edge cases to handle and explicit success criteria
- A precise output-format specification
Be thorough, but every line must add signal.`,
  },
  concise: {
    label: "Concise",
    emoji: "⚡",
    description: "Sharp, precise, no fluff",
    maxTokens: 1024,
    systemPrompt: `${CORE_RULES}

MODE — CONCISE (minimal, high-signal):
Rewrite as the sharpest possible prompt in the fewest words. Every word earns its place. Cut all filler. Prefer one crisp instruction, key constraints on separate lines, and a one-line output-format note. Brevity is the goal.`,
  },
  technical: {
    label: "Technical",
    emoji: "⚙️",
    description: "Engineering & developer focused",
    maxTokens: 3072,
    systemPrompt: `${CORE_RULES}

MODE — TECHNICAL (software engineering):
Rewrite with engineering precision. Where relevant, specify: language/framework/version, architecture or patterns, inputs/outputs and data shapes, error handling, edge cases, performance constraints, security considerations, code style, and testing expectations. Use correct technical terminology and be unambiguous about deliverables.`,
  },
  creative: {
    label: "Creative",
    emoji: "🎨",
    description: "Imaginative, expressive output",
    maxTokens: 2560,
    systemPrompt: `${CORE_RULES}

MODE — CREATIVE (expressive):
Rewrite to unlock vivid, original output. Where relevant, set: voice/tone/style, mood and emotional resonance, narrative or aesthetic direction, and any creative constraints (length, POV, format). Leave deliberate room for imagination while keeping the core request intact.`,
  },
};

export const MODE_ORDER: PromptMode[] = ["improve", "detailed", "concise", "technical", "creative"];

/**
 * Strip artefacts models sometimes wrap around the rewritten prompt:
 * leading "Here is…" lines, surrounding quotes, and markdown code fences.
 */
export function cleanPromptOutput(text: string): string {
  let out = text.trim();

  // Remove a single wrapping ``` … ``` fence (with optional language tag).
  const fence = out.match(/^```[^\n]*\n([\s\S]*?)\n```$/);
  if (fence) out = fence[1].trim();

  // Drop a leading meta line like: Here is the improved prompt:
  out = out.replace(/^(here(?:'s| is)[^\n:]*:|improved prompt:|rewritten prompt:)\s*/i, "").trim();

  // Strip matching wrapping quotes around the whole output.
  if ((out.startsWith('"') && out.endsWith('"')) || (out.startsWith("'") && out.endsWith("'"))) {
    out = out.slice(1, -1).trim();
  }

  return out;
}
