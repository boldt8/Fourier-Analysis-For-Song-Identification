# Fingerprint Atlas

A Bun-served Shazam-style school project with a browser visualization frontend and a Bun backend fingerprint matcher.

- microphone capture through `AudioWorklet`
- waveform, framing, windowing, FFT, spectrogram, peak, and landmark views
- a teaching DFT panel that shows basis projection on a miniature frame
- SQLite-backed fingerprint catalog build and matching endpoints

## Run

```bash
bun run dev
```

Open `http://localhost:8080`.

## Build The Catalog

1. Put audio files in `data/catalog/`.
2. Optional: add `data/catalog/manifest.json` to define titles and artists.
3. Build fingerprints:

```bash
bun run catalog:build
```

## Current Scope

- Frontend analysis is implemented in browser-side JavaScript modules.
- The Bun server serves static files, track metadata, and recognition endpoints.
- Matching is designed for a small local catalog that you preprocess offline with `ffmpeg`.
# Fourier-Analysis-For-Song-Identification
