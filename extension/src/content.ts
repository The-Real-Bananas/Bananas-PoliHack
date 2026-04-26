import type { DisplaySettings, TextDetectionResult } from './types';
import { DEFAULT_SETTINGS, MISINFO_FLAG_LABELS } from './types';
import { scanImages, scanTexts } from './api';

export class ContentProcessor {
  THRESHOLD_RED: number = 80;
  THRESHOLD_YELLOW: number = 40;
  SITE_SELECTORS: Record<string, string> = {
    'twitter.com': 'article[data-testid="tweet"]',
    'x.com': 'article[data-testid="tweet"]',
    'www.reddit.com': 'shreddit-post',
    'www.linkedin.com': '[role="listitem"]',
    'www.facebook.com': 'div[aria-posinset]',
  };

  // Selectors that should resolve to the *text body* of a post, not the whole
  // post container (which would also pull in reactions, button labels, etc.).
  TEXT_SELECTORS: Record<string, string> = {
    'twitter.com': 'article[data-testid="tweet"] [data-testid="tweetText"]',
    'x.com': 'article[data-testid="tweet"] [data-testid="tweetText"]',
    'www.reddit.com': 'shreddit-post [slot="text-body"]',
    'www.linkedin.com': '[role="listitem"] .feed-shared-update-v2__description, [role="listitem"] .update-components-text',
    'www.facebook.com': 'div[aria-posinset] div[data-ad-rendering-role="story_message"], div[aria-posinset] div[dir="auto"]',
  };

  imageMap: Map<HTMLImageElement, number> = new Map();
  textMap: Map<HTMLElement, TextDetectionResult> = new Map();
  observer: MutationObserver;
  displaySettings: DisplaySettings;


  static async create(): Promise<ContentProcessor> {
    const instance = new ContentProcessor();
    const data = await chrome.storage.local.get('displaySettings');
    if (data.displaySettings) {
      instance.displaySettings = data.displaySettings as DisplaySettings;
    }
    return instance;
  }

