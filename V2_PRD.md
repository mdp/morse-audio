# Building the definitive web-based CW contest trainer

**A modern, browser-based CW training platform can capture a large, underserved market.** The two flagship desktop applications — G4FON Contest Trainer V3 and Morse Runner — remain the gold standard for CW contest simulation, but both face critical limitations: Windows-only distribution, aging codebases, and uncertain futures. G4FON's author became a Silent Key in 2021, freezing development permanently. Morse Runner's original codebase dates to 2004. The community has repeatedly attempted to fill the gap through forks (Morse Runner Community Edition, WebMorseRunner, cwsim, MorseWalker), but **no polished, production-quality, web-based contest simulator exists** that matches the fidelity and breadth of the desktop tools. This report provides the comprehensive technical and competitive intelligence needed to build one.

---

## G4FON Contest Trainer V3: the feature-rich incumbent

G4FON Contest Trainer V3, created by Ray Burlingame-Goff (G4FON, Silent Key 2021) and maintained through the Long Island CW Club, offers the broadest contest format support of any CW trainer. It simulates **10 contest types**: CQ WPX, CQ WW, IOTA, ARRL Field Day, ARRL Sweepstakes, CWOps CWT, NAQCC, SKCC, NAQP, and European VHF Field Day. Each contest uses **real callsign databases** — not random generation — including actual CWOps member numbers, SKCC numbers, and NAQCC numbers pulled from maintained club rosters.

The pileup engine supports **up to 8 simultaneous callers** with configurable parameters: incoming CW speed (average plus variation range), IF bandwidth simulation (spreading callers across the audio passband at different pitches), variable signal strengths, and signal artifacts including **buzz** (AC hum), **chirp** (frequency drift during keying), QRM from adjacent contest stations, and deliberate QRM (DQRM). Each caller delays a randomized interval before re-sending, and approximately **10% of stations** request repeat of the user's exchange — realistic details that experienced operators praise.

G4FON's most distinctive feature is **SO2R (Single Operator Two Radio) training** with stereo audio separation — the main radio in one ear, a second simulated contest in the other. No other CW trainer offers this. The scoring system awards **5 points per correct main-radio QSO, 10 points per SO2R QSO, minus 5 per error**, with results posted to an online leaderboard at ct.g4fon.net organized by contest type. Three practice modes exist: full contest simulation, isolated callsign copying (with adaptive speed that increases on correct answers), and number copying with configurable cut numbers.

The interface emulates **CT (K1EA) contest logging keystrokes**: F1 sends CQ, F2 sends exchange, Enter logs the QSO, Tab moves between fields, and an optional Enter Sends Message (ESM) mode automates message sequencing. A contest timer enables timed sessions (minimum 5 minutes for leaderboard eligibility). Context-sensitive help guides newcomers through each QSO step.

**Critical limitations**: Windows-only (partial Wine/CrossOver compatibility on Mac, often unreliable). The software is $30 shareware — now obtainable only through LICW membership since the author's passing. Only CT keystrokes are supported (no N1MM+ emulation). No custom contest definitions. No cross-session progress tracking. The codebase is permanently frozen.

---

## Morse Runner: the open-source simulation engine

Morse Runner, created by Alex Shovkoplyas (VE3NEA) and released as open source under the Mozilla Public License v2.0, is written in Delphi/Object Pascal and available on GitHub (166 stars, 83 forks). The original version (v1.68, circa 2004–2006) simulates only the CQ WPX contest format but offers four operating modes: **Pileup** (variable simultaneous callers), **Single Calls** (one at a time), **WPX Competition** (timed 60-minute session with online scoreboard), and **HST** (High Speed Telegraphy competition).

What sets Morse Runner apart is its **audio simulation fidelity**. QSB uses a **Rayleigh fading channel model** — the standard mathematical model for HF ionospheric multipath propagation. Flutter simulates **auroral distortion** with rapid amplitude modulation. QRN generates both broadband noise and impulse bursts mimicking atmospheric static crashes. QRM introduces other contest stations bleeding into the passband. The **LID (bad operator) simulation** models calling out of turn, garbled callsigns, incorrect copy triggering AGN requests, non-standard RST reports, duplicate calls, and wrong exchange data. Each simulated operator has a `Skills` attribute and a patience system (`FULL_PATIENCE = 5` cycles before giving up).

