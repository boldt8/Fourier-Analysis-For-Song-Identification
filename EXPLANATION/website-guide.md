# Fingerprint Atlas: How the Website Works

This file explains what each section of the website is doing, how the song-recognition pipeline works, and which exact Fourier transform is used in this project.

## Big Picture

The website is a simplified Shazam-style system.

It does two jobs at once:

1. It **records and analyzes audio**.
2. It **shows the math visually** so you can explain what is happening step by step.

The core idea is:

- Turn sound into numbers.
- Break the sound into short overlapping pieces.
- Convert each piece from the **time domain** into the **frequency domain**.
- Build a spectrogram.
- Keep only strong local peaks.
- Turn peaks into compact fingerprint hashes.
- Compare those hashes against a database of known songs.

---

## What the Website Displays

### Hero Section

This is the top section with:

- the title
- the short description
- the recording controls
- the capture status text

What it does:

- `Start 8s Recording` records from the microphone.
- `Stop` manually ends the recording.
- `Load Demo Signal` generates a fake musical signal so you can test the visuals even without a real song.

The timer shows how long the recording has been running.

---

## Summary Cards

These are the small statistic boxes near the top.

### Working Rate

This shows the sample rate used for analysis.

In this project it is:

- `11025 Hz`

That means the signal is represented by `11025` samples per second.

The microphone may record at a different rate at first, but the code resamples it to `11025 Hz` before analysis.

### Clip Length

This is the duration of the analyzed audio clip after preprocessing.

### Frames

A frame is one short chunk of the audio signal.

This project uses:

- frame size = `2048` samples
- hop size = `512` samples

So the clip is split into many overlapping windows.

### Sparse Peaks

This is the number of important spectrogram peaks kept after filtering.

The system throws away most of the spectrogram and keeps only local maxima that stand out.

### Landmarks

This is the number of fingerprint pairs built from the peaks.

Each landmark is a relationship between two peaks:

- first frequency
- second frequency
- time difference

### Analysis Time

This is how long the browser took to run the DSP pipeline.

### Source

This says whether the input came from:

- microphone capture
- synthetic demo signal

---

## Control Strip

### Selected Frame Slider

This chooses which short frame of the audio clip you want to inspect.

The full clip contains many overlapping frames. This slider lets you zoom into one specific frame and see:

- its raw waveform
- its windowed waveform
- its FFT spectrum

### Teaching DFT Bin Slider

This controls the small educational Fourier example.

It does **not** change the real recognition algorithm. It changes which frequency bin `k` is shown in the teaching panel.

That panel explains the DFT as a dot product with sine/cosine basis waves.

---

## Analysis Panels

The main grid of the page is the mathematical pipeline.

## 1. Waveform Overview

Label on the page:

- `1. Signal As Vector`
- `x ∈ R^N`

Meaning:

- The audio clip is treated as a vector of real numbers.
- Every sample is one entry in the vector.

What you are seeing:

- amplitude on the vertical axis
- time on the horizontal axis

If a frame is selected, the highlighted region shows where that frame sits inside the full audio clip.

Why it matters:

- This is the raw signal before frequency analysis.
- It is the starting point for all later math.

---

## 2. Sliding Window

Label on the page:

- `2. Frame Selection`
- `x_t = S_t x`

Meaning:

- `x` is the whole signal.
- `S_t` is a conceptual selection operator that extracts one local chunk.
- `x_t` is the selected frame at time step `t`.

What the code does:

- It cuts the signal into frames of `2048` samples.
- It moves forward by `512` samples each time.

So adjacent frames overlap heavily.

Why it matters:

- Audio changes over time.
- If you apply one Fourier transform to the whole song, you lose time information.
- Framing lets you ask: "What frequencies exist at this moment?"

---

## 3. Hann Taper

Label on the page:

- `3. Windowing`
- `y_t = Hx_t`

Meaning:

- `H` is a diagonal windowing matrix in the linear algebra interpretation.
- In code, this means multiply each sample in the frame by a Hann window value.

What the panel shows:

- the raw frame
- the same frame after the Hann window is applied

Why this is used:

- A frame cuts the signal abruptly at the left and right edges.
- That sharp cut creates spectral leakage.
- The Hann window smoothly reduces the edges toward zero.

Exact window formula used:

`w[n] = 0.5 - 0.5 cos(2πn / (N - 1))`

for `n = 0, 1, ..., N-1`.

---

## 4. Magnitude Spectrum

Label on the page:

- `4. Runtime FFT`
- `|F y_t|`

Meaning:

- `F` is the Fourier transform matrix idea.
- `y_t` is the windowed frame.
- `F y_t` gives complex frequency coefficients.
- The panel shows the magnitude of those coefficients.

What you are seeing:

- horizontal axis = frequency
- vertical axis = magnitude

Only the frequency band used for matching is emphasized:

