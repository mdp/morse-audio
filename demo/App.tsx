import React, { useState, useRef, useMemo } from 'react';
import {
  MorseAudio,
  useMorseAudio,
  MorseAudioRef,
  MorsePlaybackStatus,
  RadioEffectsOptions,
  DEFAULT_WPM,
  DEFAULT_FREQUENCY,
  DEFAULT_PRE_DELAY,
  DEFAULT_POST_DELAY,
  MIN_WPM,
  MAX_WPM,
  MIN_FREQUENCY,
  MAX_FREQUENCY,
  MIN_SNR,
  MAX_SNR,
  DEFAULT_SNR,
  MIN_FADE_DEPTH,
  MAX_FADE_DEPTH,
  DEFAULT_FADE_DEPTH,
  MIN_FADE_RATE,
  MAX_FADE_RATE,
  DEFAULT_FADE_RATE,
} from 'react-morse-audio';

function StatusBadge({ status }: { status: MorsePlaybackStatus }) {
  return <span className={`status status-${status}`}>{status}</span>;
}

function ComponentDemo() {
  const [text, setText] = useState('CQ CQ CQ DE W1AW');
  const [wpm, setWpm] = useState(DEFAULT_WPM);
  const [fwpm, setFwpm] = useState(DEFAULT_WPM);
  const [frequency, setFrequency] = useState(DEFAULT_FREQUENCY);
  const [preDelay, setPreDelay] = useState(DEFAULT_PRE_DELAY);
  const [autoPlay, setAutoPlay] = useState(false);
  const [status, setStatus] = useState<MorsePlaybackStatus>('idle');
  const [playedText, setPlayedText] = useState('');
  const [pendingPlay, setPendingPlay] = useState(false);

  // Radio effects state
  const [qrnEnabled, setQrnEnabled] = useState(false);
  const [snr, setSnr] = useState(DEFAULT_SNR);
  const [qsbEnabled, setQsbEnabled] = useState(false);
  const [fadeDepth, setFadeDepth] = useState(DEFAULT_FADE_DEPTH);
  const [fadeRate, setFadeRate] = useState(DEFAULT_FADE_RATE);

  const radioEffects = useMemo<RadioEffectsOptions | undefined>(() => {
    if (!qrnEnabled && !qsbEnabled) return undefined;
    return {
      qrn: qrnEnabled ? { snr } : undefined,
      qsb: qsbEnabled ? { depth: fadeDepth, rate: fadeRate } : undefined,
    };
  }, [qrnEnabled, snr, qsbEnabled, fadeDepth, fadeRate]);

  const morseRef = useRef<MorseAudioRef>(null);

  // When audio becomes ready and we have a pending play request, trigger it
  React.useEffect(() => {
    if (pendingPlay && status === 'ready') {
      setPendingPlay(false);
      morseRef.current?.play();
    }
  }, [pendingPlay, status]);

  const handlePlay = () => {
    if (playedText === text && (status === 'ready' || status === 'completed')) {
      // Audio already loaded for this text, play immediately
      morseRef.current?.play();
    } else {
      // Need to load new audio first
      setPlayedText(text);
      setPendingPlay(true);
    }
  };

  return (
    <div className="demo-section">
      <h2>Component Demo (with Ref)</h2>

      <label>
        Text to encode:
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter text..."
        />
      </label>

      <label>
        WPM: <span className="value-display">{wpm}</span>
        <input
          type="range"
          min={MIN_WPM}
          max={MAX_WPM}
          value={wpm}
          onChange={(e) => setWpm(Number(e.target.value))}
        />
      </label>

      <label>
        Farnsworth WPM: <span className="value-display">{fwpm}</span>
        <input
          type="range"
          min={MIN_WPM}
          max={wpm}
          value={Math.min(fwpm, wpm)}
          onChange={(e) => setFwpm(Number(e.target.value))}
        />
      </label>

      <label>
        Frequency (Hz): <span className="value-display">{frequency}</span>
        <input
          type="range"
          min={MIN_FREQUENCY}
          max={MAX_FREQUENCY}
          value={frequency}
          onChange={(e) => setFrequency(Number(e.target.value))}
        />
      </label>

      <label>
        Pre-delay (ms): <span className="value-display">{preDelay}</span>
        <input
          type="range"
          min={100}
          max={1000}
          value={preDelay}
          onChange={(e) => setPreDelay(Number(e.target.value))}
        />
      </label>

      <label>
        <input
          type="checkbox"
          checked={autoPlay}
          onChange={(e) => setAutoPlay(e.target.checked)}
        />
        {' '}Auto-play on text change
      </label>

      <fieldset className="radio-effects">
        <legend>Radio Effects (HF Simulation)</legend>

        <label>
          <input
            type="checkbox"
            checked={qrnEnabled}
            onChange={(e) => setQrnEnabled(e.target.checked)}
          />
          {' '}QRN (Static/Noise)
        </label>

        {qrnEnabled && (
          <label className="nested">
            SNR: <span className="value-display">{snr} dB</span>
            <input
              type="range"
              min={MIN_SNR}
              max={MAX_SNR}
              value={snr}
              onChange={(e) => setSnr(Number(e.target.value))}
            />
            <span className="hint">{snr < 0 ? 'Noise louder than signal' : snr < 10 ? 'Very noisy' : snr < 20 ? 'Noisy' : 'Clean'}</span>
          </label>
        )}

        <label>
          <input
            type="checkbox"
            checked={qsbEnabled}
            onChange={(e) => setQsbEnabled(e.target.checked)}
          />
          {' '}QSB (Fading)
        </label>

        {qsbEnabled && (
          <>
            <label className="nested">
              Fade Depth: <span className="value-display">{fadeDepth.toFixed(2)}</span>
              <input
                type="range"
                min={MIN_FADE_DEPTH * 100}
                max={MAX_FADE_DEPTH * 100}
                value={fadeDepth * 100}
                onChange={(e) => setFadeDepth(Number(e.target.value) / 100)}
              />
            </label>
            <label className="nested">
              Fade Rate (Hz): <span className="value-display">{fadeRate.toFixed(2)}</span>
              <input
                type="range"
                min={MIN_FADE_RATE * 100}
                max={MAX_FADE_RATE * 100}
                value={fadeRate * 100}
                onChange={(e) => setFadeRate(Number(e.target.value) / 100)}
              />
              <span className="hint">{(1 / fadeRate).toFixed(1)}s cycle</span>
            </label>
          </>
        )}
      </fieldset>

      <div className="controls">
        <button onClick={handlePlay}>Play</button>
        <button onClick={() => morseRef.current?.stop()}>Stop</button>
        <button onClick={() => morseRef.current?.replay()}>Replay</button>
        <StatusBadge status={status} />
        {morseRef.current?.duration && (
          <span>Duration: {morseRef.current.duration.toFixed(1)}s</span>
        )}
      </div>

      <MorseAudio
        ref={morseRef}
        text={playedText}
        wpm={wpm}
        fwpm={fwpm}
        frequency={frequency}
        preDelay={preDelay}
        postDelay={DEFAULT_POST_DELAY}
        radioEffects={radioEffects}
        autoPlay={autoPlay}
        onPlay={() => console.log('Playback started')}
        onComplete={() => console.log('Playback completed')}
        onStatusChange={setStatus}
        onError={(err) => console.error('Playback error:', err)}
      />
    </div>
  );
}

