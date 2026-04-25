export type Label = 'green' | 'yellow' | 'red';

export type PhotoDisplayMode = 'blur' | 'hide' | 'flag';

export type TextDisplayMode = 'flag' | 'hide';

export interface DisplaySettings {
  globalActive: boolean;

  photoFilterActive: boolean;
  photoDisplayMode: PhotoDisplayMode;

  propagandaActive: boolean;
  propagandaDisplayMode: TextDisplayMode;
}

export const DEFAULT_SETTINGS: DisplaySettings = {
  globalActive: true,
  photoFilterActive: true,
  photoDisplayMode: 'flag',
  propagandaActive: false,
  propagandaDisplayMode: 'flag',
};

export interface DetectionResult {
  score: number,
  source: string,
}