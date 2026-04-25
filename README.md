# AI Content Detector — Browser Extension
> 24h hackathon project | 5 people | Chrome Extension + Backend API

---

## What We're Building

A Chrome extension that scans web pages for AI-generated images and text, then overlays visual indicators (highlights, borders, badges) directly on the page. Users see a traffic-light confidence score (green/yellow/red) for each detected element.

---

## Tech Stack

| Layer | Tech | Why |
|---|---|---|
| Extension | TypeScript + Vite + Manifest V3 | Type safety, fast HMR, bundles to plain JS |
| Backend | FastAPI (Python) | Fast to write, async, auto docs |
| Text detection | GPTZero API | Best free tier |
| Image detection | Hive Moderation or Illuminarty API | Simple REST, reliable |
| Hosting | Railway or Render | Free tier, 2-min deploy from GitHub |
| Caching | In-memory dict/Map | No DB needed for a demo |

> If the team prefers JS backend, swap FastAPI for Express + TypeScript. Same structure.

### Extension Build Setup

```bash
npm create vite@latest extension -- --template vanilla-ts
cd extension
npm install
```

`vite.config.ts` must output to `dist/` with no code splitting — Chrome extensions can't use dynamic imports:

```ts
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        content: 'src/content.ts',
        background: 'src/background.ts',
        popup: 'popup.html',
      },
      output: { entryFileNames: '[name].js' }
    }
  }
})
```

Point `manifest.json` at `dist/` files. Run `npm run build` to compile — load `dist/` as unpacked extension in Chrome.

---

## Project Structure

```
ai-detector/
├── extension/
│   ├── manifest.json           # MV3 config (points to dist/)
│   ├── popup.html              # Extension popup UI
│   ├── vite.config.ts          # Build config
│   ├── tsconfig.json
│   ├── src/
│   │   ├── content.ts          # DOM scanning + overlay injection
│   │   ├── background.ts       # Service worker, message relay
│   │   ├── popup.ts            # Popup logic
│   │   └── types.ts            # Shared types (DetectionResult, Mode, etc.)
│   └── dist/                   # Built output — load this in Chrome
├── backend/
│   ├── main.py                 # FastAPI app
│   ├── detection/
│   │   ├── text.py             # GPTZero integration
│   │   └── image.py            # Hive/Illuminarty integration
│   └── cache.py                # In-memory URL/hash cache
├── demo/
│   └── index.html              # Demo page with known AI + human content
└── README.md
```

---

## Architecture

```
[Web Page]
    └── content.js (injected)
         ├── Finds all <img> tags → extracts src URLs
         ├── Finds text blocks (p, article, etc.) → extracts content
         └── Sends to background.js via chrome.runtime.sendMessage
              └── background.js
                   └── POST /detect → FastAPI backend
                        ├── /detect/image → Hive API → confidence score
                        └── /detect/text  → GPTZero API → confidence score
                             └── Returns { score: 0-100, label: "ai"|"human"|"mixed" }
                                  └── content.js renders overlay on element
```

---

## Manifest V3 Config

```json
{
  "manifest_version": 3,
  "name": "AI Content Detector",
  "version": "1.0",
  "permissions": ["activeTab", "scripting"],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_popup": "popup.html"
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content.js"]
  }]
}
```

---

## Detection Output Format

All detection endpoints return a normalized response:

```ts
// types.ts
export type Label = 'ai' | 'mixed' | 'human'
export type DisplayMode = 'highlight' | 'hide'

export interface DetectionResult {
  score: number       // 0–100, likelihood of being AI-generated
  label: Label        // 'ai' (>70), 'mixed' (40–70), 'human' (<40)
  source: string      // 'gptzero' | 'hive' | 'illuminarty'
}

export interface ExtensionState {
  mode: DisplayMode
  enabled: boolean
}
```

- Overlay color: 🔴 red / 🟡 yellow / 🟢 green
- In **highlight mode**: colored border + confidence badge on hover
- In **hide mode**: element replaced with a placeholder div showing `"AI content hidden — click to reveal"`

---

## Display Modes

### Highlight Mode
```ts
function applyHighlight(el: HTMLElement, result: DetectionResult) {
  el.style.outline = `3px solid ${scoreToColor(result.score)}`
  el.dataset.aiScore = String(result.score)
  // attach hover badge via CSS ::after or injected span
}
```

### Hide Mode
```ts
function applyHide(el: HTMLElement, result: DetectionResult) {
  const placeholder = document.createElement('div')
  placeholder.className = 'ai-detector-placeholder'
  placeholder.textContent = `AI content hidden (${result.score}% confidence) — click to reveal`
  placeholder.onclick = () => el.parentNode?.replaceChild(el, placeholder)
  el.parentNode?.replaceChild(placeholder, el)
}
```

Mode is stored in `chrome.storage.local` and read by `content.ts` on each scan.

---

## Team Split

| Person | Responsibility |
|---|---|
| 1 | Extension scaffold, manifest, content script DOM traversal |
| 2 | Overlay rendering, popup UI, highlight styles |
| 3 | FastAPI backend, proxy server, request batching |
| 4 | Detection API integration (text + image), score normalization |
| 5 | UX polish, demo page, presentation prep |

---

## Timeline

| Hours | Milestone |
|---|---|
| 0–4 | Boilerplate done. Extension loads. Backend runs. API accounts set up. Everyone unblocked. |
| 4–12 | Core features. DOM scanning works. API calls return results. Overlays render. |
| 12–18 | End-to-end flow. Integration complete. Edge cases handled. |
| 18–24 | Polish. Bug fixes. Demo page ready. Presentation rehearsed. |

---

## MVP Scope (do this first)

- [ ] Manual "Scan Page" button in popup
- [ ] Image scanning only (more visual, easier to demo)
- [ ] Toggle in popup: **Highlight** / **Hide**
- [ ] Highlight mode: traffic-light border + confidence % badge on hover
- [ ] Hide mode: replace element with placeholder + "click to reveal"
- [ ] Mode persisted in `chrome.storage.local`
- [ ] Works on the demo page

## Stretch Goals (if time allows)

- [ ] Auto-scan on page load
- [ ] Text paragraph highlighting
- [ ] Sidebar panel with full page summary
- [ ] Whitelist/ignore domains
- [ ] Export report as JSON

---

## External APIs — Sign Up Before Starting

- **GPTZero:** https://gptzero.me/api — free tier, 10k words/month
- **Hive Moderation:** https://hivemoderation.com — AI image detection endpoint
- **Illuminarty:** https://illuminarty.ai — alternative image detector

Store keys in a `.env` file, never commit them.

---

## Demo Page Requirements

`demo/index.html` must contain:
- 3–4 known AI-generated images
- 3–4 real/human photographs
- 2 paragraphs of AI-generated text
- 2 paragraphs of human-written text

This is what you show during the presentation. Prepare it early.
