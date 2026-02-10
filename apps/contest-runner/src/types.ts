// QSO state machine states
export type QsoState = 'idle' | 'cqing' | 'listening' | 'working' | 'sending_exchange' | 'logging' | 'sending_tu';

// Caller operator state machine (DxOper states from MorseRunner)
export type OperatorState =
  | 'osNeedPrevEnd'  // Waiting for previous QSO to end
  | 'osNeedQso'      // Heard CQ, ready to call
  | 'osNeedNr'       // Operator sent our call, waiting for exchange
  | 'osNeedCall'     // Partial match, need to send call again
  | 'osNeedCallNr'   // Partial match, need call + exchange
  | 'osNeedEnd'      // Sent our exchange, waiting for TU
  | 'osDone'         // QSO complete
  | 'osFailed';      // Gave up

// Contest settings for band conditions and difficulty
export interface ContestSettings {
  activity: number;   // 1-9, controls pileup density
  qsb: boolean;       // Enable QSB fading
  qrm: boolean;       // Enable QRM interference
  flutter: boolean;   // Enable flutter effect
  lids: boolean;      // Enable lid operators (mistakes)
}

// Caller skill level affects behavior
export type SkillLevel = 'low' | 'medium' | 'high';

// A caller in the pileup
export interface Caller {
  id: string;
  call: string;
  prefix: string;
  wpm: number;
  frequencyOffset: number;
  signalStrength: number;
  serial: number;
  heard: boolean;

  // State machine
  state: OperatorState;
  patience: number;       // Retries left before giving up (3-5)
  retryCount: number;     // How many times caller has retried

  // Timing
  sendDelay: number;      // Delay before sending (100-600ms)
  replyTimeout: number;   // How long to wait for reply (3-6s)
  lastActivityTime: number; // Timestamp of last send

  // Characteristics
  skill: SkillLevel;
  isLid: boolean;         // Makes mistakes

  // QSB fading parameters (if enabled)
  qsbBandwidth?: number;  // 0.1-30 Hz
  qsbDepth?: number;      // 0-1, typically ~0.7
}

// A logged QSO
export interface QsoEntry {
  id: string;
  call: string;
  sentRst: string;
  sentSerial: number;
  rcvdRst: string;
  rcvdSerial: number;      // What user entered
  actualSerial: number;    // What caller actually sent
  prefix: string;
  isMultiplier: boolean;
  isDupe: boolean;         // Worked this call before
  isBustedExchange: boolean; // User copied serial wrong
  timestamp: number;
  points: number;          // Raw points (before verification)
  verifiedPoints: number;  // 0 if dupe or busted
}

// Main contest state
export interface ContestState {
  // Session
  isRunning: boolean;
  startTime: number | null;

  // QSO state machine
  qsoState: QsoState;

  // Current QSO
  currentCall: string;
  selectedCaller: Caller | null;
  // User-entered received exchange (what they typed)
  enteredRst: string;
  enteredNr: string;

  // Callers in the pileup
  callers: Caller[];

  // Log
  log: QsoEntry[];
  nextSerial: number;

  // Worked prefixes for multiplier tracking
  workedPrefixes: Set<string>;

  // Settings
  userCall: string;
  wpm: number;

  // Band conditions
  qrnEnabled: boolean;
  snr: number;
  bandwidth: number;

  // Contest settings (MorseRunner-style)
  contestSettings: ContestSettings;
}

// Actions for the state reducer
export type ContestAction =
  | { type: 'START_CONTEST' }
  | { type: 'STOP_CONTEST' }
  | { type: 'SET_QSO_STATE'; state: QsoState }
  | { type: 'SET_CURRENT_CALL'; call: string }
  | { type: 'SELECT_CALLER'; caller: Caller }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_ENTERED_RST'; rst: string }
  | { type: 'SET_ENTERED_NR'; nr: string }
  | { type: 'ADD_CALLERS'; callers: Caller[] }
  | { type: 'CLEAR_CALLERS' }
  | { type: 'MARK_CALLER_HEARD'; id: string }
  | { type: 'UPDATE_CALLER'; id: string; updates: Partial<Caller> }
  | { type: 'REMOVE_CALLER'; id: string }
  | { type: 'LOG_QSO' }
  | { type: 'SET_USER_CALL'; call: string }
  | { type: 'SET_WPM'; wpm: number }
  | { type: 'SET_QRN_ENABLED'; enabled: boolean }
  | { type: 'SET_SNR'; snr: number }
  | { type: 'SET_BANDWIDTH'; bandwidth: number }
  // Contest settings
  | { type: 'SET_ACTIVITY'; activity: number }
  | { type: 'SET_QSB_ENABLED'; enabled: boolean }
  | { type: 'SET_QRM_ENABLED'; enabled: boolean }
  | { type: 'SET_FLUTTER_ENABLED'; enabled: boolean }
  | { type: 'SET_LIDS_ENABLED'; enabled: boolean };

// Callsign pool entry
export interface CallsignEntry {
  call: string;
  prefix: string;
  continent: 'NA' | 'SA' | 'EU' | 'AS' | 'OC' | 'AF';
}

// Message templates
export interface MessageTemplates {
  CQ: string;
  EXCHANGE: string;
  TU: string;
  AGN: string;
  NR: string;
}
