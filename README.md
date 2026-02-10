# morse-audio

A monorepo containing two packages for generating and playing morse code audio in JavaScript/TypeScript applications.

## Features

- **Pre-rendered audio**: Generate complete WAV files as base64 data URIs
- **Real-time streaming**: Web Audio API engine for live contest simulation
- **Radio effects**: QRN (static), QSB (fading), Rayleigh fading, flutter, chirp, AC hum
- **Pileup simulation**: Mix multiple stations with different frequencies and signal strengths
- **Farnsworth timing**: Adjustable character vs word spacing for learning
- **Prosign support**: `<AR>`, `<SK>`, `<BT>`, `<SOS>`, etc.
- **Zero dependencies**: Core library has no external dependencies

## Packages

| Package | Description | Install |
|---------|-------------|---------|
| [`morse-audio`](./packages/morse-audio) | Core library for generating morse code audio | `npm install morse-audio` |
| [`react-morse-audio`](./packages/react-morse-audio) | React component and hooks for morse playback | `npm install react-morse-audio` |

## Quick Start

### React Applications

```bash
npm install react-morse-audio
```

```tsx
import { MorseAudio } from 'react-morse-audio';

function App() {
  return <MorseAudio text="CQ CQ CQ" wpm={20} autoPlay />;
}
```

### Non-React / Node.js

```bash
npm install morse-audio
```

```typescript
import { generateMorseAudio } from 'morse-audio';

const { dataUri, timings } = generateMorseAudio({
  text: 'HELLO WORLD',
  wpm: 20,
});

// dataUri is a base64-encoded WAV ready for playback
const audio = new Audio(dataUri);
audio.play();
```

### Contest Simulator (Real-time Streaming)

```tsx
import { useContestAudio } from 'react-morse-audio';

function ContestSimulator() {
  const { start, stop, isRunning, playStation, playSidetone, setQRN } = useContestAudio({
    qrn: { snr: 15 },
    bandwidth: 500,
  });

  return (
    <div>
      <button onClick={isRunning ? stop : start}>
        {isRunning ? 'Stop' : 'Start'} Engine
      </button>

      <button onClick={() => playStation({
        text: 'W1ABC',
        wpm: 25,
        frequencyOffset: -100,
        signalStrength: -6,
        effects: { rayleigh: { bandwidth: 0.5, depth: 0.5 } },
      })}>
        Play Station
      </button>

      <button onClick={() => playSidetone({ text: 'TU', wpm: 25 })}>
        Send Sidetone
      </button>
    </div>
  );
}
```

---

## Contest Simulator / Streaming Audio

The streaming engine provides real-time audio for contest simulation:

- **Continuous QRN**: Band noise plays without stopping
- **Dynamic station injection**: Play stations with realistic HF effects
- **Clean sidetone**: Your own sending is loud and clear (no noise)

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                   Web Audio API Graph                        │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐                                           │
│  │  QRN Worklet │──┐                                        │
│  │  (continuous)│  │    ┌─────────────┐                     │
│  └──────────────┘  ├───▶│receiverGain │──┐                  │
│                    │    └─────────────┘  │  ┌────────────┐  │
│  ┌──────────────┐  │                     ├─▶│ masterGain │─▶│ Speakers
│  │ Station Audio│──┘                     │  └────────────┘  │
│  └──────────────┘                        │                  │
│                        ┌─────────────┐   │                  │
│  ┌──────────────┐      │sidetoneGain │───┘                  │
│  │   Sidetone   │─────▶│ (clean/loud)│                      │
│  └──────────────┘      └─────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

The sidetone bypasses the receiver path because in a real radio, your own sending comes from the local oscillator - not through the receiver with all its noise.

See [STREAMING_ARCHITECTURE.md](./packages/morse-audio/STREAMING_ARCHITECTURE.md) for detailed technical documentation.

---

## Package: react-morse-audio

React bindings for morse code audio playback. Provides both a component API and a hook API.

### Installation

```bash
npm install react-morse-audio
```

