/**
 * ML Training Sample Generator
 *
 * Main entry point for generating realistic CW training data.
 * Combines all effects and imperfections to create challenging
 * but realistic audio samples with accurate metadata.
 */

import { translateWithMetadata } from '../utils/morse-code';
import type { MLSampleRate } from '../utils/audio-generator';
import { generatePitchWobbleOffsets } from '../utils/pitch-wobble';
import { applyIonosphericFading, randomIonosphericFadingOptions, randomFadingSeverity } from '../utils/ionospheric-fading';
import { applyMultipath, randomMultipathOptions } from '../utils/multipath';
import { applyDopplerSpread } from '../utils/doppler-spread';
import { applyAGC, randomAGCOptions } from '../utils/agc';
import { generateChirpOffsets } from '../utils/chirp';
import { getData as getWavData } from '../utils/riffwave';
import { applyFistModel, getFistOptions } from './fist-model';
import { generateQrmSignal, randomQrmOptions, mixQrmSignals } from './qrm-generator';
import { generateBroadbandInterference, randomBroadbandInterferenceOptions, mixBroadbandInterference } from './broadband-interference';

import type {
  TrainingSampleConfig,
  TrainingSample,
  TrainingSampleMetadata,
  ParameterDistributions,
  NoiseConfig,
  CharacterMetadata,
  ElementMetadata,
  FistProfile,
} from './types';

/**
 * Seeded PRNG
 */
