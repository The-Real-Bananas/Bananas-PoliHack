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

  applyDisplaySettings(_image: HTMLImageElement, _result: DetectionResult, _settings: DisplaySettings) {

  }

  async processImages(_settings: DisplaySettings) {
    const images = Array.from(document.querySelectorAll('img'));
    const newImages = new Array<HTMLImageElement>();

    for (const image of images) {
      if (!this.imageMap.has(image)) {
        newImages.push(image);
      }
    }

    const results = await scanImage(newImages);
    results.forEach((result, image) => {
      this.imageMap.set(image, result.score);
      this.applyBlur(image);
    });

    console.log('Processed', newImages.length, 'new images');
  }
}
