# PromptBoost

One-click AI prompt enhancement for any AI chatbot.

Write a rough prompt → click ✨ Improve → get a professionally engineered version instantly.

## Supported Platforms

| Platform | URL |
|---|---|
| ChatGPT | chatgpt.com |
| Claude | claude.ai |
| Gemini | gemini.google.com |
| Microsoft Copilot | copilot.microsoft.com |
| Perplexity | perplexity.ai |
| Grok | grok.com |
| Lovable | lovable.dev |
| Bolt | bolt.new |
| v0 | v0.dev |
| Cursor | cursor.com |

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Generate icons

```bash
npm run generate-icons
```

### 3. Build the extension

**Development (watch mode):**
```bash
npm run dev
```

**Production:**
```bash
npm run build
```

The built extension lands in `dist/`.

### 4. Load in Chrome

1. Go to `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `dist/` folder

### 5. Add your API key

Click the PromptBoost icon in the toolbar → Settings → add your key for OpenAI, Claude, or Gemini.

## Architecture

```
src/
├── background/     # Service worker — handles API calls, message routing
├── content/        # Content script — injects floating button into AI chatbots
│   ├── components/ # ImproveButton, Toast
│   └── utils/      # Platform detector, textarea read/write
├── popup/          # Extension popup — status, history
├── options/        # Settings page — API keys, model, history
├── api/            # API clients (OpenAI, Claude, Gemini)
├── storage/        # Chrome storage layer with encryption
├── hooks/          # React hooks for settings and history
└── types/          # Shared TypeScript types
```

**Key design decisions:**
- All API calls happen in the background service worker — API keys never touch content scripts
- Content script uses Shadow DOM to prevent CSS conflicts with host pages
- API keys encrypted with AES-256-GCM using Web Crypto API before storage
- Platform detector uses URL matching + DOM querying — zero user configuration needed

## Keyboard Shortcut

`Ctrl+Shift+P` (Windows/Linux) · `Cmd+Shift+P` (Mac)

Triggers prompt improvement from anywhere on a supported page.

## Getting API Keys

| Provider | URL |
|---|---|
| OpenAI | platform.openai.com/api-keys |
| Anthropic (Claude) | console.anthropic.com/settings/keys |
| Google (Gemini) | aistudio.google.com/app/apikey |

## Publishing to Chrome Web Store

1. Run `npm run build`
2. Zip the `dist/` folder: `zip -r promptboost.zip dist/`
3. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
4. Click **New item** → upload `promptboost.zip`
5. Fill in store listing:
   - Title: PromptBoost — AI Prompt Enhancer
   - Category: Productivity
   - Screenshots: capture the floating button on ChatGPT + the settings page
6. Submit for review (typically 1–3 business days)

**Required store assets:**
- 1280×800 or 640×400 screenshot (at least 1)
- 440×280 small promo tile
- Icon 128×128 (already generated)

## Development

```bash
npm run lint        # ESLint
npm run type-check  # TypeScript check
npm run format      # Prettier
```

## Security

- API keys encrypted with AES-256-GCM before `chrome.storage.sync`
- No keys ever sent to PromptBoost servers (there are none)
- API calls go directly from the extension to OpenAI/Anthropic/Google
- Content Security Policy set in manifest
- Input sanitized before sending to API

## Privacy Policy

**Last updated: June 2026**

PromptBoost does not collect, store, or transmit any personal data to external servers.

**Data collected and how it is used:**

| Data | Where stored | Purpose |
|------|-------------|---------|
| Groq API key | Locally in `chrome.storage.local` (AES-GCM encrypted) | To make API calls on your behalf |
| Selected improve mode | `localStorage` on the AI chat site | Remember your last-used mode |

**What we do NOT collect:**
- We do not collect your name, email, or any personally identifiable information
- We do not log or store your prompts
- We do not track your browsing history
- We do not sell or share any data with third parties

**Third-party services:**  
When you click Improve, your prompt text is sent to the [Groq API](https://groq.com) using your own API key. Please review [Groq's privacy policy](https://groq.com/privacy-policy/) for how they handle data.

**Contact:**  
For questions, open an issue at https://github.com/bt23mme076-gif/promptboost/issues
