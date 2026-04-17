/**
 * Unified Morse Audio Generator
 *
 * Main entry point for generating realistic CW audio with full
 * effects chain: fist modeling, AGC, multipath, ionospheric fading, etc.
 *
 * This generator produces high-quality morse code audio suitable for:
 * - Practice/training applications
 * - Contest simulation
 * - ML training data generation
 */

import { translateWithMetadata } from '../utils/morse-code';
import { generateEnvelope } from '../utils/envelope';
import { createPrng, randomSeed } from '../utils/prng';
import { generatePitchWobbleOffsets } from '../utils/pitch-wobble';
import {
  applyIonosphericFading,
  randomIonosphericFadingOptions,
  randomFadingSeverity,
} from '../utils/ionospheric-fading';
import { applyMultipath, randomMultipathOptions } from '../utils/multipath';
import { applyDopplerSpread } from '../utils/doppler-spread';
import { applyAGC, randomAGCOptions } from '../utils/agc';
import { generateChirpOffsets } from '../utils/chirp';
import { getData as getWavData } from '../utils/riffwave';
import { getDataURI } from '../utils/datauri';
import { getMIMEType } from '../utils/riffwave';
import { applyFistModel, getFistOptions } from './fist-model';
import {
  generateQrmSignal,
  randomQrmOptions,
  mixQrmSignals,
} from './qrm-generator';
import {
  generateBroadbandInterference,
  randomBroadbandInterferenceOptions,
  mixBroadbandInterference,
} from './broadband-interference';

import type {
  MorseAudioConfig,
  MorseAudioResult,
  MorseAudioMetadata,
  ParameterDistributions,
  NoiseConfig,
  CharacterMetadata,
  ElementMetadata,
  FistProfile,
  SampleRate,
} from './types';

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
// with optional slow QSB, Poisson QRN, and power-line interference layers.
// ============================================================================

