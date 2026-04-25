import type { DisplaySettings } from './types';
import { ContentProcessor } from './content';

let displaySettings: DisplaySettings = {
  hideContent: false,
  blurContent: true,
  highlightContent: false,
};

new ContentProcessor(displaySettings);

