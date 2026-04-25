import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MIN_WPM,
  MAX_WPM,
  MIN_FREQUENCY,
  MAX_FREQUENCY,
  MIN_PRE_DELAY,
  MAX_PRE_DELAY,
  MIN_POST_DELAY,
  MAX_POST_DELAY,
  MAX_SNR,
  MIN_FADE_DEPTH,
  MAX_FADE_DEPTH,
  MIN_FADE_RATE,
  MAX_FADE_RATE,
  MIN_RAYLEIGH_BANDWIDTH,
  MAX_RAYLEIGH_BANDWIDTH,
  MIN_RAYLEIGH_DEPTH,
  MAX_RAYLEIGH_DEPTH,
  MIN_FLUTTER_RATE,
  MAX_FLUTTER_RATE,
  MIN_FLUTTER_DEPTH,
  MAX_FLUTTER_DEPTH,
  MIN_CHIRP_DEVIATION,
  MAX_CHIRP_DEVIATION,
  MIN_BUZZ_AMPLITUDE,
  MAX_BUZZ_AMPLITUDE,
  MIN_BANDWIDTH,
  MAX_BANDWIDTH,
  BANDWIDTH_STEP,
} from 'morse-audio';
import { FIST_PROFILES } from 'morse-audio';
import { Slider } from './components/Slider';
import { Section } from './components/Section';
import {
  generateDemoAudio,
  DEFAULT_SETTINGS,
  BANDPASS_PRESETS,
  FIST_PRESET_META,
  type DemoSettings,
} from './pipeline';

const QUICK_TEXTS = ['CQ CQ CQ DE W1AW', 'PARIS PARIS PARIS', 'SOS', '599 NH', 'TU 73 GL'];

