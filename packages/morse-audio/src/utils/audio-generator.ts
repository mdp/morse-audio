/**
 * Audio sample generator for morse code
 *
 * Generates sine wave audio samples with smooth attack/decay
 * to prevent clicking artifacts.
 */

const DEFAULT_SAMPLE_RATE = 22050;

/**
 * Simple biquad lowpass filter for smoothing audio transitions
 */
class BiquadLowpass {
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;
  private b0: number;
  private b1: number;
  private b2: number;
  private a1: number;
  private a2: number;

  constructor(cutoffFreq: number, sampleRate: number) {
    // Calculate filter coefficients for lowpass filter
    const omega = (2 * Math.PI * cutoffFreq) / sampleRate;
    const sinOmega = Math.sin(omega);
    const cosOmega = Math.cos(omega);
    const Q = 0.707; // Butterworth Q
    const alpha = sinOmega / (2 * Q);

    const a0 = 1 + alpha;
    this.b0 = ((1 - cosOmega) / 2) / a0;
    this.b1 = (1 - cosOmega) / a0;
    this.b2 = ((1 - cosOmega) / 2) / a0;
    this.a1 = (-2 * cosOmega) / a0;
    this.a2 = (1 - alpha) / a0;
  }

  process(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2
              - this.a1 * this.y1 - this.a2 * this.y2;

    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;

    return y;
  }
}

/**
 * Generate audio samples from morse timings
 *
 * @param timings - Array of timing values in ms (positive = sound, negative = silence)
 * @param frequency - Tone frequency in Hz
 * @param sampleRate - Sample rate in Hz
 * @param rampDuration - Duration of attack/decay ramp in ms
 * @returns Float32Array of audio samples (-1 to 1)
 */
export function generateSamples(
  timings: number[],
  frequency: number,
  sampleRate: number = DEFAULT_SAMPLE_RATE,
  rampDuration: number = 10
): Float32Array {
  // Calculate total number of samples needed
  let totalMs = 0;
  for (const timing of timings) {
    totalMs += Math.abs(timing);
  }

  const totalSamples = Math.ceil((totalMs / 1000) * sampleRate);
  const samples = new Float32Array(totalSamples);

  // Calculate ramp samples
  const rampSamples = Math.ceil((rampDuration / 1000) * sampleRate);

  // Create lowpass filter for smoothing envelope
  // Cutoff frequency based on ramp duration
  const cutoffFreq = 1000 / rampDuration;
  const filter = new BiquadLowpass(Math.min(cutoffFreq, sampleRate / 4), sampleRate);

  // Generate raw envelope (1 = sound, 0 = silence)
  const envelope = new Float32Array(totalSamples);
  let sampleIndex = 0;

  for (const timing of timings) {
    const duration = Math.abs(timing);
    const numSamples = Math.ceil((duration / 1000) * sampleRate);
    const isSound = timing > 0;

    for (let i = 0; i < numSamples && sampleIndex < totalSamples; i++) {
      envelope[sampleIndex] = isSound ? 1 : 0;
      sampleIndex++;
    }
  }

  // Apply lowpass filter to envelope for smooth transitions
  const smoothedEnvelope = new Float32Array(totalSamples);
  for (let i = 0; i < totalSamples; i++) {
    smoothedEnvelope[i] = filter.process(envelope[i]);
  }

  // Apply additional raised cosine ramp at transitions for extra smoothness
  let prevEnv = 0;
  for (let i = 0; i < totalSamples; i++) {
    const env = envelope[i];

    // Detect transition points and apply cosine ramp
    if (env !== prevEnv) {
      const rampStart = i;
      const rampEnd = Math.min(i + rampSamples, totalSamples);

      for (let j = rampStart; j < rampEnd; j++) {
        const t = (j - rampStart) / rampSamples;
        if (env > prevEnv) {
          // Attack: ramp up using raised cosine
          const rampVal = 0.5 * (1 - Math.cos(Math.PI * t));
          smoothedEnvelope[j] = Math.max(smoothedEnvelope[j], rampVal * env);
        } else {
          // Decay: ramp down using raised cosine
          const rampVal = 0.5 * (1 + Math.cos(Math.PI * t));
          smoothedEnvelope[j] = Math.min(smoothedEnvelope[j], rampVal * prevEnv);
        }
      }
    }
    prevEnv = env;
  }

  // Generate sine wave modulated by smoothed envelope
  const angularFreq = (2 * Math.PI * frequency) / sampleRate;
  for (let i = 0; i < totalSamples; i++) {
    const sine = Math.sin(angularFreq * i);
    samples[i] = sine * smoothedEnvelope[i] * 0.8; // 0.8 to avoid clipping
  }

  return samples;
}

/**
 * Get the default sample rate used for audio generation
 */
export function getSampleRate(): number {
  return DEFAULT_SAMPLE_RATE;
}