Audio generation uses **sine wave direct digital synthesis** at **11,025 Hz sample rate** (22,050 Hz in MorseRunner-Server). Each pileup caller gets independent frequency offset, signal strength, CW speed (ranging from 50–100% of user WPM in original, ±6 WPM in Community Edition), and timing delay. All streams are summed into a single audio buffer. The RX Bandwidth control (adjustable in 50 Hz steps) simulates receiver filter selectivity, attenuating off-frequency signals.

Scoring uses **verified cross-checking**: after a session, the user's log is compared against what simulated stations actually sent. Errors are marked as **DUP** (duplicate), **NIL** (Not In Log — callsign mismatch), **RST** (wrong signal report), or **NR** (wrong exchange number). A 5-minute block rate histogram shows QSO rate trends. Score = QSO Points × Multipliers (unique prefixes in WPX mode).

**The Morse Runner Community Edition (MRCE)**, maintained by W7SST on GitHub (92 stars, 693+ commits, v1.85.1), expands contest support to **12+ formats**: CQ WPX, CQ WW, ARRL DX, ARRL Field Day, ARRL Sweepstakes, NCJ NAQP, CWops CWT, K1USN SST, IARU HF Championship, JARL All Japan, JARL ACAG, and HST. MRCE adds **call history files** for each contest containing realistic exchange data, Farnsworth spacing for K1USN SST, cut number support, mouse wheel RIT/bandwidth control, and fine 2 WPM speed increments. The roadmap includes SO2R, user-defined contests, and GUI redesign.

---

## The competitive landscape beyond the two flagships

The broader CW training ecosystem fragments into several categories, each serving a specific niche but none offering an integrated solution:

**Speed building**: RufzXP (Windows, free) is the gold standard for callsign copying speed. It sends 50 random real callsigns with adaptive speed — correct answers increase WPM, errors decrease it. Scores range from ~5,000 (beginner) to **306,273** (world record by Ianis Scutaru at 200 WPM). The International Toplist at rufzxp.net enables global competition and is the official software for **IARU High Speed Telegraphy Championships**.

**Character learning (web)**: MorseCode.World, built by Stephen C. Phillips on the open-source `morse-pro` JavaScript library, is the **primary tool for CW Academy (CWops)** — the largest structured CW education program, training 400+ students per year. It offers an Adaptive ICR trainer, word lists from multiple CW clubs, QSO simulation, news headline practice, and deep-link sharing for instructors. LCWO.net (by DJ5CW) provides Koch method training with persistent server-side progress tracking and community leaderboards.

**Mobile**: HamMorse (iOS, by AA9PW) offers news feed practice, personalized QSO simulation, and text-delay for blind copying. Morse Mania (Android/iOS) gamifies learning with **270 levels** and 7 key types for sending practice. IZ2UUF Morse Koch (Android) enables screen-off practice with text-to-speech verification — ideal for commuting.

**Emerging web-based competitors**: WebMorseRunner (by DJ1TF) is a complete JavaScript rewrite of Morse Runner, still in beta (v0.11, December 2025), supporting WPX and experimental DARC contests with all band conditions. MorseWalker (by W6NYC/sc0tfree) offers a mobile-optimized web interface with POTA, CWT, and SST modes. HamRadio24-7 CW Contest Trainer (by W2RE) provides browser-based pileup simulation with QRM/QRN/QSB. Morse Trainer Pro (morsetrainerpro.com) integrates hardware devices (Morserino-32, WinKeyer) and offers multi-user "CW Rooms" for real-time internet CW practice.

**The critical gap**: No web application combines Morse Runner's audio simulation fidelity, G4FON's contest format breadth, RufzXP's adaptive scoring, and modern progress tracking in a single platform. Every existing web tool either lacks realistic pileup simulation, supports few contest formats, or is still in early beta.

---

## Contest exchange formats that must be supported

A competitive trainer needs accurate exchange simulation for all major CW contests. Each contest has a distinct QSO flow:

**CQ WPX** (simplest): RST + serial number. `CQ TEST K5ZD` → `JH1NBN` → `JH1NBN 599 237` → `599 045` → `TU K5ZD`. Serial numbers increment with each QSO. Cut numbers are common (5NN = 599, T = 0, N = 9, A = 1).

**CQ WW DX**: RST + CQ zone (1–40). `CQ TEST W1AW` → `DL1ABC` → `DL1ABC 599 05` → `599 14` → `TU W1AW`. Multipliers are zones + DXCC entities per band. Zone data comes from CTY.DAT.

