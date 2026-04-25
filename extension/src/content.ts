import type { DetectionResult, DisplaySettings } from './types';
import { DEFAULT_SETTINGS } from './types';
import { scanImage } from './api';

export class ContentProcessor {
  THRESHOLD_RED: number = 80;
  THRESHOLD_YELLOW: number = 40;
  SITE_SELECTORS: Record<string, string> = {
    'twitter.com': 'article[data-testid="tweet"]',
    'x.com': 'article[data-testid="tweet"]',
    'www.reddit.com': 'shreddit-post',
    'www.linkedin.com': '[role="listitem"]',
    'www.facebook.com': '[role="article"]',
  };

  imageMap: Map<HTMLImageElement, number> = new Map();
  observer: MutationObserver;
  displaySettings: DisplaySettings;



  constructor() {
    this.displaySettings = DEFAULT_SETTINGS;

    this.observer = new MutationObserver(() => {
      this.processImages();
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
    if (!image.parentNode) return; // guard null parent

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

  async processImages() {
    const images = Array.from(document.querySelectorAll('img'));
    const newImages = new Array<HTMLImageElement>();

    for (const image of images) {
      if (!this.imageMap.has(image)) {
        newImages.push(image);
      }
    }

    const results = await scanImage(newImages);
    results.forEach((result, image) => {
      console.log('Scanning:', image.src);
      this.imageMap.set(image, result.score);
      this.applyDisplaySettings(image, result.score);
    });

    console.log('Processed', newImages.length, 'new images');
  }

  processSignal(signal: any) {
    console.log('Processing signal:', signal);

    switch (signal.type) {
      case 'SET_GLOBAL':
        this.displaySettings.globalActive = signal.enabled;
        if (!signal.enabled) { 
          this.displaySettings.photoFilterActive = false;
          this.displaySettings.propagandaActive = false;
        }
        break;

      case 'SET_PHOTO_FILTER':
        this.displaySettings.photoFilterActive = signal.enabled;
        break;

      case 'SET_PHOTO_FILTER_MODE':
        this.displaySettings.photoDisplayMode = signal.mode;
        break;

      case 'SET_PROPAGANDA':
        this.displaySettings.propagandaActive = signal.enabled;
        break;

      case 'SET_PROPAGANDA_MODE':
        this.displaySettings.propagandaDisplayMode = signal.mode;
        break;
    }
  }
}

const processor = new ContentProcessor();

chrome.runtime.onMessage.addListener((signal) => {
  processor.processSignal(signal);
});

console.log('[AI Detector] Content script loaded', processor);