/** Biquad high-pass filter (Butterworth, Q = 1/√2) */
class BiquadHP {
  private x1 = 0; private x2 = 0;
  private y1 = 0; private y2 = 0;
  private b0: number; private b1: number; private b2: number;
  private a1: number; private a2: number;
  constructor(cutoffHz: number, sampleRate: number) {
    const w = 2 * Math.PI * cutoffHz / sampleRate;
    const sw = Math.sin(w), cw = Math.cos(w);
    const alpha = sw / (2 * 0.7071);
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
    const sw = Math.sin(w), cw = Math.cos(w);
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

/** Generate SSB-band colored noise (unit RMS): HP 250 Hz + 2× LP 2500 Hz */
function generateColoredNoise(length: number, sampleRate: number, seed: number): Float32Array {
  const prng = createPrng(seed);
  const output = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const u1 = prng() || 0.0001;
    const u2 = prng();
    output[i] = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
  const hp = new BiquadHP(250, sampleRate);
  for (let i = 0; i < length; i++) output[i] = hp.process(output[i]);
  const lp1 = new BiquadLP(2500, sampleRate);
  for (let i = 0; i < length; i++) output[i] = lp1.process(output[i]);
  const lp2 = new BiquadLP(2500, sampleRate);
  for (let i = 0; i < length; i++) output[i] = lp2.process(output[i]);
  let rms = 0;
  for (let i = 0; i < length; i++) rms += output[i] * output[i];
  rms = Math.sqrt(rms / length);
  if (rms > 1e-10) { const inv = 1 / rms; for (let i = 0; i < length; i++) output[i] *= inv; }
  return output;
}

/** Generate Poisson-process QRN (atmospheric impulse noise) */
function generateQRN(length: number, sampleRate: number, rate: number, amplitude: number, seed: number): Float32Array {
  const prng = createPrng(seed);
  const output = new Float32Array(length);
  const meanGapSamples = sampleRate / rate;
  let t = Math.floor(-Math.log(prng() || 0.0001) * meanGapSamples);
  while (t < length) {
    const tauSamples = sampleRate * (0.0005 + prng() * 0.0015);
    const amp = amplitude * (0.5 + prng());
    const limit = Math.min(length, t + Math.ceil(tauSamples * 8));
    for (let i = t; i < limit; i++) output[i] += amp * Math.exp(-(i - t) / tauSamples);
    t += Math.ceil(-Math.log(prng() || 0.0001) * meanGapSamples);
  }
  return output;
}

/**
 * Generate physically accurate power-line interference.
 * Three-layer model:
 *   1. Sawtooth oscillator with ±0.2 Hz slow drift → soft-clip waveshaper (4× oversampled)
 *   2. Full-wave rectified AM envelope at 2×baseHz
 *   3. Corona discharge noise: BPF at 2×baseHz + peaking EQ at 4×baseHz
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

  // 1. Sawtooth with slow frequency drift
  const OVER = 4;
  const osRate = sampleRate * OVER;
  const slewAlpha = 1 - Math.exp(-1 / (0.5 * sampleRate));
  let freqTarget = baseHz + (prng() - 0.5) * 0.4;
  let freqCurrent = freqTarget;
  let nextDriftAt = Math.round(sampleRate * (1.0 + prng() * 0.4));
  let driftCounter = 0;
  let sawPhase = prng();

  const SCT = 0.15;
  function softClip(x: number): number {
    const a = Math.abs(x);
    if (a <= SCT) return x;
    const sign = x > 0 ? 1 : -1;
    return sign * (SCT + (1 - SCT) * Math.tanh((a - SCT) / (1 - SCT)));
  }

  // 2. AM phase
  const amPhase0 = prng() * twoPi;

  // 3. Corona discharge noise
  const corona = new Float32Array(length);
  {
    const cPrng = createPrng(Math.floor(prng() * 2147483647));
    for (let i = 0; i < length; i++) {
      const u1 = cPrng() || 0.0001;
      corona[i] = Math.sqrt(-2 * Math.log(u1)) * Math.cos(twoPi * cPrng());
    }
    // BPF at 2×baseHz, Q=0.8
    {
      const w = twoPi * baseHz * 2 / sampleRate;
      const alpha = Math.sin(w) / (2 * 0.8);
      const a0i = 1 / (1 + alpha);
      const b0 = alpha * a0i; const b2 = -alpha * a0i;
      const a1 = -2 * Math.cos(w) * a0i; const a2 = (1 - alpha) * a0i;
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      for (let i = 0; i < length; i++) {
        const x = corona[i];
        const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
        x2 = x1; x1 = x; y2 = y1; y1 = y; corona[i] = y;
      }
    }
    // Peaking EQ at 4×baseHz, +8dB, Q=1.2
    {
      const A = Math.pow(10, 8 / 40);
      const w = twoPi * baseHz * 4 / sampleRate;
      const alpha = Math.sin(w) / (2 * 1.2);
      const a0i = 1 / (1 + alpha / A);
      const b0 = (1 + alpha * A) * a0i;
      const b1 = -2 * Math.cos(w) * a0i;
      const b2 = (1 - alpha * A) * a0i;
      const a1 = b1; const a2 = (1 - alpha / A) * a0i;
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      for (let i = 0; i < length; i++) {
        const x = corona[i];
        const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
        x2 = x1; x1 = x; y2 = y1; y1 = y; corona[i] = y;
      }
    }
    // Normalize corona to RMS=1
    let rms = 0;
    for (let i = 0; i < length; i++) rms += corona[i] * corona[i];
    rms = Math.sqrt(rms / length);
    if (rms > 1e-10) { const inv = 1 / rms; for (let i = 0; i < length; i++) corona[i] *= inv; }
  }

  // Main loop
  for (let n = 0; n < length; n++) {
    if (++driftCounter >= nextDriftAt) {
      freqTarget = baseHz + (prng() - 0.5) * 0.4;
      nextDriftAt = Math.round(sampleRate * (1.0 + prng() * 0.4));
      driftCounter = 0;
    }
    freqCurrent += slewAlpha * (freqTarget - freqCurrent);

    let buzz = 0;
    for (let k = 0; k < OVER; k++) {
      sawPhase += freqCurrent / osRate;
      if (sawPhase >= 1) sawPhase -= 1;
      buzz += softClip(2 * sawPhase - 1);
    }
    buzz /= OVER;

    const amEnv = 0.3 + 0.7 * buzzDepth * Math.abs(Math.sin(twoPi * baseHz * n / sampleRate + amPhase0));
    buzz *= amEnv;

    output[n] = (buzz + corona[n] * coronaLevel * 0.12) * masterLevel;
  }

  return output;
}

/**
 * Unified Morse Audio Generator
 *
 * The primary API for generating realistic CW audio with full effects chain.
 * Supports all sample rates (8000, 16000, 22050, 44100 Hz) and provides
 * detailed metadata for each generated sample.
 */
export class MorseAudioGenerator {
  /**
   * Generate morse audio with the full effects chain
   *
   * @param config - Generation configuration
   * @returns Generated audio with metadata
   */
  generate(config: MorseAudioConfig): MorseAudioResult {
    const prng = createPrng(config.seed ?? randomSeed());
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
      const fistResult = applyFistModel(
        translation,
        config.fist,
        config.wpm,
        Math.floor(prng() * 2147483647)
      );
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
      const wobbleOffsets = generatePitchWobbleOffsets(
        envelope.length,
        config.pitchWobble,
        sampleRate
      );
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
      audio = applyIonosphericFading(
        audio,
        config.ionosphericFading,
        sampleRate,
        Math.floor(prng() * 2147483647)
      );
    }

    // 7. Apply multipath
    if (config.multipath) {
      audio = applyMultipath(audio, config.multipath, sampleRate);
    }

    // 8. Apply Doppler spread
    if (config.dopplerSpread) {
      audio = applyDopplerSpread(
        audio,
        envelope,
        config.frequency,
        config.dopplerSpread,
        sampleRate,
        Math.floor(prng() * 2147483647)
      );
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
    // 4th-order LP ~2500 Hz). SNR is total-energy ratio (Kaggle/ARRL standard).
    const noiseConfig = config.noise;

    let totalPower = 0;
    for (let i = 0; i < audio.length; i++) totalPower += audio[i] * audio[i];
    totalPower /= audio.length;
    const noiseLevel = totalPower < 1e-10
      ? 0.001
      : Math.sqrt(totalPower / Math.pow(10, noiseConfig.snrDb / 10));

    const noiseSamples = generateColoredNoise(audio.length, sampleRate, Math.floor(prng() * 2147483647));

    if (noiseConfig.qsb) {
      const { depth, freqHz } = noiseConfig.qsb;
      const phase = prng() * 2 * Math.PI;
      const twoPiF = 2 * Math.PI * freqHz;
      for (let i = 0; i < noiseSamples.length; i++) {
        noiseSamples[i] *= 1 + depth * Math.sin(twoPiF * i / sampleRate + phase);
      }
    }

    for (let i = 0; i < audio.length; i++) audio[i] += noiseSamples[i] * noiseLevel;

    if (noiseConfig.qrn) {
      const qrn = generateQRN(audio.length, sampleRate, noiseConfig.qrn.rate,
        noiseConfig.qrn.amplitudeMultiplier * noiseLevel, Math.floor(prng() * 2147483647));
      for (let i = 0; i < audio.length; i++) audio[i] += qrn[i];
    }

    if (noiseConfig.powerLine) {
      const { baseHz, level, buzzDepth, coronaLevel } = noiseConfig.powerLine;
      const masterLevel = noiseLevel * Math.pow(10, level / 20);
      const interference = generatePowerLineInterference(
        audio.length, sampleRate, baseHz, masterLevel, buzzDepth,
        coronaLevel ?? 0.3, Math.floor(prng() * 2147483647)
      );
      for (let i = 0; i < audio.length; i++) audio[i] += interference[i];
    }

    // 13. Apply AGC
    if (config.agc) {
      audio = applyAGC(audio, sampleRate, config.agc);
    }

    // 14. Add padding around the audio content
    // We always add some leading/trailing padding for more natural samples
    // and NEVER clip the actual morse content
    const minPaddingSamples = Math.ceil(0.2 * sampleRate); // 200ms minimum padding each side
    const contentSamples = audio.length;

    // Calculate target samples - use the larger of: requested duration OR content + padding
    const minRequiredSamples = contentSamples + 2 * minPaddingSamples;
    const requestedSamples =
      config.durationSec > 0
        ? Math.ceil(config.durationSec * sampleRate)
        : minRequiredSamples;
    const targetSamples = Math.max(requestedSamples, minRequiredSamples);

    const finalAudio = new Float32Array(targetSamples);

    // Calculate padding to center the content
    const totalPadding = targetSamples - contentSamples;
    const leadingPadding = Math.floor(totalPadding / 2);

    // Generate colored noise for padding (matching the content noise floor)
    const paddingNoiseUnit = generateColoredNoise(targetSamples, sampleRate, Math.floor(prng() * 2147483647));
    const paddingNoise = paddingNoiseUnit;
    for (let i = 0; i < targetSamples; i++) paddingNoise[i] *= noiseLevel;

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
    characters = characters.map((c) => ({
      ...c,
      startMs: c.startMs + offsetMs,
      endMs: c.endMs + offsetMs,
    }));

    // 15. Final soft clip
    for (let i = 0; i < finalAudio.length; i++) {
      if (finalAudio[i] > 1) finalAudio[i] = 1;
      else if (finalAudio[i] < -1) finalAudio[i] = -1;
    }

    // 16. Measure effective SNR
    const effectiveSnr = noiseConfig.snrDb;
    // Note: Actual SNR measurement would require isolating the noise,
    // which is complex after all the processing. We report the target SNR.

    // Build metadata
    const metadata: MorseAudioMetadata = {
      config,
      characters,
      elements,
      fullText: config.text,
      effectiveWpm,
      effectiveSnr,
      actualDurationSec: finalAudio.length / sampleRate,
      totalSamples: finalAudio.length,
    };

    return {
      audio: finalAudio,
      metadata,
    };
  }

  /**
   * Generate a batch of audio samples with randomized parameters
   *
   * @param count - Number of samples to generate
   * @param texts - Array of texts to randomly sample from
   * @param distributions - Parameter distribution configuration
   * @param baseSeed - Optional base seed for reproducibility
   * @returns Array of generated audio results
   */
  generateBatch(
    count: number,
    texts: string[],
    distributions: ParameterDistributions,
    baseSeed?: number
  ): MorseAudioResult[] {
    const samples: MorseAudioResult[] = [];
    const basePrng = createPrng(baseSeed ?? randomSeed());

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
  ): MorseAudioConfig {
    // WPM
    const wpm = Math.round(
      dist.wpmRange[0] + prng() * (dist.wpmRange[1] - dist.wpmRange[0])
    );

    // Farnsworth (sometimes slower than WPM)
    const fwpm = prng() < 0.3 ? Math.round(wpm * (0.6 + prng() * 0.4)) : wpm;

    // Frequency
    const frequency = Math.round(
      dist.frequencyRange[0] +
        prng() * (dist.frequencyRange[1] - dist.frequencyRange[0])
    );

    // Sample rate - randomly select from common rates
    const sampleRateOptions: SampleRate[] = [8000, 16000, 22050, 44100];
    const sampleRate =
      sampleRateOptions[Math.floor(prng() * sampleRateOptions.length)];

    // SNR
    const snrDb =
      dist.snrRange[0] + prng() * (dist.snrRange[1] - dist.snrRange[0]);

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

    // Noise
    const noise: NoiseConfig = { snrDb };
    if (prng() < dist.qsbProbability) {
      noise.qsb = { depth: 0.04 + prng() * 0.10, freqHz: 0.1 + prng() * 0.6 };
    }
    if (prng() < dist.qrnProbability) {
      noise.qrn = { rate: 2 + prng() * 6, amplitudeMultiplier: 3 + prng() * 5 };
    }
    if (prng() < dist.powerLineProbability) {
      noise.powerLine = {
        baseHz: prng() < 0.7 ? 60 : 50,
        level: 8 + prng() * 14,
        buzzDepth: 0.25 + prng() * 0.45,
        coronaLevel: 0.1 + prng() * 0.4,
      };
    }

    // Build config
    const config: MorseAudioConfig = {
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
        config.ionosphericFading =
          randomIonosphericFadingOptions(severity, prng) ?? undefined;
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
   * Convert result to WAV buffer
   *
   * @param result - Generated audio result
   * @returns WAV file as ArrayBuffer
   */
  toWavBuffer(result: MorseAudioResult): ArrayBuffer {
    const wavData = getWavData(result.audio, result.metadata.config.sampleRate);
    const buffer = new ArrayBuffer(wavData.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < wavData.length; i++) {
      view[i] = wavData[i];
    }
    return buffer;
  }

  /**
   * Convert result to data URI for playback
   *
   * @param result - Generated audio result
   * @returns Data URI string
   */
  toDataUri(result: MorseAudioResult): string {
    const wavData = getWavData(result.audio, result.metadata.config.sampleRate);
    return getDataURI(wavData, getMIMEType());
  }

  /**
   * Convert metadata to JSON string
   *
   * @param result - Generated audio result
   * @returns JSON string
   */
  toMetadataJson(result: MorseAudioResult): string {
    return JSON.stringify(result.metadata, null, 2);
  }
}

/**
 * Create a morse audio generator instance
 */
export function createMorseAudioGenerator(): MorseAudioGenerator {
  return new MorseAudioGenerator();
}

// Legacy aliases for backward compatibility
/** @deprecated Use MorseAudioGenerator instead */
export const TrainingSampleGenerator = MorseAudioGenerator;
/** @deprecated Use createMorseAudioGenerator instead */
export const createTrainingSampleGenerator = createMorseAudioGenerator;
