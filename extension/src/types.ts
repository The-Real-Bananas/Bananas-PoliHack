export type Label = 'green' | 'yellow' | 'red';

export type PhotoDisplayMode = 'blur' | 'hide' | 'flag';

export type TextDisplayMode = 'flag' | 'hide';

export interface DisplaySettings {
  globalActive: boolean;

  photoFilterActive: boolean;
  photoDisplayMode: PhotoDisplayMode;

  textFilterActive: boolean;
  textDisplayMode: TextDisplayMode;

  propagandaActive: boolean;
  propagandaDisplayMode: TextDisplayMode;

  hateSpeechActive: boolean;
  hateSpeechDisplayMode: TextDisplayMode;
}

export const DEFAULT_SETTINGS: DisplaySettings = {
  globalActive: true,
  photoFilterActive: true,
  photoDisplayMode: 'flag',
  textFilterActive: false,
  textDisplayMode: 'flag',
  propagandaActive: false,
  propagandaDisplayMode: 'flag',
  hateSpeechActive: false,
  hateSpeechDisplayMode: 'flag',
};

export interface DetectionResult {
  score: number,
  source: string,
}

export type MisinfoLabel = 'too-short' | 'personal' | 'opinion' | 'misinformation'
                          | 'unverified-claim' | 'propaganda' | 'emotionally-manipulative' | 'credible';

export type HateSpeechLabel = 'hate-speech' | 'too-short' | 'clean';

export type AITextLabel = 'ai' | 'human' | 'mixed';

export interface TextDetectionResult {
  misinfoLabel: MisinfoLabel;
  misinfoScore: number;
  hateSpeechLabel: HateSpeechLabel;
  hateSpeechScore: number;
  aiTextLabel: AITextLabel;
  aiTextScore: number;
}

export const MISINFO_FLAG_LABELS: ReadonlyArray<MisinfoLabel> = [
  'misinformation', 'propaganda', 'unverified-claim', 'emotionally-manipulative',
];