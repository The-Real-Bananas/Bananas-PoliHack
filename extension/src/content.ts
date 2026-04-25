import type { DetectionResult, DisplaySettings } from './types';
import { scanImage } from './api';

const THRESHOLD_RED = 80;
const THRESHOLD_YELLOW = 40;

function scoreToColor(score: number): string {
  if (score >= THRESHOLD_RED) {
     return '#ef4444';
  }

  if (score >= THRESHOLD_YELLOW)  {
    return '#f59e0b';
  }

  return '#22c55e';
}