**ARRL Sweepstakes** (most complex exchange in amateur radio): Serial number + precedence (Q/A/B/U/M/S) + callsign + check (last 2 digits of license year) + ARRL section. Example: `123 A W9JJ 79 IL`. Operators frequently request fills: "NR?", "CK?", "PREC?", "SEC?". There are **85+ ARRL/RAC sections** to simulate.

**CWOps CWT**: Name + CWOps member number (members) or name + state/province/country prefix (non-members). Example: `KEN 2389` or `BOB OH`. The CWOps roster contains thousands of entries with sequential member numbers now exceeding 3,000+. CW Academy students send "CWA" instead of a number.

**NAQP**: Name + state/province (NA stations) or name only (non-NA). Example: `TIM PA`. 100W maximum power. **NA Sprint**: Both callsigns + serial + name + state, with a unique **QSY rule** — the CQ-ing station must leave the frequency after each QSO, and the answering station inherits it. This creates a distinctive flow: `N6TR K7GM 047 GEORGE MT` → `048 TREE OR N6TR` → `E` (K7GM QSYs).

**ARRL Field Day**: Operating class + ARRL section. Class format is number of transmitters + letter (e.g., 3A, 1D). Example: `3A CT`. **ARRL DX**: Asymmetric exchange — W/VE stations send RST + state/province; DX stations send RST + power.

**IARU HF Championship**: RST + ITU zone (regular stations) or RST + society abbreviation (HQ stations like ARRL, DARC, RSGB). **Stew Perry Topband**: 4-character Maidenhead grid square (e.g., FN31). Scoring by distance.

---

## Callsign databases and integration architecture

Three database systems underpin all contest training and logging software:

