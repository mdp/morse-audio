import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  MorseAudio,
  useMorseAudio,
  useContestAudio,
  MorseAudioRef,
  MorsePlaybackStatus,
  RadioEffectsOptions,
  ContestEngineStatus,
  PlayStationOptions,
  StationEffectsOptions,
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

// Station pool for contest simulation
interface StationData {
  call: string;
  wpm: number;
  offset: number;
  strength: number;
  effects?: StationEffectsOptions;
}

const stationPool: StationData[] = [
  { call: 'W1ABC', wpm: 25, offset: -150, strength: -3, effects: { rayleigh: { bandwidth: 0.5, depth: 0.4 } } },
  { call: 'K2XYZ', wpm: 28, offset: 100, strength: -9, effects: { rayleigh: { bandwidth: 0.8, depth: 0.6 } } },
  { call: 'N3DEF', wpm: 22, offset: -50, strength: 0 },
  { call: 'VE3GHI', wpm: 26, offset: 200, strength: -6, effects: { flutter: { rate: 15, depth: 0.3 } } },
  { call: 'JA1KLM', wpm: 30, offset: -100, strength: -12, effects: { rayleigh: { bandwidth: 1.2, depth: 0.7 } } },
  { call: 'G4NOP', wpm: 24, offset: 50, strength: -15, effects: { rayleigh: { bandwidth: 0.3, depth: 0.5 }, chirp: { deviation: 15, timeConstant: 30 } } },
  { call: 'DL5QRS', wpm: 27, offset: -200, strength: -6 },
  { call: 'UA3TUV', wpm: 23, offset: 150, strength: -18, effects: { rayleigh: { bandwidth: 1.5, depth: 0.8 } } },
];

interface CallerInfo {
  station: StationData;
  heard: boolean;
}

function ContestStatusBadge({ status }: { status: ContestEngineStatus }) {
  const colors: Record<ContestEngineStatus, string> = {
    stopped: '#888',
    starting: '#f90',
    running: '#0c0',
    error: '#c00',
  };
  return (
    <span style={{
      backgroundColor: colors[status],
      color: '#fff',
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      marginLeft: '8px',
    }}>
      {status}
    </span>
  );
}