- about `250 Hz` to `5000 Hz`

Why this matters:

- This is the step that changes the signal from "samples over time" into "energy by frequency".

---

## 5. DFT Basis Projection

Label on the page:

- `5. Teaching View`
- `X[k] = Σ x[n] e^{-i2πkn/N}`

This panel is the educational explanation view.

It is showing:

- a tiny downsampled version of the selected frame
- the cosine basis for one bin
- the sine basis for one bin
- the pointwise products
- the accumulated real and imaginary sums

Why this exists:

- The runtime FFT is fast, but it hides the direct mathematical meaning.
- This panel shows the DFT as a projection of the signal onto oscillating basis functions.

Important distinction:

- The **runtime recognizer** uses the FFT implementation.
- This **teaching panel** shows the equivalent DFT idea on a small example so the math is easy to see.

---

## 6. Time-Frequency Heatmap

Label on the page:

- `6. Spectrogram Matrix`
- `S ∈ R^(F×T)`

Meaning:

- Each column corresponds to one frame in time.
- Each row corresponds to one frequency bin.
- The color represents strength.

This is the spectrogram.

How it is built:

1. Frame the signal.
2. Apply a Hann window to each frame.
3. Compute FFT magnitude for each frame.
4. Convert magnitudes to decibels.
5. Stack the results into a matrix.

Why it matters:

- The spectrogram is the main object used to find robust fingerprint features.

---

## 7. Local Peaks

Label on the page:

- `7. Sparsification`
- `P = {(f, t)}`

Meaning:

- From the full spectrogram, only a sparse set of important points is kept.
- Each point has a frequency and a time location.

What the code does:

- Searches for local maxima in a neighborhood in time and frequency.
- Rejects weak bins below a threshold.
- Keeps only the strongest peaks overall.

Why this matters:

- Matching entire spectrograms is expensive and fragile.
- Peaks are much more compact and stable.

This is very close in spirit to classic Shazam-style fingerprinting.

---

## 8. Anchor-Target Pairs

Label on the page:

- `8. Landmark Hashes`
- `(f1, f2, Δt)`

What this means:

- Pick one peak as an anchor.
- Pair it with a later peak.
- Store:
  - anchor frequency
  - target frequency
  - time gap

This turns the peak cloud into compact fingerprints.

Why this works:

- A song is not identified by one frequency alone.
- It is identified by stable relationships between peaks.

In the code, these triples are packed into integer hashes for fast lookup in SQLite.

---

## 9. Match Stage

Label on the page:

- `9. Match Stage`
- `arg max votes(track, offset)`

This is the recognition step.

What happens:

1. The query clip produces landmark hashes.
2. Each hash is looked up in the fingerprint database.
3. Every match votes for:
   - a track
   - a relative alignment offset
4. The track-offset pair with the strongest consistent vote wins.

What the histogram shows:

- bars represent likely offsets
- the strongest bar means many hashes agree on the same alignment

Why the offset is important:

- The same song might start at different times in the recording.
- A correct match should still line up with one dominant offset.

---

## What Exact Fourier Transform Is Used?

This is the most important technical answer.

## Runtime Fourier Transform

The actual recognition pipeline uses:

- a **forward discrete Fourier transform**
- computed with a **radix-2 Cooley-Tukey FFT**
- in **iterative decimation-in-time** form
- using **bit-reversal reordering**
- on **real-valued input**
- after **Hann windowing**
- with **frame length 2048**

In practical terms:

1. A frame of `2048` real samples is taken.
2. The frame is multiplied by a Hann window.
3. The code runs the FFT from [shared/dsp/fft.js](/Volumes/APFST9/Coding-Stuff/LARP/shared/dsp/fft.js).
4. It computes the complex spectrum.
5. It keeps the magnitude:
   - `sqrt(real^2 + imag^2)`
6. It keeps only the nonnegative frequencies:
   - from bin `0` to bin `N/2`

## Exact sign convention

The FFT uses the forward-transform phase:

`e^(-i 2π k n / N)`

You can see this from the code:

- `phaseStep = (-2 * Math.PI) / size`
- `cos(angle)` and `sin(angle)` are used to build the twiddle factor

So this is the standard forward DFT sign convention with a **negative exponential**.

## Is it normalized?

No.

The transform in this code is **unnormalized**.

That means:

- the forward FFT does not divide by `N`
- magnitudes scale with frame length

That is completely fine here because the system compares relative magnitudes and local peaks, not absolute physical units.

## Is it a full complex FFT or a special real FFT?

Implementation-wise, it runs a **general complex FFT** with imaginary input set to zero.

Then it returns only the nonnegative half of the spectrum because the input is real.

So mathematically:

- it is a full complex DFT

but operationally:

- it is used like a real-input FFT magnitude pipeline

## Is it STFT?