function HookDemo() {
  const [text, setText] = useState('HELLO WORLD');
  const [wpm, setWpm] = useState(25);

  const { play, stop, replay, status, duration } = useMorseAudio({
    text,
    wpm,
    autoPlay: false,
    onPlay: () => console.log('[Hook] Started'),
    onComplete: () => console.log('[Hook] Completed'),
  });

  return (
    <div className="demo-section">
      <h2>Hook Demo (useMorseAudio)</h2>

      <label>
        Text:
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </label>

      <label>
        WPM: <span className="value-display">{wpm}</span>
        <input
          type="range"
          min={MIN_WPM}
          max={MAX_WPM}
          value={wpm}
          onChange={(e) => setWpm(Number(e.target.value))}
        />
      </label>

      <div className="controls">
        <button onClick={play} disabled={status === 'playing'}>
          Play
        </button>
        <button onClick={stop} disabled={status !== 'playing'}>
          Stop
        </button>
        <button onClick={replay}>Replay</button>
        <StatusBadge status={status} />
        {duration && <span>Duration: {duration.toFixed(1)}s</span>}
      </div>
    </div>
  );
}

function QuickPlayDemo() {
  const [currentPhrase, setCurrentPhrase] = useState('');
  const [status, setStatus] = useState<MorsePlaybackStatus>('idle');

  const phrases = ['SOS', 'CQ CQ CQ', '73', 'QSL', 'DE W1AW'];

  return (
    <div className="demo-section">
      <h2>Quick Play Demo</h2>
      <p>Click a phrase to play it immediately:</p>

      <div className="controls">
        {phrases.map((phrase) => (
          <button
            key={phrase}
            onClick={() => setCurrentPhrase(phrase)}
            disabled={status === 'playing'}
          >
            {phrase}
          </button>
        ))}
        <StatusBadge status={status} />
      </div>

      {currentPhrase && (
        <MorseAudio
          text={currentPhrase}
          wpm={20}
          autoPlay={true}
          onStatusChange={setStatus}
          onComplete={() => setCurrentPhrase('')}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <div>
      <h1>react-morse-audio Demo</h1>
      <p>
        A React component and hook for playing morse code audio.
      </p>

      <ComponentDemo />
      <HookDemo />
      <QuickPlayDemo />
    </div>
  );
}