**MASTER.SCP (Super Check Partial)**, maintained by WA1Z at supercheckpartial.com, is a plain-text file containing ~98,560 unique callsigns compiled from **~3.2 million QSOs** across ~3,270 contributed Cabrillo logs from the past 24 months. It contains only callsigns — no exchange data. Contest loggers use it for partial-call matching: typing "OH3" shows OH3UQ, OH3QA, OH3BHL, etc. The older binary format MASTER.DTA (from K1EA's CT program) is what Morse Runner uses natively.

**CTY.DAT (Country File)**, maintained by Jim Reisert (AD1C) at country-files.com and updated weekly, maps callsign prefixes to DXCC entities, CQ zones, ITU zones, continent, latitude/longitude, and UTC offset. Each entry includes exception overrides for specific callsigns (e.g., `=AD1C(4)[6]` places AD1C in CQ Zone 4, ITU Zone 6). This is essential for determining multipliers, beam headings, and contest scoring.

**Call history files** contain callsign-to-exchange mappings for specific contests. For CWT, this means callsign → name + member number. For CQ WW, callsign → CQ zone. For Sweepstakes, callsign → check + section. N1MM+ uses these for "exchange guessing" — pre-filling expected data when a callsign is entered. The CWOps member database is distributed in multiple formats: comma-separated for N1MM+ (`W1AW,HIRAM 1`), semicolon-separated for CQRLOG (`K7SDW;6224`), maintained by OK1RR with roughly twice-weekly updates.

For a web-based trainer, these databases should be loaded as JSON or indexed structures. The MASTER.SCP file is small enough (~2MB) to load entirely in browser memory. CTY.DAT parsing requires a prefix-matching algorithm that handles exceptions. Call history files per contest enable realistic exchange generation.

---

## What the community actually wants

**Platform independence is the single most demanded improvement.** Multiple independent developers have created cross-platform alternatives specifically to solve this: cwsim (Python/Qt), WebMorseRunner (JavaScript), MorseWalker (web), and MorseRunner-Server (Linux/Windows). A SOTA Reflector post captured the sentiment: "Morse Runner is very popular but limited by being an app that requires installation. Wouldn't it be handy to have a browser-based version?" A Linux Mint Forums user was blunter: "The code learning software available for Linux just stinks."

**Unified training pipeline** is the second major gap. Today, learners must cobble together 3–5 separate tools: G4FON or LCWO for character learning, MorseCode.World for ICR drills, RufzXP for speed building, and Morse Runner for contest simulation. No single application takes a user from first-character recognition through contest-level pileup handling with progressive difficulty.

**Cross-session progress tracking** is backed by learning science. When G4FON added Practice History in v10.7, it was developed with neuropsychologist Bob Condor (K4RLC), who identified that "what was needed to keep people motivated was some form of session logging which keeps track of the time they spent and their progress." LCWO.net's persistent tracking is frequently praised. Yet no contest simulator tracks improvement over time — error patterns, rate progression, accuracy trends, or weak character identification.

**Social and competitive features** have proven demand. RufzXP's International Toplist drives engagement across thousands of users worldwide. Informal Morse Runner competitions run on Facebook (UZ2M group, 10-minute challenges). G4FON's leaderboard attracted regular participants. Morse Trainer Pro's "CW Rooms" for multi-user real-time practice was marketed as a "world first." Users want club leaderboards, challenge modes, and score sharing.

**Search-and-pounce mode** is notably absent from all contest trainers. Every existing tool simulates only the "running" (CQ-ing) side of contesting. Real contests involve significant time searching for and answering other stations' CQs — a fundamentally different skill that no software currently trains.

---

## Technical architecture for the web-based implementation

Building a React/TypeScript/Vite application that matches desktop audio fidelity requires careful use of the **Web Audio API**. WebMorseRunner's JavaScript implementation proves the approach works: `OscillatorNode` for sine wave CW generation within a shared `AudioContext`, `GainNode` for per-station amplitude control (enabling QSB simulation), and additive mixing of multiple simultaneous tone generators for pileup simulation.

**Key audio parameters to replicate**: Rayleigh fading for QSB (sum of two independent Gaussian random processes producing a Rayleigh-distributed envelope), raised-cosine keying envelopes for realistic CW rise/fall times (eliminating clicks), per-station frequency offsets within a configurable receiver bandwidth, and impulse noise generation for QRN. The sample rate should be **22,050 Hz or higher** (the original Morse Runner's 11,025 Hz is adequate but modern browsers easily handle 44,100 Hz). Audio buffer size should be configurable to balance latency versus smoothness.

**Operator simulation state machine**: Each simulated station needs independent states (NeedPrevEnd → NeedQso → NeedNr → NeedCall → NeedEnd → Done/Failed), a patience counter (decrementing toward giving up), configurable skills level (controlling LID behavior probability), randomized send delay, and independent CW speed, pitch offset, and signal strength. The FULL_PATIENCE constant of 5 cycles from Morse Runner's source code is a good baseline.

**Scoring engine**: Implement verified cross-checking — maintain a "truth" log of what each simulated station actually sent, then compare against the user's logged entries. Flag DUP, NIL, RST, and NR errors. Calculate raw and verified scores using contest-specific multiplier rules. Display QSO rate in 5-minute block histograms. Persist session results in IndexedDB or a backend for cross-session analytics.

**Database architecture**: Parse MASTER.SCP into a trie or prefix-indexed structure for O(1) partial matching. Parse CTY.DAT for country/zone lookup. Load contest-specific call history files as JSON maps. The CWOps roster should be fetchable as a JSON API endpoint or bundled as a static resource, enabling CWT exchange generation with real member names and numbers.

---

## Conclusion: the product opportunity is clear and immediate

The CW training software market has a well-defined gap: **no web-based application combines realistic contest simulation with broad format support, adaptive progression, and modern UX.** G4FON's development is permanently frozen. Morse Runner's Community Edition advances slowly in a niche language (Delphi). Early web-based attempts (WebMorseRunner, MorseWalker) remain in beta with limited contest coverage.

A React/TypeScript application should prioritize these capabilities in order: **(1)** High-fidelity audio engine with Web Audio API — Rayleigh fading, configurable pileup density, LID behaviors, and QRM/QRN — because audio realism is what makes users describe Morse Runner as "so convincing I forget I'm communicating with a computer." **(2)** Support for the 8 most-contested formats: CQ WPX, CQ WW, ARRL Sweepstakes, ARRL Field Day, CWOps CWT, NAQP, ARRL DX, and K1USN SST (for beginners via Farnsworth spacing). **(3)** Adaptive progressive difficulty — start with single calls at low speed, automatically increase WPM and activity level as accuracy stabilizes, introduce band conditions incrementally. **(4)** Cross-session analytics tracking QSO rate, accuracy, busted call patterns, per-character error rates, and speed tolerance over time. **(5)** Global and club leaderboards with encrypted score submission, enabling both RufzXP-style competitive speed building and Morse Runner-style contest score comparison.

Three features would differentiate this product from everything on the market: **search-and-pounce mode** (currently absent from all trainers), **SO2R simulation with stereo Web Audio panning** (matching G4FON's unique capability but in a browser), and **an integrated learning pipeline** from character recognition through contest-level pileup handling — eliminating the need for 3–5 separate tools. The combination of platform independence, modern UX, and feature completeness positions this application to become the definitive CW training platform for the global amateur radio community.
