export type Label = 'green' | 'yellow' | 'red';

export interface DisplaySettings {
  hideContent: boolean,
  blurContent: boolean,
  highlightContent: boolean,
}

export interface DetectionResult {
  score: number,
  source: string,
}