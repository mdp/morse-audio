// Main API
export { generateMorseAudio, calculateDuration } from './utils/morse-generator';

// Types
export type {
  MorseGeneratorOptions,
  GeneratedMorseAudio,
  RadioEffectsOptions,
  QrnOptions,
  QsbOptions,
} from './types';

// Constants
export {
  MIN_WPM,
  MAX_WPM,
  DEFAULT_WPM,
  MIN_FREQUENCY,
  MAX_FREQUENCY,
  DEFAULT_FREQUENCY,
  MIN_PRE_DELAY,
  MAX_PRE_DELAY,
  DEFAULT_PRE_DELAY,
  MIN_POST_DELAY,
  MAX_POST_DELAY,
  DEFAULT_POST_DELAY,
  RAMP_DURATION,
  // QRN (noise) constants
  MIN_SNR,
  MAX_SNR,
  DEFAULT_SNR,
  // QSB (fading) constants
  MIN_FADE_DEPTH,
  MAX_FADE_DEPTH,
  DEFAULT_FADE_DEPTH,
  MIN_FADE_RATE,
  MAX_FADE_RATE,
  DEFAULT_FADE_RATE,
  // Validation functions
  clamp,
  validateWpm,
  validateFrequency,
  validatePreDelay,
  validatePostDelay,
  validateFwpm,
  validateSnr,
  validateFadeDepth,
  validateFadeRate,
} from './constants';

// Low-level utilities (for advanced usage)
export { translate } from './utils/morse-code';
export { generateSamples, getSampleRate } from './utils/audio-generator';
export { applyRadioEffects } from './utils/radio-effects';
export { getData as getWavData, getMIMEType } from './utils/riffwave';
export { getDataURI } from './utils/datauri';
