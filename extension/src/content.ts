import type { DetectionResult, DisplaySettings } from './types';
import { scanImage } from './api';

export class ContentProcessor {
  THRESHOLD_RED: number = 80;
  THRESHOLD_YELLOW: number = 40;
  imageMap: Map<HTMLImageElement, number> = new Map();
  observer: MutationObserver;

  constructor(displaySettings: DisplaySettings) {
    this.observer = new MutationObserver(() => {
      this.processImages(displaySettings);
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

  applyBlur(element: HTMLElement) {
    element.style.filter = 'blur(8px)';
  }

  applyHide(image: HTMLImageElement) {
    image.remove();
  }

  applyHighlight(image: HTMLImageElement, score: number) {
    //const color = this.scoreToColor(score);
    //image.style.outline = `4px solid ${color}`;
    if (image.parentElement?.classList.contains('ai-detector-wrapper')) return;

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

  applyDisplaySettings(image: HTMLImageElement, score: number, settings: DisplaySettings) {
    switch (settings.displayMode) {
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
      case 'highlight':
        if (score >= this.THRESHOLD_YELLOW) {
          this.applyHighlight(image, score);
        }
        break;
    }
  }

  async processImages(settings: DisplaySettings) {
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
      this.applyDisplaySettings(image, result.score, settings);
    });

    console.log('Processed', newImages.length, 'new images');
  }
}

const defaultSettings: DisplaySettings = {
  displayMode: 'highlight',
};

const processor = new ContentProcessor(defaultSettings);
console.log('[AI Detector] Content script loaded', processor);
