import { Platform } from "@/types";

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

const PLATFORM_MESSAGE_SELECTORS: Record<string, { container: string; role: (el: Element) => "user" | "assistant" }[]> = {
  chatgpt: [
    {
      container: "[data-message-author-role]",
      role: (el) => (el.getAttribute("data-message-author-role") === "user" ? "user" : "assistant"),
    },
  ],
  claude: [
    {
      container: "[data-testid='human-turn'], [data-testid='ai-turn']",
      role: (el) =>
        el.getAttribute("data-testid") === "human-turn" ? "user" : "assistant",
    },
    {
      container: ".human-turn, .assistant-turn",
      role: (el) => (el.classList.contains("human-turn") ? "user" : "assistant"),
    },
  ],
  gemini: [
    {
      container: "message-content, .query-text, .model-response-text",
      role: (el) =>
        el.tagName.toLowerCase() === "query-text" || el.classList.contains("query-text")
          ? "user"
          : "assistant",
    },
  ],
  perplexity: [
    {
      container: "[class*='UserMessage'], [class*='AIMessage'], [class*='AnswerLayout']",
      role: (el) =>
        el.className.toLowerCase().includes("user") ? "user" : "assistant",
    },
  ],
};

export function readConversationContext(platform: Platform, maxMessages = 6): string {
  const configs = PLATFORM_MESSAGE_SELECTORS[platform] ?? [];

  for (const config of configs) {
    try {
      const elements = document.querySelectorAll(config.container);
      if (!elements.length) continue;

      const messages: ConversationMessage[] = [];
      elements.forEach((el) => {
        const role = config.role(el);
        const content = (el as HTMLElement).innerText?.trim().slice(0, 300);
        if (content) messages.push({ role, content });
      });

      if (messages.length > 0) {
        const recent = messages.slice(-maxMessages);
        return (
          "\n\nPrevious conversation context:\n" +
          recent.map((m) => `${m.role === "user" ? "User" : "AI"}: ${m.content}`).join("\n")
        );
      }
    } catch {
      // selector failed — try next
    }
  }

  return "";
}