  constructor() {
    this.displaySettings = DEFAULT_SETTINGS;
    let debounceTimer: ReturnType<typeof setTimeout>;

    this.observer = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this.processImages();
        this.processText();
      }, 1000);
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'data-src', 'data-original', 'data-lazy-src', 'data-url'],
    });
  }

  pendingImageLoads: WeakSet<HTMLImageElement> = new WeakSet();

  imageBadges: Map<HTMLImageElement, {
    badge: HTMLElement;
    tooltip: HTMLElement;
    onEnter: () => void;
    onLeave: () => void;
  }> = new Map();

  watchImageLoad(image: HTMLImageElement) {
    if (this.pendingImageLoads.has(image)) return;
    this.pendingImageLoads.add(image);
    const onLoad = () => {
      image.removeEventListener('load', onLoad);
      this.pendingImageLoads.delete(image);
      this.processImages();
    };
    image.addEventListener('load', onLoad, { once: true });
  }

  scoreToColor(score: number): string {
    if (score >= this.THRESHOLD_RED) {
      return '#ef4444';
    }

    if (score >= this.THRESHOLD_YELLOW)  {
      return '#f59e0b';
    }

    return '#22c55e';
  }

  findPostContainer(image: HTMLImageElement): HTMLElement {
    console.log('Hiding image:', image.src);

    const siteSelector = this.SITE_SELECTORS[window.location.hostname];

    if (siteSelector) {
      const post = image.closest(siteSelector) as HTMLElement | null;
      if (post) return post;
    }

    const generic = image.closest('article, [role="article"], .post, .card') as HTMLElement | null;
    return generic ?? image;
  }

  applyBlur(element: HTMLElement) {
    element.style.filter = 'blur(8px)';
  }

  applyHide(image: HTMLImageElement) {
    this.findPostContainer(image).style.display = 'none';
  }

  applyFlag(image: HTMLImageElement, score: number) {
    if (this.imageBadges.has(image)) return;

    const color = score >= this.THRESHOLD_RED ? '#ef4444' : '#f59e0b';

    image.style.outline = `4px solid ${color}`;
    image.style.outlineOffset = '-4px';

    const tooltip = document.createElement('div');
    tooltip.className = 'ai-detector-image-tooltip';
    tooltip.style.cssText = `
      position:fixed;
      background:${color};color:white;
      padding:6px 10px;border-radius:6px;
      font-size:12px;font-family:sans-serif;line-height:1.4;
      white-space:nowrap;z-index:99999;
      pointer-events:none;opacity:0;
      transition:opacity 0.15s ease;
      box-shadow:0 2px 8px rgba(0,0,0,0.3);
    `;
    tooltip.innerHTML = `
      <div style="font-weight:bold;">This might be AI-generated</div>
      <div>Confidence: ${score}%</div>
    `;
    document.body.appendChild(tooltip);

    const onEnter = () => {
      const rect = image.getBoundingClientRect();
      tooltip.style.top = `${rect.top}px`;
      tooltip.style.left = `${rect.right + 8}px`;
      tooltip.style.opacity = '1';
    };
    const onLeave = () => {
      tooltip.style.opacity = '0';
    };
    image.addEventListener('mouseenter', onEnter);
    image.addEventListener('mouseleave', onLeave);

    // Reuse imageBadges to track outline + tooltip; badge field unused now.
    this.imageBadges.set(image, {
      badge: image,
      tooltip,
      onEnter,
      onLeave,
    });
  }

  textHide(element: HTMLElement) {
    element.style.display = 'none';
  }

  textFlag(element: HTMLElement, color: string, title: string, score: number) {
    element.style.backgroundColor = `${color}33`;
    element.style.borderLeft = `3px solid ${color}`;
    element.style.borderRadius = '2px';

    const tooltip = document.createElement('div');
    tooltip.className = 'ai-detector-text-tooltip';
    tooltip.style.cssText = `
      position:fixed;
      background:${color};color:white;
      padding:6px 10px;border-radius:6px;
      font-size:12px;font-family:sans-serif;line-height:1.4;
      white-space:nowrap;z-index:99999;
      pointer-events:none;opacity:0;
      transition:opacity 0.15s ease;
      box-shadow:0 2px 8px rgba(0,0,0,0.3);
    `;
    tooltip.innerHTML = `
      <div style="font-weight:bold;">${title}</div>
      <div>Confidence: ${score}%</div>
    `;
    document.body.appendChild(tooltip);

    const onEnter = () => {
      const rect = element.getBoundingClientRect();
      tooltip.style.top = `${rect.top}px`;
      tooltip.style.left = `${rect.right + 8}px`;
      tooltip.style.opacity = '1';
    };
    const onLeave = () => {
      tooltip.style.opacity = '0';
    };
    element.addEventListener('mouseenter', onEnter);
    element.addEventListener('mouseleave', onLeave);

    (element as any).__aiDetectorTooltip = { tooltip, onEnter, onLeave };
  }

  clearTextFlagTooltip(element: HTMLElement) {
    const handle = (element as any).__aiDetectorTooltip;
    if (!handle) return;
    element.removeEventListener('mouseenter', handle.onEnter);
    element.removeEventListener('mouseleave', handle.onLeave);
    handle.tooltip.remove();
    delete (element as any).__aiDetectorTooltip;
  }

  applyTextDisplaySettings(element: HTMLElement, result: TextDetectionResult) {
    const s = this.displaySettings;
    if (!s.globalActive) return;

    type Trigger = { mode: 'flag' | 'hide'; score: number; title: string };
    const triggers: Trigger[] = [];

    if (s.hateSpeechActive && result.hateSpeechLabel === 'hate-speech') {
      triggers.push({
        mode: s.hateSpeechDisplayMode,
        score: result.hateSpeechScore,
        title: 'Hate speech',
      });
    }
    if (s.propagandaActive && MISINFO_FLAG_LABELS.includes(result.misinfoLabel)) {
      triggers.push({
        mode: s.propagandaDisplayMode,
        score: result.misinfoScore,
        title: this.misinfoTitle(result.misinfoLabel),
      });
    }
    if (s.textFilterActive && (result.aiTextLabel === 'ai' || result.aiTextLabel === 'mixed')) {
      triggers.push({
        mode: s.textDisplayMode,
        score: result.aiTextScore,
        title: result.aiTextLabel === 'ai' ? 'AI-generated text' : 'Mixed AI/human text',
      });
    }

    if (triggers.length === 0) return;

    if (triggers.some(t => t.mode === 'hide')) {
      this.textHide(element);
      return;
    }

    // Pick the trigger with the highest score, color by severity threshold.
    const top = triggers.reduce((a, b) => (b.score > a.score ? b : a));
    const color = top.score >= this.THRESHOLD_RED ? '#ef4444' : '#f59e0b';
    this.textFlag(element, color, top.title, top.score);
  }

  misinfoTitle(label: TextDetectionResult['misinfoLabel']): string {
    switch (label) {
      case 'misinformation': return 'Misinformation';
      case 'propaganda': return 'Propaganda';
      case 'unverified-claim': return 'Unverified claim';
      case 'emotionally-manipulative': return 'Emotionally manipulative';
      default: return 'Flagged content';
    }
  }

  applyDisplaySettings(image: HTMLImageElement, score: number) {
    switch (this.displaySettings.photoDisplayMode) {
      case 'blur':
        if (score >= this.THRESHOLD_RED) {
          this.applyBlur(image);
        }
        break;
      case 'hide':
        if (score >= this.THRESHOLD_RED) {
          this.applyHide(image);
        }
        break;
      case 'flag':
        if (score >= this.THRESHOLD_YELLOW) {
          this.applyFlag(image, score);
        }
        break;
    }
  }

  resetDisplaySettings(image: HTMLImageElement) {
    image.style.filter = '';
    image.style.outline = '';
    image.style.outlineOffset = '';

    const handle = this.imageBadges.get(image);
    if (handle) {
      image.removeEventListener('mouseenter', handle.onEnter);
      image.removeEventListener('mouseleave', handle.onLeave);
      handle.tooltip.remove();
      this.imageBadges.delete(image);
    }

    // Back-compat: undo any leftover wrapper from an older build.
    const wrapper = image.closest('.ai-detector-wrapper');
    if (wrapper) wrapper.replaceWith(image);
  }

  resetTextDisplaySettings(element: HTMLElement) {
    element.style.backgroundColor = '';
    element.style.color = '';
    element.style.padding = '';
    element.style.borderRadius = '';
    element.style.borderLeft = '';
    element.style.display = '';
    this.clearTextFlagTooltip(element);
  }

  async processImages() {
    const images = Array.from(document.querySelectorAll('img'));
    const newImages = new Array<HTMLImageElement>();

    for (const image of images) {
      if (this.imageMap.has(image)) continue;

      if (!image.complete || image.naturalWidth === 0) {
        this.watchImageLoad(image);
        continue;
      }

      const rect = image.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      const style = getComputedStyle(image);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;

      newImages.push(image);
    }

    const results = await scanImages(newImages);
    results.forEach((result, image) => {
      console.log('Scanning:', image.src);
      this.imageMap.set(image, result.score);
      this.applyDisplaySettings(image, result.score);
      console.log('Result:', result.score);
    });

    console.log('Processed', newImages.length, 'new images');
  }

  async processText() {
    const selector = this.TEXT_SELECTORS[window.location.hostname] ?? 'p, article, [role="article"]';
    const elements = Array.from(document.querySelectorAll<HTMLElement>(selector));
    const candidates: HTMLElement[] = [];

    // Drop descendants whose ancestor is either (a) already a candidate this
    // tick or (b) was scanned in a previous tick and is in textMap. Without
    // (b), an outer post div flagged on tick 1 and an inner text div picked
    // up by a later mutation on tick 2 would both get flagged.
    const alreadyScanned = Array.from(this.textMap.keys());
    for (const el of elements) {
      if (this.textMap.has(el)) continue;
      if (el.innerText.trim().length < 25) continue;
      if (candidates.some(c => c.contains(el))) continue;
      if (alreadyScanned.some(a => a.contains(el))) continue;
      candidates.push(el);
    }

    const newElements = candidates;

    console.log('Found', newElements.length, 'new text elements');

    if (newElements.length === 0) return;

    const results = await scanTexts(newElements);
    results.forEach((result, el) => {
      console.log("Sent text:", el);
      this.textMap.set(el, result);
      this.applyTextDisplaySettings(el, result);
      console.log(result.misinfoLabel, result.hateSpeechLabel, result.aiTextLabel);
    });
  }

  reprocessImages() {
    this.imageMap.forEach((score, image) => {
      this.resetDisplaySettings(image);
      if (this.displaySettings.photoFilterActive && this.displaySettings.globalActive) {
        this.applyDisplaySettings(image, score);
      }
    });
  }

  reprocessText() {
    this.textMap.forEach((result, el) => {
      this.resetTextDisplaySettings(el);

      if (this.displaySettings.globalActive) {
        this.applyTextDisplaySettings(el, result);
      }
    });
  }

  processSignal(signal: any) {
    console.log('Processing signal:', signal);

    switch (signal.type) {
      case 'SET_GLOBAL':
        this.displaySettings.globalActive = signal.enabled;
        if (!signal.enabled) { 
          this.displaySettings.photoFilterActive = false;
          this.displaySettings.propagandaActive = false;
          this.displaySettings.textFilterActive = false;
        }
        break;

      case 'SET_PHOTO_FILTER':
        this.displaySettings.photoFilterActive = signal.enabled;
        break;

      case 'SET_PHOTO_FILTER_MODE':
        this.displaySettings.photoDisplayMode = signal.mode;
        break;

      case 'SET_TEXT_FILTER':
        this.displaySettings.textFilterActive = signal.enabled;
        break;

      case 'SET_TEXT_FILTER_MODE':
        this.displaySettings.textDisplayMode = signal.mode;
        break;

      case 'SET_PROPAGANDA':
        this.displaySettings.propagandaActive = signal.enabled;
        break;

      case 'SET_PROPAGANDA_MODE':
        this.displaySettings.propagandaDisplayMode = signal.mode;
        break;

      case 'SET_HATE_SPEECH':
        this.displaySettings.hateSpeechActive = signal.enabled;
        break;

      case 'SET_HATE_SPEECH_MODE':
        this.displaySettings.hateSpeechDisplayMode = signal.mode;
        break;
    }

    this.reprocessImages();
    this.reprocessText();
    chrome.storage.local.set({ displaySettings: this.displaySettings });
  }
}

const SINGLETON_KEY = '__aiDetectorLoaded__';

if (!(window as any)[SINGLETON_KEY]) {
    (window as any)[SINGLETON_KEY] = true;

    (async () => {
        const processor = await ContentProcessor.create();

        chrome.runtime.onMessage.addListener((signal) => {
            processor.processSignal(signal);
        });

        processor.processImages();
        processor.processText();

        console.log('[AI Detector] Content script loaded', processor);
    })();

} else {
    console.log('[AI Detector] Already loaded, skipping');
}