export default function App() {
  const [settings, setSettings] = useState<DemoSettings>(DEFAULT_SETTINGS);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  if (!audioRef.current && typeof Audio !== 'undefined') {
    audioRef.current = new Audio();
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlay = () => setIsPlaying(true);
    const onEnded = () => setIsPlaying(false);
    const onPause = () => setIsPlaying(false);
    const onError = () => {
      setIsPlaying(false);
      setError('Audio playback failed.');
    };
    audio.addEventListener('play', onPlay);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('error', onError);
    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('error', onError);
    };
  }, []);

  const generated = useMemo(() => {
    try {
      setError(null);
      return generateDemoAudio(settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    }
  }, [settings]);

  const play = () => {
    const audio = audioRef.current;
    if (!audio || !generated) return;
    audio.src = generated.dataUri;
    audio.currentTime = 0;
    audio.play().catch((err) => {
      setError(`Play failed: ${err.message}`);
    });
  };

  const stop = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
  };

  const update = <K extends keyof DemoSettings>(key: K, value: DemoSettings[K]) => {
    setSettings((s) => ({ ...s, [key]: value }));
  };

  const updateNested = <K extends keyof DemoSettings>(
    key: K,
    patch: Partial<DemoSettings[K]>
  ) => {
    setSettings((s) => ({ ...s, [key]: { ...(s[key] as object), ...patch } as DemoSettings[K] }));
  };

  const reset = () => setSettings(DEFAULT_SETTINGS);

  return (
    <div className="app">
      <header className="app-header">
        <h1>morse-audio playground</h1>
        <p className="tagline">
          Tweak every knob in the morse-audio library. Hear how it changes the signal.
        </p>
      </header>

      <div className="play-bar">
        <button
          className="play-button"
          onClick={isPlaying ? stop : play}
          disabled={!generated}
        >
          {isPlaying ? '■ Stop' : '▶ Play'}
        </button>
        <div className="play-meta">
          {generated && (
            <>
              <span>{generated.duration.toFixed(2)}s</span>
              <span>·</span>
              <span>{generated.sampleRate} Hz</span>
              {settings.fist.enabled && (
                <>
                  <span>·</span>
                  <span>~{generated.effectiveWpm.toFixed(1)} wpm effective</span>
                </>
              )}
            </>
          )}
        </div>
        <button className="reset-button" onClick={reset}>
          Reset
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <Section title="Source signal" description="Text, speed, tone, and timing.">
        <div className="form-group">
          <label htmlFor="text">Text</label>
          <input
            id="text"
            type="text"
            value={settings.text}
            onChange={(e) => update('text', e.target.value)}
            placeholder="Type morse to send..."
          />
          <div className="quick-buttons">
            {QUICK_TEXTS.map((t) => (
              <button key={t} className="quick-button" onClick={() => update('text', t)}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="grid-2">
          <Slider
            label="Speed (WPM)"
            value={settings.wpm}
            min={MIN_WPM}
            max={MAX_WPM}
            unit="wpm"
            onChange={(v) => {
              setSettings((s) => ({ ...s, wpm: v, fwpm: Math.min(s.fwpm, v) }));
            }}
          />
          <Slider
            label="Farnsworth (spacing)"
            value={settings.fwpm}
            min={MIN_WPM}
            max={settings.wpm}
            unit="wpm"
            onChange={(v) => update('fwpm', v)}
          />
          <Slider
            label="Tone frequency"
            value={settings.frequency}
            min={MIN_FREQUENCY}
            max={MAX_FREQUENCY}
            unit="Hz"
            onChange={(v) => {
              setSettings((s) => ({
                ...s,
                frequency: v,
                bandpass: s.bandpass.lockToTone
                  ? { ...s.bandpass, centerFrequency: v }
                  : s.bandpass,
              }));
            }}
          />
          <Slider
            label="Pre-delay"
            value={settings.preDelay}
            min={MIN_PRE_DELAY}
            max={MAX_PRE_DELAY}
            unit="ms"
            step={50}
            onChange={(v) => update('preDelay', v)}
          />
          <Slider
            label="Post-delay"
            value={settings.postDelay}
            min={MIN_POST_DELAY}
            max={MAX_POST_DELAY}
            unit="ms"
            step={50}
            onChange={(v) => update('postDelay', v)}
          />
        </div>
      </Section>

      <Section
        title="Fist — Operator timing imperfections"
        description="Real ops don't key with machine precision. Pick a profile or go custom to dial in jitter, dah bias, speed drift, and the occasional long character gap."
        enabled={settings.fist.enabled}
        onToggle={(enabled) => updateNested('fist', { enabled })}
      >
        <div className="form-group">
          <label>Profile</label>
          <div className="preset-grid">
            {FIST_PRESET_META.map((preset) => (
              <button
                key={preset.profile}
                className={`preset-button ${
                  settings.fist.profile === preset.profile ? 'active' : ''
                }`}
                onClick={() => {
                  if (preset.profile === 'custom') {
                    updateNested('fist', { profile: 'custom' });
                    return;
                  }
                  const p = FIST_PROFILES[preset.profile];
                  updateNested('fist', {
                    profile: preset.profile,
                    jitter: p.jitter,
                    dahBias: p.dahBias,
                    speedDriftWpmPerSec: p.speedDriftWpmPerSec,
                    charGapStretchFraction: p.charGapStretchFraction,
                    charGapStretchMin: p.charGapStretchRange[0],
                    charGapStretchMax: p.charGapStretchRange[1],
                  });
                }}
                title={preset.description}
              >
                <span className="preset-label">{preset.label}</span>
                <span className="preset-desc">{preset.description}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid-2">
          <Slider
            label="Jitter"
            value={settings.fist.jitter}
            min={0}
            max={0.5}
            step={0.005}
            format={(v) => `±${(v * 100).toFixed(1)}%`}
            onChange={(v) => updateNested('fist', { profile: 'custom', jitter: v })}
          />
          <Slider
            label="Dah bias"
            value={settings.fist.dahBias}
            min={-0.2}
            max={0.6}
            step={0.005}
            format={(v) =>
              v === 0
                ? 'neutral'
                : v >= 0.25
                ? `+${(v * 100).toFixed(0)}% (bug-style dahhhs)`
                : v > 0
                ? `+${(v * 100).toFixed(1)}% (long dahs)`
                : `${(v * 100).toFixed(1)}% (short dahs)`
            }
            onChange={(v) => updateNested('fist', { profile: 'custom', dahBias: v })}
          />
          <Slider
            label="Speed drift"
            value={settings.fist.speedDriftWpmPerSec}
            min={0}
            max={1}
            step={0.05}
            format={(v) => `${v.toFixed(2)} wpm/s`}
            onChange={(v) =>
              updateNested('fist', { profile: 'custom', speedDriftWpmPerSec: v })
            }
          />
          <Slider
            label="Long-gap frequency"
            value={settings.fist.charGapStretchFraction}
            min={0}
            max={0.5}
            step={0.01}
            format={(v) => `${(v * 100).toFixed(0)}% of gaps`}
            onChange={(v) =>
              updateNested('fist', { profile: 'custom', charGapStretchFraction: v })
            }
          />
          <Slider
            label="Long-gap stretch (min)"
            value={settings.fist.charGapStretchMin}
            min={1}
            max={settings.fist.charGapStretchMax}
            step={0.05}
            format={(v) => `${v.toFixed(2)}× normal gap`}
            onChange={(v) =>
              updateNested('fist', { profile: 'custom', charGapStretchMin: v })
            }
          />
          <Slider
            label="Long-gap stretch (max)"
            value={settings.fist.charGapStretchMax}
            min={settings.fist.charGapStretchMin}
            max={3.5}
            step={0.05}
            format={(v) => `${v.toFixed(2)}× normal gap`}
            onChange={(v) =>
              updateNested('fist', { profile: 'custom', charGapStretchMax: v })
            }
          />
        </div>
      </Section>

      <Section
        title="QRN — Atmospheric noise"
        description="Pink noise, crackle, and heterodynes form a fixed noise floor — like turning on a radio. SNR is calibrated in a 2.5 kHz reference bandwidth (the SSB convention), so narrowing the bandpass filter below cuts noise without cutting signal — and the effective SNR climbs, just like on a real radio."
        enabled={settings.qrn.enabled}
        onToggle={(enabled) => updateNested('qrn', { enabled })}
      >
        <Slider
          label="SNR (signal above noise floor)"
          value={settings.qrn.snr}
          min={-18}
          max={MAX_SNR}
          unit="dB"
          format={(v) =>
            v >= 25
              ? `${v} dB — armchair copy`
              : v >= 10
              ? `${v} dB — easy copy`
              : v >= 3
              ? `${v} dB — workable`
              : v >= -3
              ? `${v} dB — buried in noise`
              : v >= -10
              ? `${v} dB — barely there`
              : `${v} dB — narrow filter only`
          }
          onChange={(v) => updateNested('qrn', { snr: v })}
        />
      </Section>

      <Section
        title="QSB — Slow signal fading"
        description="Multi-sinusoid amplitude modulation. Models slow ionospheric fading."
        enabled={settings.qsb.enabled}
        onToggle={(enabled) => updateNested('qsb', { enabled })}
      >
        <div className="grid-2">
          <Slider
            label="Depth"
            value={settings.qsb.depth}
            min={MIN_FADE_DEPTH}
            max={MAX_FADE_DEPTH}
            step={0.05}
            format={(v) => `${(v * 100).toFixed(0)}%`}
            onChange={(v) => updateNested('qsb', { depth: v })}
          />
          <Slider
            label="Rate"
            value={settings.qsb.rate}
            min={MIN_FADE_RATE}
            max={MAX_FADE_RATE}
            step={0.05}
            format={(v) => `${v.toFixed(2)} Hz (${(1 / v).toFixed(1)}s cycle)`}
            onChange={(v) => updateNested('qsb', { rate: v })}
          />
        </div>
      </Section>

      <Section
        title="Rayleigh fading"
        description="True multipath fading using I/Q Gaussian noise. More chaotic than QSB."
        enabled={settings.rayleigh.enabled}
        onToggle={(enabled) => updateNested('rayleigh', { enabled })}
      >
        <div className="grid-2">
          <Slider
            label="Bandwidth"
            value={settings.rayleigh.bandwidth}
            min={MIN_RAYLEIGH_BANDWIDTH}
            max={MAX_RAYLEIGH_BANDWIDTH}
            step={0.05}
            format={(v) => `${v.toFixed(2)} Hz`}
            onChange={(v) => updateNested('rayleigh', { bandwidth: v })}
          />
          <Slider
            label="Depth"
            value={settings.rayleigh.depth}
            min={MIN_RAYLEIGH_DEPTH}
            max={MAX_RAYLEIGH_DEPTH}
            step={0.05}
            format={(v) => `${(v * 100).toFixed(0)}%`}
            onChange={(v) => updateNested('rayleigh', { depth: v })}
          />
        </div>
      </Section>

      <Section
        title="Flutter — Auroral distortion"
        description="Fast amplitude modulation (10-30 Hz) seen on polar paths."
        enabled={settings.flutter.enabled}
        onToggle={(enabled) => updateNested('flutter', { enabled })}
      >
        <div className="grid-2">
          <Slider
            label="Rate"
            value={settings.flutter.rate}
            min={MIN_FLUTTER_RATE}
            max={MAX_FLUTTER_RATE}
            unit="Hz"
            onChange={(v) => updateNested('flutter', { rate: v })}
          />
          <Slider
            label="Depth"
            value={settings.flutter.depth}
            min={MIN_FLUTTER_DEPTH}
            max={MAX_FLUTTER_DEPTH}
            step={0.05}
            format={(v) => `${(v * 100).toFixed(0)}%`}
            onChange={(v) => updateNested('flutter', { depth: v })}
          />
        </div>
      </Section>

      <Section
        title="Chirp — Frequency drift on keying"
        description="Old crystal-controlled rigs drift in pitch when keyed."
        enabled={settings.chirp.enabled}
        onToggle={(enabled) => updateNested('chirp', { enabled })}
      >
        <div className="grid-2">
          <Slider
            label="Deviation"
            value={settings.chirp.deviation}
            min={MIN_CHIRP_DEVIATION}
            max={MAX_CHIRP_DEVIATION}
            unit="Hz"
            onChange={(v) => updateNested('chirp', { deviation: v })}
          />
          <Slider
            label="Time constant"
            value={settings.chirp.timeConstant}
            min={5}
            max={50}
            unit="ms"
            onChange={(v) => updateNested('chirp', { timeConstant: v })}
          />
        </div>
      </Section>

      <Section
        title="Buzz — AC hum"
        description="Mains hum bleeding into the signal."
        enabled={settings.buzz.enabled}
        onToggle={(enabled) => updateNested('buzz', { enabled })}
      >
        <div className="form-group">
          <label>Mains frequency</label>
          <div className="radio-row">
            <label className="radio">
              <input
                type="radio"
                name="buzzFreq"
                checked={settings.buzz.frequency === 50}
                onChange={() => updateNested('buzz', { frequency: 50 })}
              />
              50 Hz (EU/Asia)
            </label>
            <label className="radio">
              <input
                type="radio"
                name="buzzFreq"
                checked={settings.buzz.frequency === 60}
                onChange={() => updateNested('buzz', { frequency: 60 })}
              />
              60 Hz (Americas)
            </label>
          </div>
        </div>
        <Slider
          label="Amplitude"
          value={settings.buzz.amplitude}
          min={MIN_BUZZ_AMPLITUDE}
          max={MAX_BUZZ_AMPLITUDE}
          step={0.01}
          format={(v) => v.toFixed(2)}
          onChange={(v) => updateNested('buzz', { amplitude: v })}
        />
      </Section>

      <Section
        title="📻 Receiver bandpass filter"
        description="The final stage — model your radio's IF filter. Notice how a 300 Hz filter cleans up the noise at the cost of audio fidelity."
        enabled={settings.bandpass.enabled}
        onToggle={(enabled) => updateNested('bandpass', { enabled })}
      >
        <div className="form-group">
          <label>Bandwidth presets</label>
          <div className="preset-grid">
            {BANDPASS_PRESETS.map((preset) => (
              <button
                key={preset.bandwidth}
                className={`preset-button ${
                  settings.bandpass.bandwidth === preset.bandwidth ? 'active' : ''
                }`}
                onClick={() => updateNested('bandpass', { bandwidth: preset.bandwidth })}
                title={preset.description}
              >
                <span className="preset-label">{preset.label}</span>
                <span className="preset-desc">{preset.description}</span>
              </button>
            ))}
          </div>
        </div>

        <Slider
          label="Bandwidth (custom)"
          value={settings.bandpass.bandwidth}
          min={MIN_BANDWIDTH}
          max={MAX_BANDWIDTH}
          step={BANDWIDTH_STEP}
          unit="Hz"
          onChange={(v) => updateNested('bandpass', { bandwidth: v })}
        />

        <div className="form-group">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={settings.bandpass.lockToTone}
              onChange={(e) =>
                updateNested('bandpass', {
                  lockToTone: e.target.checked,
                  centerFrequency: e.target.checked
                    ? settings.frequency
                    : settings.bandpass.centerFrequency,
                })
              }
            />
            Lock filter center to tone frequency
          </label>
        </div>

        <Slider
          label="Filter center frequency"
          value={settings.bandpass.centerFrequency}
          min={MIN_FREQUENCY}
          max={MAX_FREQUENCY}
          unit="Hz"
          onChange={(v) => updateNested('bandpass', { centerFrequency: v })}
          disabled={settings.bandpass.lockToTone}
        />

        <Slider
          label="Filter stages (steepness)"
          value={settings.bandpass.stages}
          min={1}
          max={8}
          format={(v) => `${v} stage${v === 1 ? '' : 's'} (~${6 * v} dB/oct)`}
          onChange={(v) => updateNested('bandpass', { stages: v })}
        />

        <p className="hint">
          Tip: dial the tone to <strong>600 Hz</strong>, set the filter to{' '}
          <strong>300 Hz</strong> with the center locked, and turn QRN on at{' '}
          <strong>3 dB SNR</strong>. That's what a real contest filter sounds like.
        </p>
      </Section>

      <footer className="footer">
        <p>
          Built on <code>morse-audio</code> + <code>react-morse-audio</code>. Audio
          regenerates whenever you change a setting; press Play to hear the latest mix.
        </p>
      </footer>
    </div>
  );
}
