/**
 * Audio sample generator for morse code
 *
 * Generates sine wave audio samples with smooth attack/decay
 * to prevent clicking artifacts.
 */

const DEFAULT_SAMPLE_RATE = 22050;

/**
 * Generate audio samples from morse timings
 *
 * @param timings - Array of timing values in ms (positive = sound, negative = silence)
 * @param frequency - Tone frequency in Hz
 * @param sampleRate - Sample rate in Hz
 * @param rampDuration - Duration of attack/decay ramp in ms
 * @param leadInMs - Silence padding at start for Bluetooth wake-up (ms)
 * @returns Float32Array of audio samples (-1 to 1)
 */
export function generateSamples(
  timings: number[],
  frequency: number,
  sampleRate: number = DEFAULT_SAMPLE_RATE,
  rampDuration: number = 5,
  leadInMs: number = 300
): Float32Array {
  // Calculate total number of samples needed (including lead-in padding)
  let totalMs = leadInMs;
  for (const timing of timings) {
    totalMs += Math.abs(timing);
  }

  const totalSamples = Math.ceil((totalMs / 1000) * sampleRate);
  const leadInSamples = Math.ceil((leadInMs / 1000) * sampleRate);
  const samples = new Float32Array(totalSamples);

  // Calculate ramp samples
  const rampSamples = Math.ceil((rampDuration / 1000) * sampleRate);

  // Generate envelope with inline raised cosine ramps
  const envelope = new Float32Array(totalSamples);
  let sampleIndex = leadInSamples; // Skip lead-in (already zero-filled)

  for (const timing of timings) {
    const numSamples = Math.ceil((Math.abs(timing) / 1000) * sampleRate);
    const isSound = timing > 0;

    if (isSound) {
      const attackEnd = Math.min(rampSamples, numSamples);
      const decayStart = Math.max(numSamples - rampSamples, attackEnd);

      for (let i = 0; i < numSamples && sampleIndex < totalSamples; i++) {
        let env = 1.0;
        if (i < attackEnd) {
          // Attack ramp: raised cosine from 0 to 1
          env = 0.5 * (1 - Math.cos(Math.PI * i / rampSamples));
        } else if (i >= decayStart) {
          // Decay ramp: raised cosine from 1 to 0
          env = 0.5 * (1 + Math.cos(Math.PI * (i - decayStart) / rampSamples));
        }
        envelope[sampleIndex++] = env;
      }
    } else {
      // Silence - just advance index (array is zero-initialized)
      sampleIndex += numSamples;
      // Clamp to bounds
      if (sampleIndex > totalSamples) {
        sampleIndex = totalSamples;
      }
    }
  }

  // Generate sine wave modulated by envelope
  const angularFreq = (2 * Math.PI * frequency) / sampleRate;
  for (let i = 0; i < totalSamples; i++) {
    const sine = Math.sin(angularFreq * i);
    samples[i] = sine * envelope[i] * 0.8; // 0.8 to avoid clipping
  }

  return samples;
}

/**
 * Get the default sample rate used for audio generation
 */
export function getSampleRate(): number {
  return DEFAULT_SAMPLE_RATE;
}