Yes, the overall method is a **Short-Time Fourier Transform style pipeline**.

More precisely:

- segment into overlapping frames
- multiply each frame by a Hann window
- run the FFT on each frame
- stack magnitudes over time

That creates the spectrogram.

## Teaching Fourier Transform

The teaching panel uses the direct DFT formula:

`X[k] = Σ x[n] e^(-i2πkn/N)`

on a tiny simplified signal.

That panel is for understanding the math visually. It is not the optimized path used for runtime matching.

---

## How the Recognition Pipeline Works End to End

## Step 1: Capture

The browser records a clip from the microphone.

The input may start at a different sample rate depending on the machine.

## Step 2: Normalize and Resample

The clip is:

- mean-centered
- amplitude normalized
- resampled to `11025 Hz`

This makes the analysis consistent across recordings.

## Step 3: STFT Analysis

The clip is split into frames:

- frame size `2048`
- hop size `512`

Each frame gets:

- Hann window
- FFT
- magnitude spectrum
- dB conversion

## Step 4: Build the Spectrogram

All frame spectra are stacked into a matrix over time.

## Step 5: Peak Picking

The code keeps strong local maxima and discards the rest.

## Step 6: Landmark Hashes

Pairs of peaks are turned into integer hashes.

Each hash represents a local frequency pattern.

## Step 7: Database Lookup

The backend stores known-song hashes in SQLite.

For each query hash:

- find matching known-song hashes

## Step 8: Offset Voting

For each matching hash:

- compare the query anchor time and database anchor time
- compute the offset
- vote for that `(track, offset)` pair

## Step 9: Winner Selection

The best match is accepted only if it is strong enough.

Current thresholds in the code:

- minimum best vote count: `12`
- ratio over second-best candidate: `1.35`

If those conditions are not met, the result is:

- `no_confident_match`

---

## Why This Relates to Linear Algebra

This project is a good linear algebra demo because many parts can be described as matrix or vector operations.

### Signal as vector

The audio clip is:

- `x ∈ R^N`

### Frame selection as a linear operator

Selecting a local piece can be thought of as:

- `x_t = S_t x`

### Windowing as diagonal matrix multiplication

Applying the Hann window can be written as:

- `y_t = H x_t`

where `H` is diagonal.

### Fourier transform as basis change

The DFT changes coordinates from:

- time basis

to:

- sinusoidal frequency basis

### Spectrogram as a matrix

The collection of frame spectra is a matrix:

- rows = frequencies
- columns = times

### Peak selection as sparsification

You reduce a dense matrix into a sparse set of meaningful coordinates.

### Hash voting as pattern agreement

The match stage is really a discrete consensus problem:

- many small local matches vote for one global alignment

---

## Important Simplifications in This Project

This is not a full industrial Shazam clone.

It is simplified on purpose for learning.

Main simplifications:

- small local song catalog
- browser-side educational visualizations
- one sample rate for analysis
- simple resampling
- local SQLite database
- custom FFT implementation

That is good for a school project because the math is visible and the code is understandable.

---

## Files to Read If You Want To Study the Code

- UI layout: [client/index.html](/Volumes/APFST9/Coding-Stuff/LARP/client/index.html)
- Frontend orchestration: [client/app.js](/Volumes/APFST9/Coding-Stuff/LARP/client/app.js)
- Canvas rendering: [client/views.js](/Volumes/APFST9/Coding-Stuff/LARP/client/views.js)
- FFT implementation: [shared/dsp/fft.js](/Volumes/APFST9/Coding-Stuff/LARP/shared/dsp/fft.js)
- STFT pipeline: [shared/dsp/stft.js](/Volumes/APFST9/Coding-Stuff/LARP/shared/dsp/stft.js)
- Peak extraction: [shared/dsp/peaks.js](/Volumes/APFST9/Coding-Stuff/LARP/shared/dsp/peaks.js)
- Landmark hashing: [shared/dsp/landmarks.js](/Volumes/APFST9/Coding-Stuff/LARP/shared/dsp/landmarks.js)
- Combined analysis: [shared/dsp/analyze.js](/Volumes/APFST9/Coding-Stuff/LARP/shared/dsp/analyze.js)
- Matching logic: [server/match.js](/Volumes/APFST9/Coding-Stuff/LARP/server/match.js)

---

## Short Answer You Can Say In Class

If you need a concise explanation for presentation:

> The website records audio, resamples it, splits it into overlapping windows, applies a Hann window, runs a radix-2 Cooley-Tukey FFT on each frame, builds a spectrogram, keeps strong local peaks, turns peak pairs into fingerprint hashes, and matches those hashes against a song database using offset voting.

And if someone asks what Fourier transform is used:

> It uses an unnormalized forward discrete Fourier transform, computed by an iterative radix-2 decimation-in-time Cooley-Tukey FFT, on 2048-sample Hann-windowed frames.
