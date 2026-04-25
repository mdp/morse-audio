import {
  generateRealisticMorseAudio,
  FIST_PROFILES,
  DEFAULT_SNR_REFERENCE_BANDWIDTH,
  type FistProfile,
  type RealisticMorseOptions,
} from 'morse-audio';

/**
 * The demo is a *thin UI on top of the library*. All audio synthesis,
 * SNR-calibrated noise mixing, fist modeling, and bandpass filtering live in
 * `morse-audio`'s `generateRealisticMorseAudio`. This file only:
 *
 *   - holds the form state shape that maps onto the library's options object
 *   - resolves the active fist profile (preset → library options, or custom)
 *   - hands the assembled options to the library and returns the result
 *   - hosts the bandpass preset metadata used by the UI
 */

export type DemoFistProfile = FistProfile | 'custom';

export interface DemoSettings {
  text: string;
  wpm: number;
  fwpm: number;
  frequency: number;
  preDelay: number;
  postDelay: number;

  fist: {
    enabled: boolean;
    profile: DemoFistProfile;
    jitter: number;
    dahBias: number;
    speedDriftWpmPerSec: number;
    charGapStretchFraction: number;
    charGapStretchMin: number;
    charGapStretchMax: number;
  };

  qrn: { enabled: boolean; snr: number };
  qsb: { enabled: boolean; depth: number; rate: number };
  rayleigh: { enabled: boolean; bandwidth: number; depth: number };
  flutter: { enabled: boolean; rate: number; depth: number };
  chirp: { enabled: boolean; deviation: number; timeConstant: number };
  buzz: { enabled: boolean; frequency: 50 | 60; amplitude: number };

  bandpass: {
    enabled: boolean;
    bandwidth: number;
    centerFrequency: number;
    lockToTone: boolean;
    stages: number;
  };
}

export interface GenerateResult {
  dataUri: string;
  duration: number;
  sampleRate: number;
  effectiveWpm: number;
}

// Re-exported so the App can show "SNR is calibrated to N Hz" labels without
// an extra import path.
export { DEFAULT_SNR_REFERENCE_BANDWIDTH };

function settingsToOptions(s: DemoSettings): RealisticMorseOptions {
  return {
    text: s.text,
    wpm: s.wpm,
    fwpm: s.fwpm,
    frequency: s.frequency,
    preDelay: s.preDelay,
    postDelay: s.postDelay,

    fist: s.fist.enabled
      ? s.fist.profile === 'custom'
        ? {
            jitter: s.fist.jitter,
            dahBias: s.fist.dahBias,
            speedDriftWpmPerSec: s.fist.speedDriftWpmPerSec,
            charGapStretchFraction: s.fist.charGapStretchFraction,
            charGapStretchRange: [s.fist.charGapStretchMin, s.fist.charGapStretchMax],
          }
        : FIST_PROFILES[s.fist.profile]
      : undefined,

    rayleigh: s.rayleigh.enabled
      ? { bandwidth: s.rayleigh.bandwidth, depth: s.rayleigh.depth }
      : undefined,
    flutter: s.flutter.enabled
      ? { rate: s.flutter.rate, depth: s.flutter.depth }
      : undefined,
    chirp: s.chirp.enabled
      ? { deviation: s.chirp.deviation, timeConstant: s.chirp.timeConstant }
      : undefined,
    buzz: s.buzz.enabled
      ? { frequency: s.buzz.frequency, amplitude: s.buzz.amplitude }
      : undefined,

    qsb: s.qsb.enabled ? { depth: s.qsb.depth, rate: s.qsb.rate } : undefined,
    qrn: s.qrn.enabled ? { snr: s.qrn.snr } : undefined,

    bandpass: s.bandpass.enabled
      ? {
          bandwidth: s.bandpass.bandwidth,
          centerFrequency: s.bandpass.lockToTone ? undefined : s.bandpass.centerFrequency,
          stages: s.bandpass.stages,
        }
      : undefined,
  };
}

export function generateDemoAudio(s: DemoSettings): GenerateResult {
  const result = generateRealisticMorseAudio(settingsToOptions(s));
  return {
    dataUri: result.dataUri,
    duration: result.duration,
    sampleRate: result.sampleRate,
    effectiveWpm: result.effectiveWpm,
  };
}

export const DEFAULT_SETTINGS: DemoSettings = {
  text: 'CQ CQ CQ DE W1AW',
  wpm: 22,
  fwpm: 22,
  frequency: 600,
  preDelay: 300,
  postDelay: 200,

  fist: {
    enabled: false,
    profile: 'average',
    jitter: FIST_PROFILES.average.jitter,
    dahBias: FIST_PROFILES.average.dahBias,
    speedDriftWpmPerSec: FIST_PROFILES.average.speedDriftWpmPerSec,
    charGapStretchFraction: FIST_PROFILES.average.charGapStretchFraction,
    charGapStretchMin: FIST_PROFILES.average.charGapStretchRange[0],
    charGapStretchMax: FIST_PROFILES.average.charGapStretchRange[1],
  },

  qrn: { enabled: false, snr: 15 },
  qsb: { enabled: false, depth: 0.6, rate: 0.2 },
  rayleigh: { enabled: false, bandwidth: 0.5, depth: 0.7 },
  flutter: { enabled: false, rate: 15, depth: 0.5 },
  chirp: { enabled: false, deviation: 15, timeConstant: 10 },
  buzz: { enabled: false, frequency: 60, amplitude: 0.08 },

  bandpass: {
    enabled: false,
    bandwidth: 500,
    centerFrequency: 600,
    lockToTone: true,
    stages: 4,
  },
};

export interface BandpassPreset {
  label: string;
  bandwidth: number;
  description: string;
}

export const BANDPASS_PRESETS: BandpassPreset[] = [
  { label: '2.4 kHz', bandwidth: 2400, description: 'SSB filter — full audio passband' },
  { label: '1.8 kHz', bandwidth: 1800, description: 'Wide SSB / data' },
  { label: '1.0 kHz', bandwidth: 1000, description: 'Wide CW — search & pounce' },
  { label: '500 Hz', bandwidth: 500, description: 'Standard CW filter' },
  { label: '300 Hz', bandwidth: 300, description: 'Narrow CW — tight contest filter' },
  { label: '250 Hz', bandwidth: 250, description: 'Very narrow CW — classic rig filter' },
  { label: '100 Hz', bandwidth: 100, description: 'Razor-sharp — single signal copy' },
];

export interface FistPresetMeta {
  profile: DemoFistProfile;
  label: string;
  description: string;
}

export const FIST_PRESET_META: FistPresetMeta[] = [
  { profile: 'machine', label: 'Machine', description: 'Perfect timing — keyer/computer.' },
  { profile: 'good', label: 'Good op', description: 'Tight fist, barely any jitter.' },
  { profile: 'average', label: 'Average', description: 'Typical human operator.' },
  {
    profile: 'bug',
    label: 'Bug',
    description: 'Vibroplex bug, banana-boat swing — tight dits, dragged-out dahs.',
  },
  { profile: 'poor', label: 'Poor', description: 'Sloppy timing, long character gaps.' },
  { profile: 'very_poor', label: 'Very poor', description: 'Newbie straight key, heavy jitter.' },
  { profile: 'custom', label: 'Custom', description: 'Dial every parameter yourself.' },
];
