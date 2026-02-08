/**
 * Default values and validation constants for morse audio settings
 */

// WPM (Words Per Minute) constraints
export const MIN_WPM = 5;
export const MAX_WPM = 60;
export const DEFAULT_WPM = 20;

// Frequency constraints (Hz)
export const MIN_FREQUENCY = 400;
export const MAX_FREQUENCY = 1200;
export const DEFAULT_FREQUENCY = 700;

// Pre-delay constraints (ms) - helps with Bluetooth audio fade-in
export const MIN_PRE_DELAY = 100;
export const MAX_PRE_DELAY = 2000;
export const DEFAULT_PRE_DELAY = 300;

// Post-delay constraints (ms) - prevents end clipping on some browsers
export const MIN_POST_DELAY = 0;
export const MAX_POST_DELAY = 1000;
export const DEFAULT_POST_DELAY = 100;

// Audio generation settings
export const RAMP_DURATION = 10; // ms, for smooth audio transitions

// QRN (atmospheric noise) constraints - SNR in dB
export const MIN_SNR = -6; // Extremely noisy (noise louder than signal)
export const MAX_SNR = 40; // Very clean
export const DEFAULT_SNR = 20;

// QSB (fading) constraints
export const MIN_FADE_DEPTH = 0;
export const MAX_FADE_DEPTH = 0.9;
export const DEFAULT_FADE_DEPTH = 0.5;

export const MIN_FADE_RATE = 0.05; // 20 sec period
export const MAX_FADE_RATE = 2.0; // 0.5 sec period
export const DEFAULT_FADE_RATE = 0.2; // 5 sec period

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Validate and normalize WPM value
 */
export function validateWpm(wpm: number): number {
  return clamp(Math.round(wpm), MIN_WPM, MAX_WPM);
}

/**
 * Validate and normalize frequency value
 */
export function validateFrequency(frequency: number): number {
  return clamp(Math.round(frequency), MIN_FREQUENCY, MAX_FREQUENCY);
}

/**
 * Validate and normalize pre-delay value
 */
export function validatePreDelay(preDelay: number): number {
  return clamp(Math.round(preDelay), MIN_PRE_DELAY, MAX_PRE_DELAY);
}

/**
 * Validate and normalize post-delay value
 */
export function validatePostDelay(postDelay: number): number {
  return clamp(Math.round(postDelay), MIN_POST_DELAY, MAX_POST_DELAY);
}

/**
 * Validate fwpm ensuring it doesn't exceed wpm
 */
export function validateFwpm(fwpm: number, wpm: number): number {
  const validatedFwpm = validateWpm(fwpm);
  return Math.min(validatedFwpm, wpm);
}

/**
 * Validate and normalize SNR value for QRN
 */
export function validateSnr(snr: number): number {
  return clamp(snr, MIN_SNR, MAX_SNR);
}

/**
 * Validate and normalize fade depth for QSB
 */
export function validateFadeDepth(depth: number): number {
  return clamp(depth, MIN_FADE_DEPTH, MAX_FADE_DEPTH);
}

/**
 * Validate and normalize fade rate for QSB
 */
export function validateFadeRate(rate: number): number {
  return clamp(rate, MIN_FADE_RATE, MAX_FADE_RATE);
}
