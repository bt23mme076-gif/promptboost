export interface PromptScore {
  total: number;
  breakdown: {
    specificity: number;   // max 25
    structure: number;     // max 25
    context: number;       // max 25
    clarity: number;       // max 25
  };
}

export function scorePrompt(prompt: string): PromptScore {
  const text = prompt.trim();
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const lines = text.split("\n").filter((l) => l.trim());

  // ── Specificity (0–25) ────────────────────────────────────────────────────
  let specificity = 0;
  if (wordCount >= 5) specificity += 5;
  if (wordCount >= 15) specificity += 5;
  if (wordCount >= 30) specificity += 5;
  if (/\d+/.test(text)) specificity += 5; // numbers = specific
  if (/\b(must|should|need|require|include|avoid|never|always)\b/i.test(text)) specificity += 5;

  // ── Structure (0–25) ─────────────────────────────────────────────────────
  let structure = 0;
  if (lines.length > 1) structure += 8;
  if (/[-•*]\s/.test(text) || /^\d+\./m.test(text)) structure += 8; // bullets or numbered list
  if (/[:]\s/.test(text)) structure += 5; // colons suggest sections
  if (lines.length >= 5) structure += 4;

  // ── Context (0–25) ───────────────────────────────────────────────────────
  let context = 0;
  if (/\b(you are|act as|as a|i am|i'm|my|our)\b/i.test(text)) context += 8; // role/persona
  if (/\b(context|background|goal|objective|purpose|because|so that)\b/i.test(text)) context += 8;
  if (/\b(for|target|audience|user|customer|client|team)\b/i.test(text)) context += 5;
  if (/\b(format|output|response|structure|tone|style)\b/i.test(text)) context += 4;

  // ── Clarity (0–25) ───────────────────────────────────────────────────────
  let clarity = 0;
  // Has a clear verb/action
  if (/\b(write|create|build|design|analyze|explain|generate|list|compare|summarize|help|make)\b/i.test(text)) clarity += 8;
  // Sentence ends properly
  if (/[.?!]$/.test(text.trim())) clarity += 5;
  // Not all lowercase (basic formatting)
  if (/[A-Z]/.test(text)) clarity += 5;
  // Has question or direct instruction
  if (/\?/.test(text) || /^(please|can you|could you|help|write|create|build)/i.test(text)) clarity += 4;
  // Not just one word
  if (wordCount >= 3) clarity += 3;

  const total = Math.min(100, specificity + structure + context + clarity);

  return {
    total,
    breakdown: {
      specificity: Math.min(25, specificity),
      structure: Math.min(25, structure),
      context: Math.min(25, context),
      clarity: Math.min(25, clarity),
    },
  };
}

export function scoreLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: "Excellent", color: "#16a34a" };
  if (score >= 60) return { label: "Good", color: "#0891b2" };
  if (score >= 40) return { label: "Average", color: "#d97706" };
  if (score >= 20) return { label: "Weak", color: "#ea580c" };
  return { label: "Poor", color: "#dc2626" };
}