### Component API

The `<MorseAudio>` component is the simplest way to add morse code playback.

#### Basic Usage

```tsx
import { MorseAudio } from 'react-morse-audio';

function MorsePlayer() {
  return (
    <MorseAudio
      text="SOS"
      wpm={20}
      onComplete={() => console.log('Done!')}
    />
  );
}
```

#### With Ref for Imperative Control

```tsx
import { useRef, useState } from 'react';
import { MorseAudio, MorseAudioRef, MorsePlaybackStatus } from 'react-morse-audio';

function MorsePlayer() {
  const morseRef = useRef<MorseAudioRef>(null);
  const [status, setStatus] = useState<MorsePlaybackStatus>('idle');

  return (
    <div>
      <MorseAudio
        ref={morseRef}
        text="CQ CQ CQ DE W1AW"
        wpm={25}
        autoPlay={false}
        onStatusChange={setStatus}
      />

      <button onClick={() => morseRef.current?.play()}>Play</button>
      <button onClick={() => morseRef.current?.stop()}>Stop</button>
      <button onClick={() => morseRef.current?.replay()}>Replay</button>
      <p>Status: {status}</p>
    </div>
  );
}
```

#### Component Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `text` | `string` | required | Text to convert to morse code |
| `wpm` | `number` | required | Words per minute (5-60) |
| `fwpm` | `number` | `wpm` | Farnsworth WPM - slower spacing between characters |
| `frequency` | `number` | `700` | Audio frequency in Hz (400-1200) |
| `preDelay` | `number` | `300` | Silence before playback (ms) - helps with Bluetooth |
| `postDelay` | `number` | `100` | Silence after playback (ms) - prevents clipping |
| `radioEffects` | `RadioEffectsOptions` | `undefined` | Simulate HF radio conditions |
| `autoPlay` | `boolean` | `true` | Auto-play when text changes |
| `onPlay` | `() => void` | - | Called when playback starts |
| `onComplete` | `() => void` | - | Called when playback completes |
| `onError` | `(error: Error) => void` | - | Called on error |
| `onStatusChange` | `(status) => void` | - | Called when status changes |

#### Ref Methods (MorseAudioRef)

| Method/Property | Type | Description |
|-----------------|------|-------------|
| `play()` | `() => void` | Start playback |
| `stop()` | `() => void` | Stop playback |
| `replay()` | `() => void` | Restart from beginning |
| `status` | `MorsePlaybackStatus` | Current status |
| `duration` | `number \| null` | Audio duration in seconds |

### Hook API

The `useMorseAudio` hook provides full programmatic control.

```tsx
import { useMorseAudio } from 'react-morse-audio';

function MorsePlayer() {
  const { play, stop, replay, status, duration } = useMorseAudio({
    text: 'HELLO WORLD',
    wpm: 25,
    autoPlay: false,
    onComplete: () => console.log('Finished!'),
  });

  return (
    <div>
      <button onClick={play} disabled={status === 'playing'}>
        Play
      </button>
      <button onClick={stop}>Stop</button>
      <button onClick={replay}>Replay</button>
      <p>Status: {status}</p>
      {duration && <p>Duration: {duration.toFixed(1)}s</p>}
    </div>
  );
}
```

### Playback Status

```typescript
type MorsePlaybackStatus =
  | 'idle'       // No text loaded
  | 'loading'    // Generating audio
  | 'ready'      // Audio ready to play
  | 'playing'    // Currently playing
  | 'completed'  // Playback finished
  | 'error';     // Error occurred
```

---

## Package: morse-audio

Core library for generating morse code audio. Works in browsers and Node.js. No dependencies on React.

### Installation

```bash
npm install morse-audio
```

### Basic Usage

```typescript
import { generateMorseAudio } from 'morse-audio';

const result = generateMorseAudio({
  text: 'HELLO WORLD',
  wpm: 20,
});

// result.dataUri - Base64-encoded WAV data URI
// result.timings - Array of timing values in ms
// result.sampleRate - Audio sample rate (22050 Hz)

// Play in browser
const audio = new Audio(result.dataUri);
audio.play();
```

