# Fourier Analysis for Song Identification

A Shazam-style audio fingerprinting project that identifies songs by extracting spectral landmarks from short audio clips.

The project also includes an interactive browser visualization that shows how raw audio is transformed through framing, Fourier analysis, spectral peaks, and fingerprint landmarks.

## Overview

Song identification works by converting audio into a compact representation that is much easier to compare than the original waveform.

The pipeline is approximately:

```text
Audio
  ↓
Resampling / framing
  ↓
Windowing
  ↓
Fourier transform
  ↓
Spectrogram
  ↓
Spectral peak detection
  ↓
Landmark pairs
  ↓
Fingerprint hashes
  ↓
Database lookup
  ↓
Offset voting
  ↓
Best matching song
```

The matching system is designed for a local catalog of songs that is fingerprinted ahead of time.

## Features

- Browser microphone capture
- Waveform visualization
- Frame and windowing visualization
- FFT / frequency-domain visualization
- Spectrogram display
- Spectral peak detection
- Landmark visualization
- Educational DFT visualization
- Offline catalog fingerprint generation
- SQLite-backed fingerprint storage
- Short-query song recognition
- Match confidence and offset-based voting

## Tech Stack

- **JavaScript**
- **Bun**
- **Web Audio API**
- **AudioWorklet**
- **SQLite**
- **FFmpeg** for catalog preprocessing
- HTML / CSS

## Running the Project

### Requirements

- Bun
- FFmpeg
- A modern browser

### Start the Application

```bash
git clone https://github.com/boldt8/Fourier-Analysis-For-Song-Identification.git
cd Fourier-Analysis-For-Song-Identification
bun run dev
```

Open:

```text
http://localhost:8080
```

## Building a Song Catalog

Place audio files in:

```text
data/catalog/
```

Optionally add a manifest containing track metadata.

Then build the fingerprint database:

```bash
bun run catalog:build
```

After the catalog is built, the recognition endpoint can compare incoming PCM audio against the stored fingerprints.

## Recognition API

The Bun server exposes:

```text
POST /api/recognize
```

The request body contains **Float32 PCM samples**.

An optional header can specify the input sample rate:

```text
x-sample-rate: 44100
```

The server:

1. converts the query into spectral features
2. extracts peaks
3. creates landmark hashes
4. looks up matching hashes in the catalog
5. groups matches by relative time offset
6. selects the strongest candidate

## Why Fingerprints Work

A complete waveform is too sensitive to recording differences to compare directly.

Instead, the algorithm uses prominent points in the spectrogram. Pairs of these peaks encode relationships between frequencies and time offsets.

A simplified landmark can be thought of as:

```text
(frequency_1, frequency_2, time_difference)
```

These values are converted into hashes.

During recognition, many query hashes independently vote for a track and an alignment offset. A correct song tends to produce a strong cluster of votes around one consistent offset.

## Project Structure

```text
.
├── client/             # Browser UI and audio visualizations
├── server/             # Matching and catalog logic
├── shared/             # Shared analysis configuration
├── scripts/            # Catalog-building tools
├── data/               # Local catalog / fingerprint data
├── tests/
├── server.js           # Bun HTTP server
└── package.json
```

## Educational Side

In addition to recognizing songs, the frontend is designed to make the signal-processing pipeline visible.

Instead of treating the Fourier transform as a black box, the application exposes intermediate steps so users can see the relationship between:

- time-domain audio
- frames
- windows
- frequency components
- spectrograms
- peaks
- fingerprint landmarks

## What I Learned

This project helped me connect mathematical Fourier analysis to a practical system. It required working with digital signal processing, browser audio, efficient feature representations, database indexing, and a real matching algorithm rather than simply calling an external song-recognition API.