function createPrng(seed: number): () => number {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate keying envelope from timings
 */
function generateEnvelope(
  timings: number[],
  sampleRate: number,
  rampDuration: number = 5
): Float32Array {
  let totalMs = 0;
  for (const timing of timings) {
    totalMs += Math.abs(timing);
  }

  const totalSamples = Math.ceil((totalMs / 1000) * sampleRate);
  const envelope = new Float32Array(totalSamples);
  const rampSamples = Math.ceil((rampDuration / 1000) * sampleRate);

  let sampleIndex = 0;

  for (const timing of timings) {
    const numSamples = Math.ceil((Math.abs(timing) / 1000) * sampleRate);
    const isSound = timing > 0;

    if (isSound) {
      const attackEnd = Math.min(rampSamples, numSamples);
      const decayStart = Math.max(numSamples - rampSamples, attackEnd);

      for (let i = 0; i < numSamples && sampleIndex < totalSamples; i++) {
        let env = 1.0;
        if (i < attackEnd) {
          env = 0.5 * (1 - Math.cos(Math.PI * i / rampSamples));
        } else if (i >= decayStart) {
          env = 0.5 * (1 + Math.cos(Math.PI * (i - decayStart) / rampSamples));
        }
        envelope[sampleIndex++] = env;
      }
    } else {
      sampleIndex += numSamples;
      if (sampleIndex > totalSamples) {
        sampleIndex = totalSamples;
      }
    }
  }

  return envelope;
}

/**
 * Generate audio samples from timings with frequency modulation support
 */
function generateSamplesWithFreqMod(
  baseFrequency: number,
  sampleRate: number,
  envelope: Float32Array,
  freqOffsets?: Float32Array
): Float32Array {
  const samples = new Float32Array(envelope.length);
  const twoPi = 2 * Math.PI;
  let phase = 0;

  for (let i = 0; i < envelope.length; i++) {
    const freq = baseFrequency + (freqOffsets ? freqOffsets[i] : 0);
    samples[i] = Math.sin(phase) * envelope[i] * 0.8;
    phase += (twoPi * freq) / sampleRate;
    if (phase >= twoPi) {
      phase -= twoPi;
    }
  }

  return samples;
}

// ============================================================================
// SSB-band noise generation
// Models real HF receiver noise: bandpass-shaped (HP ~250 Hz, LP ~2500 Hz),
// with optional slow QSB, Poisson impulse (QRN), and power-line layers.
// ============================================================================

/** Biquad high-pass filter (Butterworth, Q = 1/√2) */
class BiquadHP {
  private x1 = 0; private x2 = 0;
  private y1 = 0; private y2 = 0;
  private b0: number; private b1: number; private b2: number;
  private a1: number; private a2: number;

  constructor(cutoffHz: number, sampleRate: number) {
    const w = 2 * Math.PI * cutoffHz / sampleRate;
    const sw = Math.sin(w);
    const cw = Math.cos(w);
    const alpha = sw / (2 * 0.7071); // Butterworth Q
    const a0inv = 1 / (1 + alpha);
    this.b0 = (1 + cw) / 2 * a0inv;
    this.b1 = -(1 + cw) * a0inv;
    this.b2 = (1 + cw) / 2 * a0inv;
    this.a1 = -2 * cw * a0inv;
    this.a2 = (1 - alpha) * a0inv;
  }

  process(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2
              - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x;
    this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

/** Biquad low-pass filter (Butterworth, Q = 1/√2) */
class BiquadLP {
  private x1 = 0; private x2 = 0;
  private y1 = 0; private y2 = 0;
  private b0: number; private b1: number; private b2: number;
  private a1: number; private a2: number;

  constructor(cutoffHz: number, sampleRate: number) {
    const w = 2 * Math.PI * cutoffHz / sampleRate;
    const sw = Math.sin(w);
    const cw = Math.cos(w);
    const alpha = sw / (2 * 0.7071);
    const a0inv = 1 / (1 + alpha);
    this.b0 = (1 - cw) / 2 * a0inv;
    this.b1 = (1 - cw) * a0inv;
    this.b2 = (1 - cw) / 2 * a0inv;
    this.a1 = -2 * cw * a0inv;
    this.a2 = (1 - alpha) * a0inv;
  }

  process(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2
              - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x;
    this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

/**
 * Generate SSB-band colored noise (unit RMS).
 *
 * Shapes white AWGN through:
 *   - 2nd-order HP at 250 Hz  (removes sub-voice / DC)
 *   - Two cascaded 2nd-order LP at 2500 Hz  (≈ 4th-order SSB upper edge)
 *
 * Result is normalised to RMS = 1 so the caller controls absolute level.
 */
function generateColoredNoise(length: number, sampleRate: number, seed: number): Float32Array {
  const prng = createPrng(seed);
  const output = new Float32Array(length);

  // White AWGN (Box-Muller)
  for (let i = 0; i < length; i++) {
    const u1 = prng() || 0.0001;
    const u2 = prng();
    output[i] = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  // HP at 250 Hz
  const hp = new BiquadHP(250, sampleRate);
  for (let i = 0; i < length; i++) output[i] = hp.process(output[i]);

  // Two cascaded LP stages at 2500 Hz (≈ 4th-order rolloff)
  const lp1 = new BiquadLP(2500, sampleRate);
  for (let i = 0; i < length; i++) output[i] = lp1.process(output[i]);
  const lp2 = new BiquadLP(2500, sampleRate);
  for (let i = 0; i < length; i++) output[i] = lp2.process(output[i]);

  // Normalise to RMS = 1
  let rms = 0;
  for (let i = 0; i < length; i++) rms += output[i] * output[i];
  rms = Math.sqrt(rms / length);
  if (rms > 1e-10) {
    const inv = 1 / rms;
    for (let i = 0; i < length; i++) output[i] *= inv;
  }

  return output;
}

/**
 * Generate Poisson-process atmospheric impulse noise (QRN).
 *
 * Each burst is a decaying exponential: A * exp(-t / τ).
 * Returns an additive noise array; the caller mixes it in at the desired level.
 *
 * @param length       - Number of samples
 * @param sampleRate   - Sample rate in Hz
 * @param rate         - Average bursts per second
 * @param amplitude    - Peak amplitude of each burst (absolute, not multiplier)
 * @param seed         - PRNG seed
 */
function generateQRN(
  length: number,
  sampleRate: number,
  rate: number,
  amplitude: number,
  seed: number
): Float32Array {
  const prng = createPrng(seed);
  const output = new Float32Array(length);
  const meanGapSamples = sampleRate / rate;

  let t = Math.floor(-Math.log(prng() || 0.0001) * meanGapSamples); // first arrival

  while (t < length) {
    // Decay time constant: 0.5–2 ms
    const tauSamples = sampleRate * (0.0005 + prng() * 0.0015);
    // Burst amplitude: log-uniform 0.5×–1.5× the specified amplitude
    const amp = amplitude * (0.5 + prng());
    // Write decaying pulse
    const limit = Math.min(length, t + Math.ceil(tauSamples * 8));
    for (let i = t; i < limit; i++) {
      output[i] += amp * Math.exp(-(i - t) / tauSamples);
    }
    // Next arrival
    t += Math.ceil(-Math.log(prng() || 0.0001) * meanGapSamples);
  }

  return output;
}

/**
 * Synthesise power-line interference using three layered components:
 *
 *  1. Sawtooth oscillator at baseHz with slow ±0.2 Hz frequency drift
 *     (new target every ~1.2 s, 0.5 s slew), soft-clip waveshaper at 4× oversample.
 *     The sawtooth's harmonic stack is what gives the "harsh transformer whine" timbre.
 *
 *  2. Full-wave rectified AM at 2×baseHz applied to the buzz signal:
 *       output = buzz × (0.3 + 0.7 × buzzDepth × |sin(2π × baseHz × t)|)
 *     Models transformer/rectifier chopping — the defining "pulse" heard 120 times/sec.
 *
 *  3. Corona / discharge noise: white noise → BPF at 2×baseHz (Q 0.8) →
 *     peaking EQ at 4×baseHz (+8 dB, Q 1.2), mixed at coronaLevel × 0.12.
 *     Adds the crackling, non-tonal texture of high-voltage corona discharge.
 *
 * @param length       - Number of output samples
 * @param sampleRate   - Sample rate in Hz
 * @param baseHz       - Mains frequency (50 or 60 Hz)
 * @param masterLevel  - Output amplitude scaling (absolute)
 * @param buzzDepth    - AM depth: 0 = steady hum, 1 = full rectifier chopping
 * @param coronaLevel  - Corona noise mix (0–1; 0.3 = realistic)
 * @param seed         - PRNG seed
 */
function generatePowerLineInterference(
  length: number,
  sampleRate: number,
  baseHz: number,
  masterLevel: number,
  buzzDepth: number,
  coronaLevel: number,
  seed: number
): Float32Array {
  const prng = createPrng(seed);
  const twoPi = 2 * Math.PI;
  const output = new Float32Array(length);

  // ── 1. Sawtooth with slow frequency drift ─────────────────────────────────
  const OVER = 4;
  const osRate = sampleRate * OVER;

  // First-order slew (τ = 0.5 s) toward new target every ~1.2 s
  const slewAlpha = 1 - Math.exp(-1 / (0.5 * sampleRate));
  let freqTarget = baseHz + (prng() - 0.5) * 0.4;
  let freqCurrent = freqTarget;
  let nextDriftAt = Math.round(sampleRate * (1.0 + prng() * 0.4));
  let driftCounter = 0;
  let sawPhase = prng(); // random start phase [0, 1)

  // Soft-clip: linear below threshold (0.15), tanh shoulder above
  // Continuous slope at threshold; asymptote → ±1
  const SCT = 0.15;
  function softClip(x: number): number {
    const a = Math.abs(x);
    if (a <= SCT) return x;
    const sign = x > 0 ? 1 : -1;
    return sign * (SCT + (1 - SCT) * Math.tanh((a - SCT) / (1 - SCT)));
  }

  // ── 2. AM envelope phase ───────────────────────────────────────────────────
  const amPhase0 = prng() * twoPi;

  // ── 3. Corona discharge noise ─────────────────────────────────────────────
  const corona = new Float32Array(length);
  {
    const cPrng = createPrng(Math.floor(prng() * 2147483647));
    // White noise (Box-Muller)
    for (let i = 0; i < length; i++) {
      const u1 = cPrng() || 0.0001;
      corona[i] = Math.sqrt(-2 * Math.log(u1)) * Math.cos(twoPi * cPrng());
    }

    // BPF at 2×baseHz, Q = 0.8 (constant 0 dB peak-gain biquad)
    {
      const w = twoPi * baseHz * 2 / sampleRate;
      const alpha = Math.sin(w) / (2 * 0.8);
      const a0i = 1 / (1 + alpha);
      const b0 = alpha * a0i;      // b1 = 0
      const b2 = -alpha * a0i;
      const a1 = -2 * Math.cos(w) * a0i;
      const a2 = (1 - alpha) * a0i;
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      for (let i = 0; i < length; i++) {
        const x = corona[i];
        const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
        x2 = x1; x1 = x; y2 = y1; y1 = y;
        corona[i] = y;
      }
    }

    // Peaking EQ at 4×baseHz, +8 dB, Q = 1.2
    {
      const A = Math.pow(10, 8 / 40); // amplitude gain = 10^(dB/40)
      const w = twoPi * baseHz * 4 / sampleRate;
      const alpha = Math.sin(w) / (2 * 1.2);
      const a0i = 1 / (1 + alpha / A);
      const b0 = (1 + alpha * A) * a0i;
      const b1 = -2 * Math.cos(w) * a0i;
      const b2 = (1 - alpha * A) * a0i;
      const a1 = b1; // same coefficient
      const a2 = (1 - alpha / A) * a0i;
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      for (let i = 0; i < length; i++) {
        const x = corona[i];
        const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
        x2 = x1; x1 = x; y2 = y1; y1 = y;
        corona[i] = y;
      }
    }

    // Normalise corona to RMS = 1
    let rms = 0;
    for (let i = 0; i < length; i++) rms += corona[i] * corona[i];
    rms = Math.sqrt(rms / length);
    if (rms > 1e-10) { const inv = 1 / rms; for (let i = 0; i < length; i++) corona[i] *= inv; }
  }

  // ── Main loop: sawtooth → soft-clip → AM → + corona ──────────────────────
  for (let n = 0; n < length; n++) {
    // Frequency drift: slew toward new target every ~1.2 s
    if (++driftCounter >= nextDriftAt) {
      freqTarget = baseHz + (prng() - 0.5) * 0.4;
      nextDriftAt = Math.round(sampleRate * (1.0 + prng() * 0.4));
      driftCounter = 0;
    }
    freqCurrent += slewAlpha * (freqTarget - freqCurrent);

    // 4× oversampled sawtooth → soft-clip → decimate (average)
    let buzz = 0;
    for (let k = 0; k < OVER; k++) {
      sawPhase += freqCurrent / osRate;
      if (sawPhase >= 1) sawPhase -= 1;
      buzz += softClip(2 * sawPhase - 1);
    }
    buzz /= OVER;

    // Full-wave rectified AM: |sin(2π·baseHz·t)| oscillates at 2×baseHz
    const amEnv = 0.3 + 0.7 * buzzDepth * Math.abs(Math.sin(twoPi * baseHz * n / sampleRate + amPhase0));
    buzz *= amEnv;

    output[n] = (buzz + corona[n] * coronaLevel * 0.12) * masterLevel;
  }

  return output;
}

/**
 * ML Training Sample Generator
 */
export class TrainingSampleGenerator {
  /**
   * Generate a single training sample
   */
  generate(config: TrainingSampleConfig): TrainingSample {
    const prng = createPrng(config.seed ?? Math.floor(Math.random() * 2147483647));
    const sampleRate = config.sampleRate;

    // 1. Translate text to morse with metadata
    const fwpm = config.fwpm ?? config.wpm;
    const translation = translateWithMetadata(config.text, config.wpm, fwpm);

    // 2. Apply fist model if configured
    let timings: number[];
    let characters: CharacterMetadata[];
    let elements: ElementMetadata[] | undefined;
    let effectiveWpm = config.wpm;

    if (config.fist) {
      const fistResult = applyFistModel(translation, config.fist, config.wpm, Math.floor(prng() * 2147483647));
      timings = fistResult.timings;
      characters = fistResult.characters;
      elements = fistResult.elements;
      effectiveWpm = fistResult.effectiveWpm;
    } else {
      timings = translation.timings;
      characters = translation.characters;
    }

    // 3. Generate envelope
    const rampDuration = 3 + prng() * 5; // 3-8 ms per plan
    const envelope = generateEnvelope(timings, sampleRate, rampDuration);

    // 4. Prepare frequency modulation (chirp + wobble)
    let freqOffsets: Float32Array | undefined;

    if (config.chirp) {
      freqOffsets = generateChirpOffsets(envelope, config.chirp, sampleRate);
    }

    if (config.pitchWobble) {
      const wobbleOffsets = generatePitchWobbleOffsets(envelope.length, config.pitchWobble, sampleRate);
      if (freqOffsets) {
        for (let i = 0; i < freqOffsets.length; i++) {
          freqOffsets[i] += wobbleOffsets[i];
        }
      } else {
        freqOffsets = wobbleOffsets;
      }
    }

    // 5. Generate base audio
    let audio = generateSamplesWithFreqMod(
      config.frequency,
      sampleRate,
      envelope,
      freqOffsets
    );

    // 6. Apply ionospheric fading
    if (config.ionosphericFading) {
      audio = applyIonosphericFading(audio, config.ionosphericFading, sampleRate, Math.floor(prng() * 2147483647));
    }

    // 7. Apply multipath
    if (config.multipath) {
      audio = applyMultipath(audio, config.multipath, sampleRate);
    }

    // 8. Apply Doppler spread
    if (config.dopplerSpread) {
      audio = applyDopplerSpread(audio, envelope, config.frequency, config.dopplerSpread, sampleRate, Math.floor(prng() * 2147483647));
    }

    // 9. Add QRM signals
    if (config.cwQrm && config.cwQrm.length > 0) {
      const qrmSignals: Float32Array[] = [];
      for (const qrmConfig of config.cwQrm) {
        const qrm = generateQrmSignal(
          audio.length,
          config.frequency,
          qrmConfig,
          sampleRate,
          Math.floor(prng() * 2147483647)
        );
        qrmSignals.push(qrm);
      }
      audio = mixQrmSignals(audio, qrmSignals);
    }

    // 10. Add broadband interference
    if (config.broadbandInterference) {
      const interference = generateBroadbandInterference(
        audio.length,
        config.broadbandInterference,
        sampleRate,
        Math.floor(prng() * 2147483647)
      );
      audio = mixBroadbandInterference(audio, interference);
    }

    // 11. Add SSB-band colored noise.
    // Noise is shaped to match a real HF SSB receiver passband (HP ~250 Hz,
    // 4th-order LP ~2500 Hz), which is far more realistic than flat AWGN.
    // SNR is defined as total-energy ratio over the full waveform (Kaggle standard).
    // Bandwidth filtering is the caller's responsibility – the generator outputs
    // the full SSB-band signal without any CW-specific narrowing.
    const cleanAudioSnapshot = config.outputNoisePath ? audio.slice() : null;
    const noiseConfig = config.noise;

    // Compute noise floor level from SNR target
    let totalPower = 0;
    for (let i = 0; i < audio.length; i++) totalPower += audio[i] * audio[i];
    totalPower /= audio.length;
    // Guard: if signal is silent (e.g. all-silence test), use a small fixed level
    const noiseLevel = totalPower < 1e-10
      ? 0.001
      : Math.sqrt(totalPower / Math.pow(10, noiseConfig.snrDb / 10));

    // Generate unit-RMS SSB-band colored noise
    const noiseSamples = generateColoredNoise(
      audio.length, sampleRate,
      Math.floor(prng() * 2147483647)
    );

    // Optional slow QSB: sinusoidal amplitude modulation of the noise floor.
    // Produces the ~6–8 % RMS variation seen in real band recordings.
    if (noiseConfig.qsb) {
      const { depth, freqHz } = noiseConfig.qsb;
      const phase = prng() * 2 * Math.PI;
      const twoPiF = 2 * Math.PI * freqHz;
      for (let i = 0; i < noiseSamples.length; i++) {
        noiseSamples[i] *= 1 + depth * Math.sin(twoPiF * i / sampleRate + phase);
      }
    }

    // Add scaled colored noise to signal
    for (let i = 0; i < audio.length; i++) {
      audio[i] += noiseSamples[i] * noiseLevel;
    }

    // Optional Poisson impulse QRN (atmospheric static / lightning bursts).
    // Rate 2–8 /sec with 3–8× noise-floor amplitude matches raw 40 m recordings.
    if (noiseConfig.qrn) {
      const qrn = generateQRN(
        audio.length, sampleRate,
        noiseConfig.qrn.rate,
        noiseConfig.qrn.amplitudeMultiplier * noiseLevel,
        Math.floor(prng() * 2147483647)
      );
      for (let i = 0; i < audio.length; i++) {
        audio[i] += qrn[i];
      }
    }

    // Optional power-line interference (three-layer synthesis: sawtooth + soft-clip,
    // full-wave rectified AM envelope, corona discharge noise).
    if (noiseConfig.powerLine) {
      const { baseHz, level, buzzDepth, coronaLevel } = noiseConfig.powerLine;
      const masterLevel = noiseLevel * Math.pow(10, level / 20);
      const interference = generatePowerLineInterference(
        audio.length, sampleRate, baseHz, masterLevel, buzzDepth,
        coronaLevel ?? 0.3, Math.floor(prng() * 2147483647)
      );
      for (let i = 0; i < audio.length; i++) {
        audio[i] += interference[i];
      }
    }

    // Extract noise-only content (mixed - clean) before AGC changes things
    let noiseOnlyContent: Float32Array | null = null;
    if (cleanAudioSnapshot) {
      noiseOnlyContent = new Float32Array(audio.length);
      for (let i = 0; i < audio.length; i++) {
        noiseOnlyContent[i] = audio[i] - cleanAudioSnapshot[i];
      }
    }

    // 13. Apply AGC
    if (config.agc) {
      audio = applyAGC(audio, sampleRate, config.agc);
    }

    // 14. Add padding around the audio content
    // We always add some leading/trailing padding for more natural samples
    // and NEVER clip the actual morse content
    const minPaddingSamples = Math.ceil(1.0 * sampleRate); // 1 second minimum padding each side
    const contentSamples = audio.length;

    // Calculate target samples - use the larger of: requested duration OR content + padding
    const minRequiredSamples = contentSamples + 2 * minPaddingSamples;
    const requestedSamples = Math.ceil(config.durationSec * sampleRate);
    const targetSamples = Math.max(requestedSamples, minRequiredSamples);

    const finalAudio = new Float32Array(targetSamples);

    // Calculate padding to center the content
    const totalPadding = targetSamples - contentSamples;
    const leadingPadding = Math.floor(totalPadding / 2);

    // Measure actual noise level in the content (sample from silent regions)
    // This ensures padding matches the actual noise floor after all processing
    let noiseRms = 0;
    let silentSampleCount = 0;
    for (let i = 0; i < contentSamples; i++) {
      if (envelope[i] < 0.01) {  // Silent region
        noiseRms += audio[i] * audio[i];
        silentSampleCount++;
      }
    }
    noiseRms = silentSampleCount > 100 ? Math.sqrt(noiseRms / silentSampleCount) : noiseLevel;

    // Generate colored padding noise matching the content noise floor.
    // Using the same SSB-band shape so padding is spectrally indistinguishable
    // from the content noise floor.
    const paddingNoiseUnit = generateColoredNoise(
      targetSamples, sampleRate,
      Math.floor(prng() * 2147483647)
    );
    const paddingNoise = paddingNoiseUnit;
    for (let i = 0; i < targetSamples; i++) paddingNoise[i] *= noiseRms;

    // Fill with noise first, then overlay the content
    for (let i = 0; i < targetSamples; i++) {
      finalAudio[i] = paddingNoise[i];
    }

    // Copy content into the center
    for (let i = 0; i < contentSamples; i++) {
      finalAudio[i + leadingPadding] = audio[i];
    }

    // Adjust character timings for the leading padding
    const offsetMs = (leadingPadding / sampleRate) * 1000;
    characters = characters.map(c => ({
      ...c,
      startMs: c.startMs + offsetMs,
      endMs: c.endMs + offsetMs,
    }));

    // Build noise-only final audio (same padding noise, no CW signal)
    let noiseOnlyFinal: Float32Array | null = null;
    if (noiseOnlyContent) {
      noiseOnlyFinal = new Float32Array(targetSamples);
      // Same padding noise as the main file
      for (let i = 0; i < targetSamples; i++) {
        noiseOnlyFinal[i] = paddingNoise[i];
      }
      // Overlay noise-only content (no CW) in the same position as the signal
      for (let i = 0; i < noiseOnlyContent.length; i++) {
        noiseOnlyFinal[i + leadingPadding] = noiseOnlyContent[i];
      }
    }

    // 15. Normalize to peak = 0.95 before 16-bit WAV write.
    // Noise addition can push peaks well above ±1.0 (especially at low SNR), which would
    // clip the 16-bit WAV encoder. We scale the whole signal so the loudest sample is 0.95,
    // preserving the signal/noise ratio intact.
    const processedAudio: Float32Array = finalAudio;
    const processedNoiseAudio: Float32Array | null = noiseOnlyFinal;
    let peakAbs = 0;
    for (let i = 0; i < processedAudio.length; i++) {
      const a = Math.abs(processedAudio[i]);
      if (a > peakAbs) peakAbs = a;
    }
    if (peakAbs > 0.95) {
      const scale = 0.95 / peakAbs;
      for (let i = 0; i < processedAudio.length; i++) {
        processedAudio[i] *= scale;
      }
      if (processedNoiseAudio) {
        for (let i = 0; i < processedNoiseAudio.length; i++) {
          processedNoiseAudio[i] *= scale;
        }
      }
    }

    // 16. Measure effective SNR
    let effectiveSnr = noiseConfig.snrDb;
    // Note: Actual SNR measurement would require isolating the noise,
    // which is complex after all the processing. We report the target SNR.

    // Build metadata
    const metadata: TrainingSampleMetadata = {
      config,
      characters,
      elements,
      fullText: config.text,
      effectiveWpm,
      effectiveSnr,
      actualDurationSec: processedAudio.length / sampleRate,
      totalSamples: processedAudio.length,
    };

    return {
      audio: processedAudio,
      metadata,
      ...(processedNoiseAudio ? { noiseAudio: processedNoiseAudio } : {}),
    };
  }

  /**
   * Generate a batch of training samples with randomized parameters
   */
  generateBatch(
    count: number,
    texts: string[],
    distributions: ParameterDistributions,
    baseSeed?: number
  ): TrainingSample[] {
    const samples: TrainingSample[] = [];
    const basePrng = createPrng(baseSeed ?? Math.floor(Math.random() * 2147483647));

    for (let i = 0; i < count; i++) {
      const prng = createPrng(Math.floor(basePrng() * 2147483647));

      // Select random text
      const text = texts[Math.floor(prng() * texts.length)];

      // Generate random config based on distributions
      const config = this.generateRandomConfig(text, distributions, prng);

      // Generate sample
      samples.push(this.generate(config));
    }

    return samples;
  }

  /**
   * Generate random config based on distributions
   */
  private generateRandomConfig(
    text: string,
    dist: ParameterDistributions,
    prng: () => number
  ): TrainingSampleConfig {
    // WPM
    const wpm = Math.round(dist.wpmRange[0] + prng() * (dist.wpmRange[1] - dist.wpmRange[0]));

    // Farnsworth (sometimes slower than WPM)
    const fwpm = prng() < 0.3 ? Math.round(wpm * (0.6 + prng() * 0.4)) : wpm;

    // Frequency
    const frequency = Math.round(dist.frequencyRange[0] + prng() * (dist.frequencyRange[1] - dist.frequencyRange[0]));

    // Sample rate
    const sampleRate: MLSampleRate = prng() < 0.5 ? 8000 : 16000;

    // SNR
    const snrDb = dist.snrRange[0] + prng() * (dist.snrRange[1] - dist.snrRange[0]);

    // Fist profile
    let fistProfile: FistProfile | undefined;
    let cumulative = 0;
    const fistRoll = prng();
    for (const [profile, prob] of Object.entries(dist.fistDistribution)) {
      cumulative += prob ?? 0;
      if (fistRoll < cumulative) {
        fistProfile = profile as FistProfile;
        break;
      }
    }
    const fist = fistProfile ? getFistOptions(fistProfile, prng) : undefined;

    // Noise – always SSB-band colored; optionally add QSB and QRN
    const noise: NoiseConfig = { snrDb };

    if (prng() < dist.qsbProbability) {
      noise.qsb = {
        depth: 0.04 + prng() * 0.10,     // 4–14 % amplitude depth
        freqHz: 0.1 + prng() * 0.6,      // 0.1–0.7 Hz fading rate
      };
    }

    if (prng() < dist.qrnProbability) {
      noise.qrn = {
        rate: 2 + prng() * 6,             // 2–8 events/sec
        amplitudeMultiplier: 3 + prng() * 5, // 3–8× noise floor
      };
    }

    if (prng() < dist.powerLineProbability) {
      noise.powerLine = {
        baseHz: prng() < 0.7 ? 60 : 50,   // 70% Americas (60 Hz), 30% EU (50 Hz)
        level: 8 + prng() * 14,            // 8–22 dB above noise floor
        buzzDepth: 0.25 + prng() * 0.45,   // 0.25–0.70 AM depth
        coronaLevel: 0.1 + prng() * 0.4,  // 0.1–0.5 corona mix
      };
    }

    // Build config
    const config: TrainingSampleConfig = {
      text,
      wpm,
      fwpm: fwpm !== wpm ? fwpm : undefined,
      fist,
      frequency,
      sampleRate,
      noise,
      durationSec: 10,
      seed: Math.floor(prng() * 2147483647),
    };

    // Optional effects based on probabilities
    if (prng() < dist.ionosphericFadingProbability) {
      const severity = randomFadingSeverity(prng);
      if (severity !== 'none') {
        config.ionosphericFading = randomIonosphericFadingOptions(severity, prng) ?? undefined;
      }
    }

    if (prng() < dist.multipathProbability) {
      config.multipath = randomMultipathOptions(prng);
    }

    if (prng() < dist.dopplerSpreadProbability) {
      config.dopplerSpread = {
        spreadHz: 1 + prng() * 19,
        components: 3 + Math.floor(prng() * 4),
      };
    }

    if (prng() < dist.cwQrmProbability) {
      const qrmCount = prng() < dist.multipleQrmProbability ? 2 : 1;
      config.cwQrm = [];
      for (let j = 0; j < qrmCount; j++) {
        config.cwQrm.push(randomQrmOptions(prng));
      }
    }

    if (prng() < dist.broadbandInterferenceProbability) {
      config.broadbandInterference = randomBroadbandInterferenceOptions(prng);
    }

    if (prng() < dist.agcProbability) {
      config.agc = randomAGCOptions(prng);
    }

    if (prng() < dist.pitchWobbleProbability) {
      config.pitchWobble = {
        amplitude: prng() * 3,
        rate: 0.01 + prng() * 0.09,
        phase: prng() * 2 * Math.PI,
      };
    }

    if (prng() < dist.chirpProbability) {
      config.chirp = {
        deviation: 5 + prng() * 25,
        timeConstant: 10,
      };
    }

    return config;
  }

  /**
   * Convert sample to WAV buffer
   */
  toWavBuffer(sample: TrainingSample): ArrayBuffer {
    const wavData = getWavData(sample.audio, sample.metadata.config.sampleRate);
    const buffer = new ArrayBuffer(wavData.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < wavData.length; i++) {
      view[i] = wavData[i];
    }
    return buffer;
  }

  /**
   * Convert metadata to JSON string
   */
  toMetadataJson(sample: TrainingSample): string {
    return JSON.stringify(sample.metadata, null, 2);
  }
}

/**
 * Create a training sample generator instance
 */
export function createTrainingSampleGenerator(): TrainingSampleGenerator {
  return new TrainingSampleGenerator();
}
