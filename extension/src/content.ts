import type { DetectionResult, DisplaySettings } from './types';
import { DEFAULT_SETTINGS } from './types';
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

  imageMap: Map<HTMLImageElement, number> = new Map();
  textMap: Map<HTMLElement, number> = new Map();
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

    this.observer.observe(document.body, { childList: true, subtree: true });
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
    if (image.parentElement?.classList.contains('ai-detector-wrapper')) return;
    if (!image.parentNode) return;

    const color = score >= this.THRESHOLD_RED ? '#ef4444' : '#f59e0b';

    const wrapper = document.createElement('div');
    wrapper.className = 'ai-detector-wrapper';
    wrapper.style.cssText = 'position:relative;display:inline-block;';

    const badge = document.createElement('div');
    badge.style.cssText = `
      position:absolute;top:6px;right:6px;
      width:22px;height:22px;border-radius:50%;
      background:${color};color:white;
      font-size:14px;font-weight:bold;
      display:flex;align-items:center;justify-content:center;
      z-index:9999;cursor:pointer;
      box-shadow:0 1px 4px rgba(0,0,0,0.4);
    `;
    badge.textContent = '!';

    const tooltip = document.createElement('div');
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

    badge.addEventListener('mouseenter', () => {
      const rect = badge.getBoundingClientRect();
      tooltip.style.top = `${rect.top}px`;
      tooltip.style.left = `${rect.left - tooltip.offsetWidth - 8}px`;
      tooltip.style.opacity = '1';
    });
    badge.addEventListener('mouseleave', () => {
      tooltip.style.opacity = '0';
    });

    image.parentNode?.insertBefore(wrapper, image);
    wrapper.appendChild(image);
    wrapper.appendChild(badge);
  }

  textHide(element: HTMLElement) {
    element.style.display = 'none';
  }

  textFlag(element: HTMLElement, score: number) {
    const color = this.scoreToColor(score);
    element.style.backgroundColor = `${color}33`;
    element.style.borderLeft = `3px solid ${color}`;
    element.style.borderRadius = '2px';
  }

  applyTextDisplaySettings(element: HTMLElement, score: number) {
    if (this.displaySettings.propagandaActive && this.displaySettings.propagandaDisplayMode === 'hide'
      || this.displaySettings.hateSpeechActive && this.displaySettings.hateSpeechDisplayMode === 'hide'
      || this.displaySettings.textFilterActive && this.displaySettings.textDisplayMode === 'hide'
    ) {
      if (score >= this.THRESHOLD_RED) {
        this.textHide(element);
      }
    }

    if (this.displaySettings.propagandaActive && this.displaySettings.propagandaDisplayMode === 'flag'
      || this.displaySettings.hateSpeechActive && this.displaySettings.hateSpeechDisplayMode === 'flag'
      || this.displaySettings.textFilterActive && this.displaySettings.textDisplayMode === 'flag'
    ) {
      if (score >= this.THRESHOLD_YELLOW) {
        this.textFlag(element, score);
      }
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
    const wrapper = image.closest('.ai-detector-wrapper');
    if (!wrapper) return;
    wrapper.replaceWith(image);
  }

  resetTextDisplaySettings(element: HTMLElement) {
    element.style.backgroundColor = '';
    element.style.color = '';
    element.style.padding = '';
    element.style.borderRadius = '';
  }

  async processImages() {
    const images = Array.from(document.querySelectorAll('img'));
    const newImages = new Array<HTMLImageElement>();

    for (const image of images) {
      const rect = image.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      const style = getComputedStyle(image);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;

      if (!this.imageMap.has(image) ) {
        newImages.push(image);
      }
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
    const elements = Array.from(document.querySelectorAll<HTMLElement>('p, article, [role="article"]'));
    const newElements = new Array<HTMLElement>();

    for (const el of elements) {
      if (!this.textMap.has(el) && el.innerText.trim().length >= 25) {
        newElements.push(el);
      }
    }

    console.log('Found', newElements.length, 'new text elements');

    if (newElements.length === 0) return;

    const results = await scanTexts(newElements);
    results.forEach((result, el) => {
      console.log('Scanning text:', el.innerText);
      this.textMap.set(el, result.score);
      this.applyTextDisplaySettings(el, result.score);
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
    this.textMap.forEach((score, el) => {
      this.resetTextDisplaySettings(el);

      if (this.displaySettings.globalActive) {
        this.applyTextDisplaySettings(el, score);
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
