/**
 * Morse code translation utilities
 *
 * Implements ITU International Morse Code with prosign support.
 * Timing follows the PARIS standard (50 units per word).
 */

// Standard ITU Morse Code mappings
const MORSE_CODE: Record<string, string> = {
  'A': '.-',
  'B': '-...',
  'C': '-.-.',
  'D': '-..',
  'E': '.',
  'F': '..-.',
  'G': '--.',
  'H': '....',
  'I': '..',
  'J': '.---',
  'K': '-.-',
  'L': '.-..',
  'M': '--',
  'N': '-.',
  'O': '---',
  'P': '.--.',
  'Q': '--.-',
  'R': '.-.',
  'S': '...',
  'T': '-',
  'U': '..-',
  'V': '...-',
  'W': '.--',
  'X': '-..-',
  'Y': '-.--',
  'Z': '--..',
  '0': '-----',
  '1': '.----',
  '2': '..---',
  '3': '...--',
  '4': '....-',
  '5': '.....',
  '6': '-....',
  '7': '--...',
  '8': '---..',
  '9': '----.',
  '.': '.-.-.-',
  ',': '--..--',
  '?': '..--..',
  "'": '.----.',
  '!': '-.-.--',
  '/': '-..-.',
  '(': '-.--.',
  ')': '-.--.-',
  '&': '.-...',
  ':': '---...',
  ';': '-.-.-.',
  '=': '-...-',
  '+': '.-.-.',
  '-': '-....-',
  '_': '..--.-',
  '"': '.-..-.',
  '$': '...-..-',
  '@': '.--.-.',
};

// Prosigns - sent as single characters without inter-character gaps
const PROSIGNS: Record<string, string> = {
  '<AR>': '.-.-.',    // End of message
  '<AS>': '.-...',    // Wait
  '<BK>': '-...-.-',  // Break
  '<BT>': '-...-',    // New paragraph (= is same)
  '<CL>': '-.-..-..',  // Going off air
  '<CT>': '-.-.-',    // Attention / Start copying
  '<KN>': '-.--.',    // Invite specific station to transmit
  '<SK>': '...-.-',   // End of contact
  '<SN>': '...-.',    // Understood
  '<SOS>': '...---...', // Distress
};

/**
 * Calculate the unit duration in milliseconds for a given WPM
 * Based on PARIS standard: 50 units per word
 * At W wpm: 1 unit = 1200/W ms
 */
function getUnitDuration(wpm: number): number {
  return 1200 / wpm;
}

/**
 * Calculate Farnsworth timing adjustment
 * When fwpm < wpm, we extend the gaps between characters and words
 * while keeping the dit/dah timing at the faster wpm
 */
function getFarnsworthDelay(wpm: number, fwpm: number): { charGap: number; wordGap: number } {
  if (fwpm >= wpm) {
    // No Farnsworth adjustment needed
    const unit = getUnitDuration(wpm);
    return {
      charGap: 3 * unit,
      wordGap: 7 * unit,
    };
  }

  // Calculate total time for PARIS at fwpm (50 units)
  const totalTimeAtFwpm = 50 * getUnitDuration(fwpm);

  // PARIS has 31 units of sounds (dits/dahs) + 4 units intra-char gaps
  // = 35 "character" units at wpm timing
  const soundTime = 35 * getUnitDuration(wpm);

  // Remaining time is for inter-character and word gaps
  // PARIS = P.A.R.I.S (5 chars = 4 inter-char gaps) + 1 word gap
  // Standard: 4 * 3 units + 7 units = 19 units of gaps
  // We need to stretch these gaps
  const gapTime = totalTimeAtFwpm - soundTime;

  // 4 char gaps + 1 word gap, where word gap = 7/3 of char gap
  // total = 4*charGap + (7/3)*charGap = (12/3 + 7/3)*charGap = (19/3)*charGap
  const charGap = gapTime / (19 / 3);
  const wordGap = charGap * (7 / 3);

  return { charGap, wordGap };
}

/**
 * Parse prosigns from text, returning an array of characters/prosigns
 */
function parseText(text: string): string[] {
  const result: string[] = [];
  let i = 0;

  while (i < text.length) {
    if (text[i] === '<') {
      // Look for closing >
      const end = text.indexOf('>', i);
      if (end !== -1) {
        const prosign = text.substring(i, end + 1).toUpperCase();
        if (PROSIGNS[prosign]) {
          result.push(prosign);
          i = end + 1;
          continue;
        }
      }
    }
    result.push(text[i]);
    i++;
  }

  return result;
}

/**
 * Translate text to morse code timings
 *
 * @param text - Text to translate (supports prosigns like <AR>, <SK>, etc.)
 * @param wpm - Words per minute for dit/dah timing
 * @param fwpm - Farnsworth WPM for gaps (if less than wpm, gaps are extended)
 * @returns Object containing timings array (positive = sound, negative = silence in ms)
 */
export function translate(text: string, wpm: number, fwpm: number): { timings: number[] } {
  const timings: number[] = [];
  const unit = getUnitDuration(wpm);
  const { charGap, wordGap } = getFarnsworthDelay(wpm, fwpm);

  const dit = unit;
  const dah = 3 * unit;
  const intraCharGap = unit; // Gap within a character (between dits/dahs)

  const chars = parseText(text);
  let needCharGap = false;

  for (const char of chars) {
    const upper = char.toUpperCase();

    // Handle spaces (word gaps)
    if (char === ' ' || char === '\n' || char === '\t') {
      if (timings.length > 0) {
        // Add word gap minus any existing gap
        timings.push(-wordGap);
        needCharGap = false;
      }
      continue;
    }

    // Get morse pattern
    let pattern: string | undefined;
    if (PROSIGNS[upper]) {
      pattern = PROSIGNS[upper];
    } else {
      pattern = MORSE_CODE[upper];
    }

    if (!pattern) {
      // Unknown character - skip
      continue;
    }

    // Add inter-character gap if needed
    if (needCharGap) {
      timings.push(-charGap);
    }

    // Add the morse pattern
    let needIntraGap = false;
    for (const symbol of pattern) {
      if (needIntraGap) {
        timings.push(-intraCharGap);
      }

      if (symbol === '.') {
        timings.push(dit);
      } else if (symbol === '-') {
        timings.push(dah);
      }

      needIntraGap = true;
    }

    needCharGap = true;
  }

  return { timings };
}
