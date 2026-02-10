// Main API
export { generateMorseAudio, calculateDuration } from './utils/morse-generator';

// Streaming API (real-time Web Audio)
export {
  ContestAudioEngine,
  createContestAudioEngine,
  createQrnWorkletUrl,
  revokeQrnWorkletUrl,
  QRN_WORKLET_CODE,
  CONTEST_ENGINE_DEFAULTS,
} from './streaming';

export type {
  ContestEngineOptions,
  ContestEngineStatus,
  ContestEngineCallbacks,
  PlayStationOptions,
  PlaySidetoneOptions,
  ActiveStation,
  IContestAudioEngine,
} from './streaming';

// Pileup API
export {
  generatePileupAudio,
  generatePileupSamples,
  calculateStationAttenuations,
  generateStationAudio,
  generateEnvelope,
  calculatePileupDuration,
} from './pileup';

// Types - single station
export type {
  MorseGeneratorOptions,
  GeneratedMorseAudio,
  RadioEffectsOptions,
  QrnOptions,
  QsbOptions,
} from './types';

// Types - pileup
export type {
  RayleighFadingOptions,
  FlutterOptions,
  ChirpOptions,
  BuzzOptions,
  StationEffectsOptions,
  PileupStation,
  PileupReceiverOptions,
  PileupGeneratorOptions,
  GeneratedPileupAudio,
  StationAudioResult,
} from './pileup';

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
  // Rayleigh fading constants
  MIN_RAYLEIGH_BANDWIDTH,
  MAX_RAYLEIGH_BANDWIDTH,
  DEFAULT_RAYLEIGH_BANDWIDTH,
  MIN_RAYLEIGH_DEPTH,
  MAX_RAYLEIGH_DEPTH,
  DEFAULT_RAYLEIGH_DEPTH,
  // Flutter constants
  MIN_FLUTTER_RATE,
  MAX_FLUTTER_RATE,
  DEFAULT_FLUTTER_RATE,
  MIN_FLUTTER_DEPTH,
  MAX_FLUTTER_DEPTH,
  DEFAULT_FLUTTER_DEPTH,
  // Chirp constants
  MIN_CHIRP_DEVIATION,
  MAX_CHIRP_DEVIATION,
  DEFAULT_CHIRP_DEVIATION,
  MIN_CHIRP_TIME_CONSTANT,
  MAX_CHIRP_TIME_CONSTANT,
  DEFAULT_CHIRP_TIME_CONSTANT,
  // Buzz constants
  MIN_BUZZ_AMPLITUDE,
  MAX_BUZZ_AMPLITUDE,
  DEFAULT_BUZZ_AMPLITUDE,
  // Bandwidth filter constants
  MIN_BANDWIDTH,
  MAX_BANDWIDTH,
  DEFAULT_BANDWIDTH,
  BANDWIDTH_STEP,
  // Station constants
  MAX_STATIONS,
  MIN_FREQUENCY_OFFSET,
  MAX_FREQUENCY_OFFSET,
  MIN_SIGNAL_STRENGTH,
  MAX_SIGNAL_STRENGTH,
  DEFAULT_SIGNAL_STRENGTH,
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
  validateRayleighBandwidth,
  validateRayleighDepth,
  validateFlutterRate,
  validateFlutterDepth,
  validateChirpDeviation,
  validateChirpTimeConstant,
  validateBuzzAmplitude,
  validateBandwidth,
  validateFrequencyOffset,
  validateSignalStrength,
} from './constants';

// Low-level utilities (for advanced usage)
export { translate } from './utils/morse-code';
export { generateSamples, getSampleRate } from './utils/audio-generator';
export { applyRadioEffects } from './utils/radio-effects';
export { getData as getWavData, getMIMEType } from './utils/riffwave';
export { getDataURI } from './utils/datauri';

// Effect processors
export {
  RayleighFading,
  applyRayleighFading,
  generateRayleighEnvelope,
} from './utils/rayleigh-fading';
export {
  Flutter,
  applyFlutter,
  generateFlutterEnvelope,
} from './utils/flutter';
export {
  Chirp,
  applyChirp,
  generateChirpOffsets,
} from './utils/chirp';
export {
  Buzz,
  applyBuzz,
  applyBuzzAM,
  generateBuzzSignal,
} from './utils/buzz';
export {
  BandwidthFilter,
  applyBandwidthFilter,
  roundBandwidthTo50Hz,
  BANDWIDTH_PRESETS,
} from './utils/bandwidth-filter';

// Statistical distributions for contest simulation
export {
  rndPoisson,
  rndRayleigh,
  rndGauss,
  rndGaussLim,
  rndUShaped,
  rndExponential,
  generateCallerWpm,
  generatePitchOffset,
  generateSignalStrength,
  generateSendDelay,
  generateReplyTimeout,
  generatePatience,
  generateQsbBandwidth,
} from './utils/distributions';