### Calculate Duration Without Generating Audio

```typescript
import { calculateDuration } from 'morse-audio';

const durationMs = calculateDuration({
  text: 'CQ CQ CQ',
  wpm: 20,
  preDelay: 300,
  postDelay: 100,
});

console.log(`Audio will be ${durationMs / 1000} seconds`);
```

### Generator Options

```typescript
interface MorseGeneratorOptions {
  text: string;           // Text to convert
  wpm: number;            // Words per minute (5-60)
  fwpm?: number;          // Farnsworth WPM (defaults to wpm)
  frequency?: number;     // Tone frequency in Hz (400-1200, default: 700)
  preDelay?: number;      // Silence before audio in ms (default: 300)
  postDelay?: number;     // Silence after audio in ms (default: 100)
  radioEffects?: RadioEffectsOptions;  // HF simulation effects
}
```

### Low-Level Utilities

For advanced use cases, you can access the individual utilities:

```typescript
import {
  translate,           // Convert text to morse timing array
  generateSamples,     // Generate PCM audio samples
  getSampleRate,       // Get the audio sample rate
  applyRadioEffects,   // Add noise/fading to samples
  getWavData,          // Encode samples as WAV
  getDataURI,          // Convert WAV to data URI
} from 'morse-audio';
```

---

## Common Patterns

### Quick Play Buttons

Play different phrases with button clicks:

```tsx
import { useState } from 'react';
import { MorseAudio, MorsePlaybackStatus } from 'react-morse-audio';

function QuickPlay() {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<MorsePlaybackStatus>('idle');

  const phrases = ['SOS', 'CQ CQ CQ', '73', 'QSL'];

  return (
    <div>
      {phrases.map((phrase) => (
        <button
          key={phrase}
          onClick={() => setText(phrase)}
          disabled={status === 'playing'}
        >
          {phrase}
        </button>
      ))}

      {text && (
        <MorseAudio
          text={text}
          wpm={20}
          autoPlay={true}
          onStatusChange={setStatus}
          onComplete={() => setText('')}
        />
      )}
    </div>
  );
}
```

### Morse Code Trainer with User Input

```tsx
import { useState, useRef } from 'react';
import { MorseAudio, MorseAudioRef, MorsePlaybackStatus } from 'react-morse-audio';

function MorseTrainer() {
  const [inputText, setInputText] = useState('');
  const [playingText, setPlayingText] = useState('');
  const [status, setStatus] = useState<MorsePlaybackStatus>('idle');
  const [wpm, setWpm] = useState(20);
  const morseRef = useRef<MorseAudioRef>(null);

  const handlePlay = () => {
    setPlayingText(inputText);
  };

  return (
    <div>
      <input
        type="text"
        value={inputText}
        onChange={(e) => setInputText(e.target.value.toUpperCase())}
        placeholder="Enter text..."
      />

      <label>
        WPM: {wpm}
        <input
          type="range"
          min={5}
          max={40}
          value={wpm}
          onChange={(e) => setWpm(Number(e.target.value))}
        />
      </label>

      <button onClick={handlePlay} disabled={status === 'playing' || !inputText}>
        Play
      </button>
      <button onClick={() => morseRef.current?.stop()}>Stop</button>

      <p>Status: {status}</p>

      {playingText && (
        <MorseAudio
          ref={morseRef}
          text={playingText}
          wpm={wpm}
          autoPlay={true}
          onStatusChange={setStatus}
        />
      )}
    </div>
  );
}
```

### Farnsworth Timing for Learning

Farnsworth timing sends characters at full speed but adds extra space between them, making it easier to learn character recognition:

```tsx
import { MorseAudio } from 'react-morse-audio';

function LearnerMode() {
  return (
    <MorseAudio
      text="PARIS"
      wpm={25}    // Characters at 25 WPM
      fwpm={10}   // But spaced as if 10 WPM
      autoPlay={true}
    />
  );
}
```

