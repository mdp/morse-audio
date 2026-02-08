// Components
export { MorseAudio } from './MorseAudio';

// Hooks
export { useMorseAudio } from './useMorseAudio';

// Types
export type {
  MorseAudioProps,
  MorseAudioRef,
  MorsePlaybackStatus,
  UseMorseAudioOptions,
  UseMorseAudioReturn,
} from './types';

// Re-export constants from morse-audio for convenience
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
} from 'morse-audio';

// Re-export utilities from morse-audio for advanced usage
export { generateMorseAudio, calculateDuration } from 'morse-audio';
export type {
  MorseGeneratorOptions,
  GeneratedMorseAudio,
  RadioEffectsOptions,
  QrnOptions,
  QsbOptions,
} from 'morse-audio';