function ContestSimulatorDemo() {
  const [qrnEnabled, setQrnEnabled] = useState(true);
  const [snr, setSnr] = useState(12);
  const [bandwidth, setBandwidthState] = useState(500);
  const [sidetoneText, setSidetoneText] = useState('');
  const [sidetoneWpm, setSidetoneWpm] = useState(25);
  const [callers, setCallers] = useState<CallerInfo[]>([]);
  const [workedStations, setWorkedStations] = useState<string[]>([]);
  const [qsoInProgress, setQsoInProgress] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const {
    status,
    isRunning,
    start,
    stop,
    setQRN,
    setBandwidth,
    playStation,
    playSidetone,
    isSending,
    activeStations,
  } = useContestAudio({
    qrn: qrnEnabled ? { snr } : undefined,
    bandwidth,
    sidetoneVolume: 0.9,
    receiverVolume: 0.6,
    onStationComplete: (id) => {
      // Mark caller as heard when their transmission completes
      setCallers(prev => prev.map(c =>
        c.station.call === id ? { ...c, heard: true } : c
      ));
    },
    onSidetoneComplete: () => {
      // Handle QSO flow after sending
    },
    onError: (error) => {
      console.error('Contest audio error:', error);
      addLog(`Error: ${error.message}`);
    },
  });

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLog(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 19)]);
  }, []);

  const handleToggleEngine = async () => {
    if (isRunning) {
      stop();
      addLog('Engine stopped');
    } else {
      await start();
      addLog('Engine started - QRN playing');
    }
  };

  const handleQrnToggle = (enabled: boolean) => {
    setQrnEnabled(enabled);
    setQRN(enabled ? { snr } : null);
    addLog(enabled ? `QRN enabled (SNR: ${snr} dB)` : 'QRN disabled');
  };

  const handleSnrChange = (newSnr: number) => {
    setSnr(newSnr);
    if (qrnEnabled) {
      setQRN({ snr: newSnr });
    }
  };

  const handleBandwidthChange = (newBandwidth: number) => {
    setBandwidthState(newBandwidth);
    setBandwidth(newBandwidth);
    addLog(`Bandwidth set to ${newBandwidth} Hz`);
  };

  const generatePileup = async () => {
    if (!isRunning) {
      addLog('Start the engine first!');
      return;
    }

    // Clear previous callers
    setCallers([]);
    setQsoInProgress(null);

    // Pick 2-4 random stations that haven't been worked
    const available = stationPool.filter(s => !workedStations.includes(s.call));
    if (available.length === 0) {
      addLog('All stations worked! Contest complete!');
      setWorkedStations([]);
      return;
    }

    const numCallers = Math.min(2 + Math.floor(Math.random() * 3), available.length);
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, numCallers);

    addLog(`Pileup: ${selected.map(s => s.call).join(', ')}`);

    // Play all callers with slight random delays
    const newCallers: CallerInfo[] = [];
    for (const station of selected) {
      const delay = Math.random() * 200; // 0-200ms random delay

      setTimeout(async () => {
        try {
          await playStation({
            id: station.call,
            text: station.call,
            wpm: station.wpm,
            frequencyOffset: station.offset,
            signalStrength: station.strength,
            effects: station.effects,
          });
        } catch (e) {
          console.error('Error playing station:', e);
        }
      }, delay);

      newCallers.push({ station, heard: false });
    }

    setCallers(newCallers);
  };

  const handleSendSidetone = async () => {
    if (!isRunning || !sidetoneText.trim()) return;

    addLog(`TX: ${sidetoneText}`);
    await playSidetone({
      text: sidetoneText.toUpperCase(),
      wpm: sidetoneWpm,
    });
    setSidetoneText('');
  };

  const handleStationClick = async (station: StationData) => {
    if (!isRunning) return;

    if (qsoInProgress === station.call) {
      // Complete QSO - station sends "TU"
      addLog(`${station.call}: TU`);
      await playStation({
        id: `${station.call}-tu`,
        text: 'TU',
        wpm: station.wpm,
        frequencyOffset: station.offset,
        signalStrength: station.strength,
        effects: station.effects,
      });

      setWorkedStations(prev => [...prev, station.call]);
      setQsoInProgress(null);
      setCallers([]);
      addLog(`QSO complete with ${station.call}`);
    } else {
      // Station responds with full call
      setQsoInProgress(station.call);
      addLog(`${station.call} responding...`);
      await playStation({
        id: `${station.call}-response`,
        text: `${station.call} 5NN`,
        wpm: station.wpm,
        frequencyOffset: station.offset,
        signalStrength: station.strength,
        effects: station.effects,
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendSidetone();
    }
  };

  return (
    <div className="demo-section">
      <h2>Contest Simulator Demo</h2>
      <p>Simulates a real contest pileup with continuous noise, fading stations, and clean sidetone.</p>

      <div className="controls" style={{ marginBottom: '16px' }}>
        <button
          onClick={handleToggleEngine}
          style={{
            backgroundColor: isRunning ? '#c00' : '#0a0',
            color: '#fff',
            fontWeight: 'bold',
          }}
        >
          {isRunning ? 'Stop Engine' : 'Start Engine'}
        </button>
        <ContestStatusBadge status={status} />
      </div>

      <fieldset className="radio-effects">
        <legend>Receiver Settings</legend>

        <label>
          <input
            type="checkbox"
            checked={qrnEnabled}
            onChange={(e) => handleQrnToggle(e.target.checked)}
            disabled={!isRunning}
          />
          {' '}QRN (Band Noise)
        </label>

        {qrnEnabled && (
          <label className="nested">
            SNR: <span className="value-display">{snr} dB</span>
            <input
              type="range"
              min={MIN_SNR}
              max={MAX_SNR}
              value={snr}
              onChange={(e) => handleSnrChange(Number(e.target.value))}
              disabled={!isRunning}
            />
            <span className="hint">
              {snr < 0 ? 'Extreme QRN' : snr < 6 ? 'Very noisy' : snr < 12 ? 'Noisy' : snr < 20 ? 'Moderate' : 'Clean'}
            </span>
          </label>
        )}

        <label>
          Bandwidth: <span className="value-display">{bandwidth} Hz</span>
          <select
            value={bandwidth}
            onChange={(e) => handleBandwidthChange(Number(e.target.value))}
            disabled={!isRunning}
          >
            <option value={100}>100 Hz (Very Narrow)</option>
            <option value={250}>250 Hz (Narrow)</option>
            <option value={500}>500 Hz (Normal CW)</option>
            <option value={1000}>1000 Hz (Wide)</option>
            <option value={2000}>2000 Hz (Very Wide)</option>
          </select>
        </label>
      </fieldset>

      <fieldset style={{ marginTop: '16px' }}>
        <legend>Contest Operation</legend>

        <div className="controls">
          <button
            onClick={generatePileup}
            disabled={!isRunning || activeStations.length > 0}
            style={{ backgroundColor: '#06c', color: '#fff' }}
          >
            Generate Pileup
          </button>
          <span style={{ marginLeft: '8px', color: '#666' }}>
            Worked: {workedStations.length}/{stationPool.length}
          </span>
        </div>

        {callers.length > 0 && (
          <div style={{ margin: '16px 0' }}>
            <strong>Callers:</strong>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
              {callers.map(({ station, heard }) => (
                <button
                  key={station.call}
                  onClick={() => handleStationClick(station)}
                  disabled={!isRunning || (!heard && activeStations.length > 0)}
                  style={{
                    backgroundColor: qsoInProgress === station.call ? '#f90' :
                                    heard ? '#0a0' : '#666',
                    color: '#fff',
                    opacity: heard || qsoInProgress === station.call ? 1 : 0.7,
                  }}
                >
                  {station.call}
                  {station.strength < -10 && ' (weak)'}
                  {qsoInProgress === station.call && ' [working]'}
                </button>
              ))}
            </div>
            <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
              {qsoInProgress
                ? `Working ${qsoInProgress} - click again to complete QSO`
                : 'Click a station to work them'}
            </p>
          </div>
        )}

        <div style={{ marginTop: '16px' }}>
          <label>
            Your Sidetone (WPM: {sidetoneWpm}):
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <input
                type="text"
                value={sidetoneText}
                onChange={(e) => setSidetoneText(e.target.value.toUpperCase())}
                onKeyDown={handleKeyDown}
                placeholder="e.g., W1? or TU"
                disabled={!isRunning}
                style={{ flex: 1 }}
              />
              <button
                onClick={handleSendSidetone}
                disabled={!isRunning || isSending || !sidetoneText.trim()}
                style={{ backgroundColor: isSending ? '#f90' : '#06c', color: '#fff' }}
              >
                {isSending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </label>
          <input
            type="range"
            min={MIN_WPM}
            max={MAX_WPM}
            value={sidetoneWpm}
            onChange={(e) => setSidetoneWpm(Number(e.target.value))}
            style={{ width: '100%', marginTop: '4px' }}
          />
        </div>
      </fieldset>

      <fieldset style={{ marginTop: '16px' }}>
        <legend>Activity Log</legend>
        <div style={{
          maxHeight: '150px',
          overflowY: 'auto',
          fontFamily: 'monospace',
          fontSize: '12px',
          backgroundColor: '#1a1a1a',
          color: '#0f0',
          padding: '8px',
          borderRadius: '4px',
        }}>
          {log.length === 0 ? (
            <div style={{ color: '#666' }}>No activity yet...</div>
          ) : (
            log.map((entry, i) => (
              <div key={i}>{entry}</div>
            ))
          )}
        </div>
      </fieldset>
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

      <ContestSimulatorDemo />
      <ComponentDemo />
      <HookDemo />
      <QuickPlayDemo />
    </div>
  );
}