### Radio Effects for Realistic HF Simulation

Simulate real-world radio conditions with QRN (static/noise) and QSB (fading):

```tsx
import { MorseAudio, RadioEffectsOptions } from 'react-morse-audio';

function RealisticRadio() {
  const radioEffects: RadioEffectsOptions = {
    qrn: {
      snr: 15,  // Signal-to-noise ratio in dB (lower = noisier)
    },
    qsb: {
      depth: 0.5,  // How much signal fades (0-0.9)
      rate: 0.2,   // Fade cycle rate in Hz (0.2 = 5 second cycle)
    },
  };

  return (
    <MorseAudio
      text="CQ CQ CQ DE W1AW"
      wpm={20}
      radioEffects={radioEffects}
    />
  );
}
```

### QRN Only (Noise Without Fading)

```tsx
<MorseAudio
  text="TEST"
  wpm={20}
  radioEffects={{
    qrn: { snr: 10 },  // Very noisy conditions
  }}
/>
```

### QSB Only (Fading Without Noise)

```tsx
<MorseAudio
  text="TEST"
  wpm={20}
  radioEffects={{
    qsb: { depth: 0.7, rate: 0.1 },  // Deep, slow fading
  }}
/>
```

### Adjustable Radio Conditions UI

```tsx
import { useState, useMemo } from 'react';
import {
  MorseAudio,
  RadioEffectsOptions,
  DEFAULT_SNR,
  DEFAULT_FADE_DEPTH,
  DEFAULT_FADE_RATE,
  MIN_SNR,
  MAX_SNR,
} from 'react-morse-audio';

function RadioConditionsDemo() {
  const [text] = useState('CQ CQ CQ');
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

  return (
    <div>
      <label>
        <input
          type="checkbox"
          checked={qrnEnabled}
          onChange={(e) => setQrnEnabled(e.target.checked)}
        />
        Enable QRN (Noise)
      </label>

      {qrnEnabled && (
        <label>
          SNR: {snr} dB
          <input
            type="range"
            min={MIN_SNR}
            max={MAX_SNR}
            value={snr}
            onChange={(e) => setSnr(Number(e.target.value))}
          />
        </label>
      )}

      <label>
        <input
          type="checkbox"
          checked={qsbEnabled}
          onChange={(e) => setQsbEnabled(e.target.checked)}
        />
        Enable QSB (Fading)
      </label>

      {qsbEnabled && (
        <>
          <label>
            Fade Depth: {fadeDepth}
            <input
              type="range"
              min={0}
              max={90}
              value={fadeDepth * 100}
              onChange={(e) => setFadeDepth(Number(e.target.value) / 100)}
            />
          </label>
          <label>
            Fade Rate: {fadeRate} Hz
            <input
              type="range"
              min={5}
              max={200}
              value={fadeRate * 100}
              onChange={(e) => setFadeRate(Number(e.target.value) / 100)}
            />
          </label>
        </>
      )}

      <MorseAudio text={text} wpm={20} radioEffects={radioEffects} />
    </div>
  );
}
```

### Custom Frequency Selection

```tsx
import { useState } from 'react';
import { MorseAudio, MIN_FREQUENCY, MAX_FREQUENCY, DEFAULT_FREQUENCY } from 'react-morse-audio';

function FrequencySelector() {
  const [frequency, setFrequency] = useState(DEFAULT_FREQUENCY);

  return (
    <div>
      <label>
        Tone: {frequency} Hz
        <input
          type="range"
          min={MIN_FREQUENCY}
          max={MAX_FREQUENCY}
          value={frequency}
          onChange={(e) => setFrequency(Number(e.target.value))}
        />
      </label>

      <MorseAudio text="TEST" wpm={20} frequency={frequency} />
    </div>
  );
}
```

### Progress Display with Duration

