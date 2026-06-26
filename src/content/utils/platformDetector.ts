import { Platform } from "@/types";

interface PlatformConfig {
  platform: Platform;
  hostPatterns: readonly string[];
  // Ordered by specificity — first match wins
  selectors: readonly string[];
}

const PLATFORM_CONFIGS: PlatformConfig[] = [
  {
    platform: "chatgpt",
    hostPatterns: ["chatgpt.com", "chat.openai.com"],
    selectors: [
      "#prompt-textarea",
      "textarea[data-id='root']",
      "div[contenteditable='true'][data-id]",
      "div.ProseMirror[contenteditable='true']",
    ],
  },
  {
    platform: "claude",
    hostPatterns: ["claude.ai"],
    selectors: [
      ".ProseMirror[contenteditable='true']",
      "div[contenteditable='true'].ProseMirror",
      "div[contenteditable='true'][class*='ProseMirror']",
      "div[contenteditable='true']",
    ],
  },
  {
    platform: "gemini",
    hostPatterns: ["gemini.google.com", "bard.google.com"],
    selectors: [
      ".ql-editor[contenteditable='true']",
      "rich-textarea .ql-editor",
      "div.textarea[contenteditable='true']",
      "div[contenteditable='true']",
    ],
  },
  {
    platform: "copilot",
    hostPatterns: ["copilot.microsoft.com", "bing.com"],
    selectors: [
      "#userInput",
      "textarea[placeholder*='message' i]",
      "textarea[placeholder*='ask' i]",
      "div[contenteditable='true']",
      "textarea",
    ],
  },
  {
    platform: "perplexity",
    hostPatterns: ["perplexity.ai"],
    selectors: [
      "textarea[placeholder*='Ask' i]",
      "textarea#search-input",
      "textarea",
      "div[contenteditable='true']",
    ],
  },
  {
    platform: "grok",
    hostPatterns: ["grok.com", "x.com"],
    selectors: [
      "textarea[placeholder*='Ask' i]",
      "textarea[placeholder*='message' i]",
      "div[contenteditable='true']",
      "textarea",
    ],
  },
  {
    platform: "lovable",
    hostPatterns: ["lovable.dev"],
    selectors: [
      "textarea[placeholder*='prompt' i]",
      "textarea[placeholder*='describe' i]",
      "textarea",
      "div[contenteditable='true']",
    ],
  },
  {
    platform: "bolt",
    hostPatterns: ["bolt.new", "stackblitz.com"],
    selectors: [
      "textarea[placeholder*='describe' i]",
      "textarea[placeholder*='prompt' i]",
      "textarea[data-gramm]",
      "textarea",
      "div[contenteditable='true']",
    ],
  },
  {
    platform: "v0",
    hostPatterns: ["v0.dev"],
    selectors: [
      "textarea[placeholder*='describe' i]",
      "textarea[placeholder*='prompt' i]",
      "textarea",
      "div[contenteditable='true']",
    ],
  },
  {
    platform: "cursor",
    hostPatterns: ["cursor.com", "cursor.sh"],
    selectors: [
      "textarea[placeholder*='ask' i]",
      "textarea",
      "div[contenteditable='true']",
    ],
  },
];

export function detectPlatform(): Platform {
  const host = window.location.hostname.toLowerCase();
  for (const config of PLATFORM_CONFIGS) {
    if (config.hostPatterns.some((p) => host === p || host.endsWith("." + p))) {
      return config.platform;
    }
  }
  return "unknown";
}

export function findInputElement(platform: Platform): HTMLElement | null {
  const config = PLATFORM_CONFIGS.find((c) => c.platform === platform);
  if (!config) return null;

  for (const selector of config.selectors) {
    try {
      const elements = document.querySelectorAll<HTMLElement>(selector);
      for (const el of elements) {
        // Skip hidden / off-screen elements
        if (el.offsetParent !== null || el.getBoundingClientRect().height > 0) {
          return el;
        }
      }
    } catch {
      // Invalid selector — skip
    }
  }
  return null;
}

/** Returns the best candidate textarea watching for visibility */
export function findVisibleInputElement(platform: Platform): HTMLElement | null {
  const config = PLATFORM_CONFIGS.find((c) => c.platform === platform);
  if (!config) return null;

  for (const selector of config.selectors) {
    try {
      const el = document.querySelector<HTMLElement>(selector);
      if (el) return el;
    } catch {
      // skip
    }
  }
  return null;
}
