import { PromptMode } from "@/utils/promptModes";

// Shared tone/length vocabulary used by both the popup's Boost tab and the
// on-page boost panel injected into the composer — kept in one place so the
// two surfaces can never drift out of sync.

export const TONES = ["Professional", "Casual", "Persuasive", "Confident", "Friendly", "Concise"] as const;
export type Tone = (typeof TONES)[number];

export const LENGTHS: { id: "short" | "medium" | "long"; label: string }[] = [
  { id: "short", label: "Short" },
  { id: "medium", label: "Medium" },
  { id: "long", label: "Long" },
];
export type Length = "short" | "medium" | "long";

export const DEFAULT_TONE: Tone = "Professional";
export const DEFAULT_LENGTH: Length = "medium";

export interface BoostOptions {
  mode: PromptMode;
  tone: Tone;
  length: Length;
  variations: boolean;
}

export interface VariationResult {
  text: string;
  done: boolean;
  error: string | null;
}

/** Only worth appending when the user actually moved off the neutral defaults. */
export function buildStyleContext(tone: Tone, length: Length): string | undefined {
  if (tone === DEFAULT_TONE && length === DEFAULT_LENGTH) return undefined;
  return `Style requirements — Tone: ${tone}. Desired length: ${length}.`;
}