```tsx
import { useState } from 'react';
import { useMorseAudio } from 'react-morse-audio';

function ProgressDisplay() {
  const { play, stop, status, duration } = useMorseAudio({
    text: 'THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG',
    wpm: 15,
    autoPlay: false,
  });

  return (
    <div>
      <button onClick={play} disabled={status === 'playing'}>
        Play
      </button>
      <button onClick={stop}>Stop</button>

      <p>Status: {status}</p>
      {duration && <p>Total duration: {duration.toFixed(1)} seconds</p>}
    </div>
  );
}
```

### Server-Side Audio Generation

Generate WAV files in Node.js:

```typescript
import { generateMorseAudio } from 'morse-audio';
import { writeFileSync } from 'fs';

const { dataUri } = generateMorseAudio({
  text: 'CQ CQ CQ DE W1AW',
  wpm: 20,
  frequency: 700,
});

// Convert data URI to buffer and save
const base64Data = dataUri.split(',')[1];
const buffer = Buffer.from(base64Data, 'base64');
writeFileSync('morse.wav', buffer);
```

### Sequence of Messages

Play multiple messages in sequence:

```tsx
import { useState, useEffect } from 'react';
import { MorseAudio, MorsePlaybackStatus } from 'react-morse-audio';

function MessageQueue() {
  const messages = ['CQ CQ CQ', 'DE W1AW', 'K'];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [status, setStatus] = useState<MorsePlaybackStatus>('idle');

  const handleComplete = () => {
    if (currentIndex < messages.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setIsPlaying(false);
      setCurrentIndex(0);
    }
  };

  const startSequence = () => {
    setCurrentIndex(0);
    setIsPlaying(true);
  };

  return (
    <div>
      <button onClick={startSequence} disabled={isPlaying}>
        Play Sequence
      </button>

      <p>Playing: {isPlaying ? messages[currentIndex] : 'None'}</p>
      <p>Status: {status}</p>

      {isPlaying && (
        <MorseAudio
          text={messages[currentIndex]}
          wpm={20}
          autoPlay={true}
          onStatusChange={setStatus}
          onComplete={handleComplete}
        />
      )}
    </div>
  );
}
```

---

## Constants

Both packages export these constants for building UIs:

```typescript
// WPM limits
MIN_WPM = 5
MAX_WPM = 60
DEFAULT_WPM = 20

// Frequency limits (Hz)
MIN_FREQUENCY = 400
MAX_FREQUENCY = 1200
DEFAULT_FREQUENCY = 700

// Delay limits (ms)
MIN_PRE_DELAY = 100
MAX_PRE_DELAY = 2000
DEFAULT_PRE_DELAY = 300
MIN_POST_DELAY = 0
MAX_POST_DELAY = 1000
DEFAULT_POST_DELAY = 100

// QRN (noise) - SNR in dB
MIN_SNR = -6   // Noise louder than signal
MAX_SNR = 40   // Very clean
DEFAULT_SNR = 20

// QSB (fading)
MIN_FADE_DEPTH = 0
MAX_FADE_DEPTH = 0.9
DEFAULT_FADE_DEPTH = 0.5
MIN_FADE_RATE = 0.05   // 20 second cycle
MAX_FADE_RATE = 2.0    // 0.5 second cycle
DEFAULT_FADE_RATE = 0.2  // 5 second cycle
```

---

## TypeScript Types

### react-morse-audio

```typescript
import type {
  MorseAudioProps,
  MorseAudioRef,
  MorsePlaybackStatus,
  UseMorseAudioOptions,
  UseMorseAudioReturn,
} from 'react-morse-audio';
```

### morse-audio

```typescript
import type {
  MorseGeneratorOptions,
  GeneratedMorseAudio,
  RadioEffectsOptions,
  QrnOptions,
  QsbOptions,
} from 'morse-audio';
```

---

## Development

```bash
# Clone and install
git clone <repo>
cd morse-audio
npm install

# Run demo app
npm run dev

# Run tests
npm test

# Build all packages
npm run build
```

## License

MIT (c) 2026 Mark Percival <m@mdp.im>
