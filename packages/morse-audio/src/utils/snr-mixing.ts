/**
 * SNR-calibrated signal/noise mixing.
 *
 * The convention in radio engineering is that SNR is specified in a reference
 * noise bandwidth (typically 2.5 kHz for SSB-class measurements). When the
 * receiver's IF filter is narrower than the reference, less noise gets through
 * but the (in-band) signal stays put — so the *effective* SNR climbs. That's
 * the well-known "narrow CW filter pulls signals out of the noise" effect.
 *
 * These helpers implement that model in three composable pieces:
 *
 *   1. {@link generateCalibratedNoise} — produces atmospheric noise pre-filtered
 *      to a reference bandwidth and peak-normalized to a target level. The
 *      peak amplitude after this step is the "noise floor" reference.
 *
 *   2. {@link mixWithCalibratedNoise} — combines a clean signal with that noise
 *      using AGC-style behavior: the signal is scaled by 10^(snrDb/20), the
 *      noise floor stays put, and the final mix is peak-normalized so the
 *      loudest sample always lands at the same playback volume. High SNR →
 *      noise drops away. Low SNR → signal sinks under the noise.
 *
 *   3. {@link peakNormalize} — the in-place utility used by the above. Exposed
 *      for callers building custom pipelines.
 *
 * The classic `applyRadioEffects(samples, sampleRate, { qrn })` helper uses a
 * different (older) convention where the noise amplitude scales with SNR while
 * the signal stays fixed. Both conventions are mathematically valid, but the
 * AGC-calibrated one matches what an operator actually hears on a real radio.
 */

import { applyRadioEffects } from './radio-effects';
import { applyBandwidthFilter } from './bandwidth-filter';

/** Default SSB-class reference bandwidth used for SNR calibration (Hz). */
export const DEFAULT_SNR_REFERENCE_BANDWIDTH = 2500;

/**
 * Default peak amplitude the calibrated noise (and the clean signal) should
 * sit at before mixing. Matches the ~0.8 peak that the library's tone
 * synthesis produces, so SNR=0 dB literally means "signal and noise carry
 * equal peak amplitude in the reference bandwidth".
 */
export const DEFAULT_REFERENCE_PEAK = 0.8;

/**
 * Default peak amplitude of the mixed output after normalization. Slightly
 * below 1.0 to leave headroom for any downstream filtering.
 */
export const DEFAULT_OUTPUT_PEAK = 0.85;

/**
 * Peak-normalize samples in place to a target peak amplitude.
 *
 * @param samples - Buffer to normalize (modified in place)
 * @param targetPeak - Desired absolute peak amplitude (e.g. 0.8)
 */
export function peakNormalize(samples: Float32Array, targetPeak: number): void {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i]);
    if (a > peak) peak = a;
  }
  if (peak === 0) return;
  const gain = targetPeak / peak;
  for (let i = 0; i < samples.length; i++) {
    samples[i] *= gain;
  }
}

export interface CalibratedNoiseOptions {
  /** Output buffer length in samples. */
  length: number;
  /** Audio sample rate in Hz. */
  sampleRate: number;
  /** Center frequency the noise should be filtered around (Hz, e.g. tone freq). */
  centerFrequency: number;
  /** Reference noise bandwidth in Hz. Default: 2500 (SSB convention). */
  referenceBandwidth?: number;
  /** Peak amplitude after normalization. Default: 0.8 (matches clean signal). */
  targetPeak?: number;
  /**
   * Number of bandpass filter stages used to enforce the reference bandwidth.
   * More stages = steeper skirts. Default: 4.
   */
  filterStages?: number;
}

/**
 * Generate atmospheric noise (pink + crackle + heterodynes) pre-filtered to a
 * reference bandwidth and peak-normalized to a target level.
 *
 * Use the returned buffer as the calibrated noise floor when mixing with a
 * signal via {@link mixWithCalibratedNoise}.
 */
export function generateCalibratedNoise(options: CalibratedNoiseOptions): Float32Array {
  const {
    length,
    sampleRate,
    centerFrequency,
    referenceBandwidth = DEFAULT_SNR_REFERENCE_BANDWIDTH,
    targetPeak = DEFAULT_REFERENCE_PEAK,
    filterStages = 4,
  } = options;

  // Use applyRadioEffects against silence to produce broadband atmospheric
  // noise with the library's full character (pink shape + crackle + faint
  // heterodynes). SNR=0 here just gives the natural reference amplitude.
  const silent = new Float32Array(length);
  let noise = applyRadioEffects(silent, sampleRate, { qrn: { snr: 0 } });

  // Restrict to the SNR reference bandwidth, then normalize so callers can
  // reason about peak amplitude as the noise floor.
  noise = applyBandwidthFilter(noise, centerFrequency, referenceBandwidth, sampleRate, filterStages);
  peakNormalize(noise, targetPeak);

  return noise;
}

export interface SnrMixOptions {
  /** Target SNR in dB. Positive = signal louder than noise floor. */
  snrDb: number;
  /** Peak amplitude of the mixed output. Default: 0.85. */
  outputPeak?: number;
}

/**
 * Mix a clean signal with pre-calibrated noise using AGC-style constant-loudness
 * behavior.
 *
 * The signal is scaled by 10^(snrDb/20) relative to the (already-normalized)
 * noise floor, the two are summed, and the result is peak-normalized so the
 * loudest sample always plays at the same volume. This means:
 *
 *   - High SNR: signal peaks dominate, normalization pulls them to target,
 *     noise becomes proportionally tiny — clean armchair copy.
 *   - SNR = 0 dB: signal and noise sit at comparable amplitude.
 *   - Low SNR: noise dominates, normalization keeps the noise floor at target,
 *     signal sinks proportionally — buried-in-the-noise feel.
 *
 * The two input buffers must be the same length.
 *
 * @param signal - Clean signal samples (peak ≈ 0.8 from library synthesis)
 * @param noise  - Pre-calibrated noise from {@link generateCalibratedNoise}
 * @returns A new Float32Array containing the normalized mix
 */
export function mixWithCalibratedNoise(
  signal: Float32Array,
  noise: Float32Array,
  options: SnrMixOptions
): Float32Array {
  if (signal.length !== noise.length) {
    throw new Error(
      `mixWithCalibratedNoise: signal length (${signal.length}) must match noise length (${noise.length})`
    );
  }

  const { snrDb, outputPeak = DEFAULT_OUTPUT_PEAK } = options;
  const signalGain = Math.pow(10, snrDb / 20);

  const mixed = new Float32Array(signal.length);
  for (let i = 0; i < signal.length; i++) {
    mixed[i] = signal[i] * signalGain + noise[i];
  }

  peakNormalize(mixed, outputPeak);
  return mixed;
}
