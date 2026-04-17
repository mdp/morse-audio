/**
 * Station audio chain for pileup simulation
 *
 * Each station in a pileup has its own audio processing chain:
 * 1. Generate morse code samples at station's frequency offset
 * 2. Apply per-station effects (Rayleigh, flutter, chirp, buzz)
 * 3. Apply signal strength (gain)
 */

import { translate } from '../utils/morse-code';
import { generateEnvelope } from '../utils/envelope';
import { RayleighFading } from '../utils/rayleigh-fading';
import { Flutter } from '../utils/flutter';
import { Chirp } from '../utils/chirp';
import { Buzz } from '../utils/buzz';
import type { PileupStation } from './types';

// Re-export generateEnvelope for backward compatibility
export { generateEnvelope } from '../utils/envelope';

/**
 * Result from generating a single station's audio
 */
export interface StationAudioResult {
  /** Audio samples */
  samples: Float32Array;
  /** Keying envelope (for effects that need it) */
  envelope: Float32Array;
  /** Station ID */
  id: string;
  /** Actual frequency used (center + offset) */
  frequency: number;
  /** Duration in seconds */
  duration: number;
}

/**
 * Generate audio samples for a single station
 *
 * @param station - Station configuration
 * @param centerFrequency - Receiver center frequency in Hz
 * @param sampleRate - Sample rate in Hz
 * @param totalDuration - Total audio duration in ms (for padding)
 * @param seed - Random seed for reproducible effects
 * @returns Station audio result
 */
export function generateStationAudio(
  station: PileupStation,
  centerFrequency: number,
  sampleRate: number,
  totalDuration: number,
  seed: number = 0
): StationAudioResult {
  // Calculate actual frequency (center + offset)
  const frequency = centerFrequency + station.frequencyOffset;

  // Translate text to timings
  const { timings } = translate(
    station.text,
    station.wpm,
    station.fwpm ?? station.wpm
  );

  // Calculate morse duration
  let morseMs = 0;
  for (const timing of timings) {
    morseMs += Math.abs(timing);
  }

  // Generate envelope
  const envelope = generateEnvelope(timings, sampleRate);

  // Calculate total samples (including start delay and padding)
  const totalSamples = Math.ceil((totalDuration / 1000) * sampleRate);
  const startDelaySamples = Math.ceil((station.startDelay / 1000) * sampleRate);

  // Create output buffer
  const samples = new Float32Array(totalSamples);
  const fullEnvelope = new Float32Array(totalSamples);

  // Create station-specific seed
  const stationSeed = seed + hashString(station.id);

  // Initialize effects processors
  const effects = station.effects || {};
  const rayleigh = effects.rayleigh
    ? new RayleighFading(effects.rayleigh, sampleRate, stationSeed + 1)
    : null;
  const flutter = effects.flutter
    ? new Flutter(effects.flutter, sampleRate, stationSeed + 2)
    : null;
  const chirp = effects.chirp
    ? new Chirp(effects.chirp, sampleRate)
    : null;
  const buzz = effects.buzz
    ? new Buzz(effects.buzz, sampleRate)
    : null;

  // Calculate gain from signal strength (dB relative to S9)
  // S9 = reference level (1.0), each S-unit is ~6 dB
  const gainDb = station.signalStrength;
  const gain = Math.pow(10, gainDb / 20);

  // Generate samples
  const twoPi = 2 * Math.PI;
  let phase = 0;

  for (let i = 0; i < totalSamples; i++) {
    const morseIndex = i - startDelaySamples;

    // Get envelope value (0 if before start or after morse ends)
    let env = 0;
    if (morseIndex >= 0 && morseIndex < envelope.length) {
      env = envelope[morseIndex];
    }
    fullEnvelope[i] = env;

    // Calculate instantaneous frequency (with chirp if enabled)
    let freq = frequency;
    if (chirp && env > 0) {
      freq += chirp.getFrequencyOffset(env);
    }

    // Generate tone
    let sample = Math.sin(phase) * env;

    // Apply amplitude effects
    if (rayleigh) {
      sample *= rayleigh.nextSample();
    }

    if (flutter) {
      sample *= flutter.getEnvelope(i);
    }

    // Apply gain
    sample *= gain;

    // Add buzz (additive)
    if (buzz && env > 0.1) {
      sample += buzz.getSample(i) * env;
    }

    // Scale to prevent clipping (0.8 headroom)
    samples[i] = sample * 0.8;

    // Advance phase
    phase += (twoPi * freq) / sampleRate;
    if (phase >= twoPi) {
      phase -= twoPi;
    }
  }

  return {
    samples,
    envelope: fullEnvelope,
    id: station.id,
    frequency,
    duration: totalDuration / 1000,
  };
}

/**
 * Simple string hash for generating per-station seeds
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Calculate the total duration needed for a pileup
 *
 * @param stations - Array of station configurations
 * @param preDelay - Pre-delay in ms
 * @param postDelay - Post-delay in ms
 * @returns Total duration in ms
 */
export function calculatePileupDuration(
  stations: PileupStation[],
  preDelay: number = 300,
  postDelay: number = 100
): number {
  let maxEndTime = 0;

  for (const station of stations) {
    // Calculate morse duration
    const { timings } = translate(
      station.text,
      station.wpm,
      station.fwpm ?? station.wpm
    );

    let morseMs = 0;
    for (const timing of timings) {
      morseMs += Math.abs(timing);
    }

    const endTime = station.startDelay + morseMs;
    if (endTime > maxEndTime) {
      maxEndTime = endTime;
    }
  }

  return preDelay + maxEndTime + postDelay;
}
