export type Label = 'green' | 'yellow' | 'red';

export type DisplayMode = 'blur' | 'hide' | 'highlight';

export interface DisplaySettings {
  displayMode: DisplayMode;
}

export interface DetectionResult {
  score: number,
  source: string,
}