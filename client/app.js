import { ANALYSIS_CONFIG } from "../shared/config.js";
import { startCapture } from "./audio/capture.js";
import { normalizeSamples, resampleLinear, createDemoSignal } from "../shared/dsp/preprocess.js";
import { analyzeSamples } from "../shared/dsp/analyze.js";
import { createTeachingProjection } from "../shared/dsp/teaching.js";
import {
  renderWaveform,
  renderFrameComparison,
  renderSpectrum,
  renderTeachingProjection,
  renderSpectrogram,
  renderPeaks,
  renderLandmarks,
  renderMatchResult,
} from "./views.js";

const elements = {
  status: document.querySelector("#statusText"),
  timer: document.querySelector("#timerValue"),
  startButton: document.querySelector("#startButton"),
  stopButton: document.querySelector("#stopButton"),
  demoButton: document.querySelector("#demoButton"),
  frameSlider: document.querySelector("#frameSlider"),
  frameLabel: document.querySelector("#frameLabel"),
  teachingBinSlider: document.querySelector("#teachingBinSlider"),
  teachingBinLabel: document.querySelector("#teachingBinLabel"),
  sampleRateValue: document.querySelector("#sampleRateValue"),
  durationValue: document.querySelector("#durationValue"),
  frameCountValue: document.querySelector("#frameCountValue"),
  peakCountValue: document.querySelector("#peakCountValue"),
  landmarkCountValue: document.querySelector("#landmarkCountValue"),
  runtimeValue: document.querySelector("#runtimeValue"),
  sourceValue: document.querySelector("#sourceValue"),
  frameInfo: document.querySelector("#frameInfo"),
  teachingInfo: document.querySelector("#teachingInfo"),
  peakInfo: document.querySelector("#peakInfo"),
  matchInfo: document.querySelector("#matchInfo"),
  waveformCanvas: document.querySelector("#waveformCanvas"),
  frameCanvas: document.querySelector("#frameCanvas"),
  windowCanvas: document.querySelector("#windowCanvas"),
  spectrumCanvas: document.querySelector("#spectrumCanvas"),
  teachingCanvas: document.querySelector("#teachingCanvas"),
  spectrogramCanvas: document.querySelector("#spectrogramCanvas"),
  peaksCanvas: document.querySelector("#peaksCanvas"),
  landmarksCanvas: document.querySelector("#landmarksCanvas"),
  matchCanvas: document.querySelector("#matchCanvas"),
};

const state = {
  captureSession: null,
  autoStopTimer: null,
  recordingStartedAt: 0,
  timerInterval: null,
  previewBuffer: new Float32Array(4096),
  analysis: null,
  selectedFrame: 0,
  selectedTeachingBin: ANALYSIS_CONFIG.defaultTeachingBin,
  recognitionResult: null,
  recognitionStatus: "Backend not contacted yet.",
  isBusy: false,
};

function setStatus(message) {
  elements.status.textContent = message;
}

function setBusy(isBusy) {
  state.isBusy = isBusy;
  elements.startButton.disabled = isBusy || Boolean(state.captureSession);
  elements.demoButton.disabled = isBusy || Boolean(state.captureSession);
  elements.stopButton.disabled = !state.captureSession;
}

function pushPreviewChunk(chunk) {
  if (chunk.length >= state.previewBuffer.length) {
    state.previewBuffer = chunk.slice(chunk.length - state.previewBuffer.length);
    return;
  }

  const nextBuffer = new Float32Array(state.previewBuffer.length);
  nextBuffer.set(state.previewBuffer.subarray(chunk.length), 0);
  nextBuffer.set(chunk, state.previewBuffer.length - chunk.length);
  state.previewBuffer = nextBuffer;
}

function clearTimers() {
  if (state.autoStopTimer) {
    clearTimeout(state.autoStopTimer);
    state.autoStopTimer = null;
  }

  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

function updateRecordingTimer() {
  const elapsedSec = (performance.now() - state.recordingStartedAt) / 1000;
  elements.timer.textContent = `${elapsedSec.toFixed(1)}s / ${ANALYSIS_CONFIG.recordSeconds.toFixed(0)}s`;
}

function updateSummary() {
  if (!state.analysis) {
    elements.sampleRateValue.textContent = "11025 Hz";
    elements.durationValue.textContent = "0.0 s";
    elements.frameCountValue.textContent = "0";
    elements.peakCountValue.textContent = "0";
    elements.landmarkCountValue.textContent = "0";
    elements.runtimeValue.textContent = "0 ms";
    elements.sourceValue.textContent = "Awaiting capture";
    return;
  }

  elements.sampleRateValue.textContent = `${state.analysis.sampleRate} Hz`;
  elements.durationValue.textContent = `${state.analysis.durationSec.toFixed(2)} s`;
  elements.frameCountValue.textContent = String(state.analysis.stft.frames.length);
  elements.peakCountValue.textContent = String(state.analysis.peaks.length);
  elements.landmarkCountValue.textContent = String(state.analysis.landmarks.length);
  elements.runtimeValue.textContent = `${Math.round(state.analysis.runtimeMs)} ms`;
  elements.sourceValue.textContent = state.analysis.sourceLabel;
}

function updateExplanations() {
  if (!state.analysis) {
    elements.frameInfo.textContent = "Frames will be shown once a clip is analyzed.";
    elements.teachingInfo.textContent = "The teaching FFT panel projects a tiny frame onto cosine and sine basis vectors.";
    elements.peakInfo.textContent = "Peak picking keeps only local maxima in the spectrogram.";
    elements.matchInfo.textContent = state.recognitionStatus;
    return;
  }

  const { stft, sampleRate, inputSampleRate, peaks, landmarks } = state.analysis;
  const frameStartSample = state.selectedFrame * ANALYSIS_CONFIG.hopSize;
  const frameStartSec = frameStartSample / sampleRate;
  const frameEndSec = (frameStartSample + ANALYSIS_CONFIG.frameSize) / sampleRate;
  const selectedPeaks = peaks.filter((peak) => peak.frameIndex === state.selectedFrame);
  const visibleLandmarks = landmarks.filter((landmark) => landmark.anchorFrame === state.selectedFrame);

  elements.frameInfo.textContent =
    `Frame ${state.selectedFrame + 1} starts at ${frameStartSec.toFixed(2)}s and ends at ${frameEndSec.toFixed(2)}s. ` +
    `Raw mic rate was ${inputSampleRate} Hz, then the clip was resampled to ${sampleRate} Hz before the STFT.`;

  elements.teachingInfo.textContent =
    `For bin k = ${state.selectedTeachingBin}, the teaching panel computes the DFT dot product ` +
    `x[n] · e^{-i2πkn/N} on a 32-sample miniature of the selected frame.`;

  elements.peakInfo.textContent =
    `${selectedPeaks.length} peaks fall in this frame. ${visibleLandmarks.length} landmark hashes originate here, ` +
    `and ${landmarks.length} total hashes were built from ${peaks.length} sparse peaks.`;

  elements.matchInfo.textContent = state.recognitionStatus;
}

function formatRecognitionStatus(payload) {
  if (!payload) {
    return "Backend not contacted yet.";
  }

  if (payload.status === "ok" && payload.topMatch) {
    const confidence = payload.ratioToSecond == null
      ? `${payload.bestVotes} votes, no close second candidate`
      : `${payload.bestVotes} votes, ratio ${payload.ratioToSecond}`;
    return `Matched ${payload.topMatch.title} by ${payload.topMatch.artist} at ${payload.topMatch.offsetSec}s (${confidence}).`;
  }

  if (payload.status === "no_catalog") {
    return payload.message;
  }

  if (payload.status === "no_confident_match") {
    return payload.message || "No confident song match was found in the current catalog.";
  }

  if (payload.status === "bad_request") {
    return payload.message;
  }

  return payload.message || JSON.stringify(payload);
}

function currentFrameBounds() {
  if (!state.analysis) {
    return { start: 0, end: 0 };
  }

  const start = state.selectedFrame * ANALYSIS_CONFIG.hopSize;
  return {
    start,
    end: start + ANALYSIS_CONFIG.frameSize,
  };
}

function renderPanels() {
  if (!state.analysis) {
    renderWaveform(elements.waveformCanvas, state.previewBuffer);
    renderFrameComparison(elements.frameCanvas);
    renderFrameComparison(elements.windowCanvas);
    renderSpectrum(elements.spectrumCanvas);
    renderTeachingProjection(elements.teachingCanvas);
    renderSpectrogram(elements.spectrogramCanvas);
    renderPeaks(elements.peaksCanvas);
    renderLandmarks(elements.landmarksCanvas);
    renderMatchResult(elements.matchCanvas, state.recognitionResult, state.recognitionStatus);
    updateSummary();
    updateExplanations();
    return;
  }

  const { samples, stft, peaks, landmarks } = state.analysis;
  const frame = stft.frames[state.selectedFrame];
  const windowedFrame = stft.windowedFrames[state.selectedFrame];
  const spectrum = stft.fullMagnitudes[state.selectedFrame];
  const teachingProjection = frame
    ? createTeachingProjection(frame, state.selectedTeachingBin)
    : null;
  const { start, end } = currentFrameBounds();

  renderWaveform(elements.waveformCanvas, samples, start, end);
  renderFrameComparison(elements.frameCanvas, frame, frame);
  renderFrameComparison(elements.windowCanvas, frame, windowedFrame);
  renderSpectrum(
    elements.spectrumCanvas,
    spectrum,
    stft.minBin,
    stft.maxBin,
    stft.frequencyStepHz,
  );
  renderTeachingProjection(elements.teachingCanvas, teachingProjection, state.selectedTeachingBin);
  renderSpectrogram(elements.spectrogramCanvas, stft.dbSpectrogram, state.selectedFrame);
  renderPeaks(elements.peaksCanvas, stft.dbSpectrogram, peaks, state.selectedFrame);
  renderLandmarks(
    elements.landmarksCanvas,
    stft.dbSpectrogram,
    peaks,
    landmarks,
    state.selectedFrame,
    stft.minBin,
  );
  renderMatchResult(elements.matchCanvas, state.recognitionResult, state.recognitionStatus);

  updateSummary();
  updateExplanations();
}

async function requestRecognition(samples) {
  try {
    const response = await fetch("/api/recognize", {
      method: "POST",
      headers: {
        "content-type": "application/octet-stream",
        "x-sample-rate": String(ANALYSIS_CONFIG.sampleRate),
      },
      body: samples,
    });

    const payload = await response.json();
    state.recognitionResult = payload;
    state.recognitionStatus = formatRecognitionStatus(payload);
  } catch (error) {
    state.recognitionResult = null;
    state.recognitionStatus = `Recognition request failed: ${error.message}`;
  }

  renderPanels();
}

async function analyzeClip(samples, inputSampleRate, sourceLabel) {
  setBusy(true);
  setStatus("Analyzing waveform, STFT, peaks, and landmarks...");

  try {
    const analysisStartedAt = performance.now();
    const clipped = samples.slice(0, Math.floor(ANALYSIS_CONFIG.recordSeconds * inputSampleRate));
    const normalized = normalizeSamples(clipped);
    const resampled = resampleLinear(normalized, inputSampleRate, ANALYSIS_CONFIG.sampleRate);

    if (resampled.length < ANALYSIS_CONFIG.frameSize) {
      throw new Error("The captured clip is too short for a 2048-sample FFT window.");
    }

    const { stft, peaks, landmarks } = analyzeSamples(resampled, ANALYSIS_CONFIG);

    state.analysis = {
      sourceLabel,
      inputSampleRate,
      sampleRate: ANALYSIS_CONFIG.sampleRate,
      samples: resampled,
      durationSec: resampled.length / ANALYSIS_CONFIG.sampleRate,
      stft,
      peaks,
      landmarks,
      runtimeMs: performance.now() - analysisStartedAt,
    };
    state.recognitionResult = null;
    state.selectedFrame = Math.min(state.selectedFrame, Math.max(0, stft.frames.length - 1));
    state.recognitionStatus = "Frontend analysis finished. Requesting backend matcher...";

    elements.frameSlider.disabled = false;
    elements.frameSlider.max = String(Math.max(0, stft.frames.length - 1));
    elements.frameSlider.value = String(state.selectedFrame);
    elements.frameLabel.textContent = `${state.selectedFrame + 1}`;
    renderPanels();
    setStatus("Analysis complete. Scrub through the steps below.");
    requestRecognition(resampled);
  } catch (error) {
    state.analysis = null;
    state.recognitionResult = null;
    state.recognitionStatus = `Analysis failed: ${error.message}`;
    elements.frameSlider.disabled = true;
    elements.frameLabel.textContent = "0";
    setStatus(`Analysis error: ${error.message}`);
    renderPanels();
  } finally {
    setBusy(false);
  }
}

async function stopRecording() {
  if (!state.captureSession) {
    return;
  }

  clearTimers();
  setStatus("Stopping microphone capture...");
  const captureSession = state.captureSession;
  state.captureSession = null;
  setBusy(false);

  try {
    const { samples, sampleRate } = await captureSession.stop();
    elements.timer.textContent = "Idle";
    await analyzeClip(samples, sampleRate, "Microphone capture");
  } catch (error) {
    elements.timer.textContent = "Idle";
    state.recognitionStatus = `Capture failed: ${error.message}`;
    setStatus(`Capture error: ${error.message}`);
    renderPanels();
  }
}

async function startRecording() {
  if (state.captureSession || state.isBusy) {
    return;
  }

  setBusy(true);
  state.previewBuffer = new Float32Array(4096);
  state.analysis = null;
  state.recognitionResult = null;
  state.recognitionStatus = "Capture in progress...";
  elements.frameSlider.disabled = true;
  elements.frameLabel.textContent = "0";
  setStatus("Requesting microphone access...");
  renderPanels();

  try {
    state.captureSession = await startCapture({
      onChunk(chunk) {
        pushPreviewChunk(chunk);
        renderWaveform(elements.waveformCanvas, state.previewBuffer);
      },
    });

    state.recordingStartedAt = performance.now();
    updateRecordingTimer();
    state.timerInterval = setInterval(updateRecordingTimer, 100);
    state.autoStopTimer = setTimeout(stopRecording, ANALYSIS_CONFIG.recordSeconds * 1000);
    setBusy(false);
    setStatus("Recording. Speak toward the mic or play a song nearby.");
  } catch (error) {
    state.captureSession = null;
    elements.timer.textContent = "Idle";
    setBusy(false);
    setStatus(`Microphone error: ${error.message}`);
    state.recognitionStatus = "Microphone permission was not granted.";
    renderPanels();
  }
}

async function loadDemo() {
  if (state.captureSession || state.isBusy) {
    return;
  }

  const signal = createDemoSignal(ANALYSIS_CONFIG.recordSeconds, ANALYSIS_CONFIG.sampleRate);
  setStatus("Loading synthetic demo signal...");
  try {
    await analyzeClip(signal, ANALYSIS_CONFIG.sampleRate, "Synthetic demo signal");
  } catch (error) {
    state.recognitionStatus = `Demo analysis failed: ${error.message}`;
    setStatus(`Demo error: ${error.message}`);
    renderPanels();
  }
}

elements.startButton.addEventListener("click", startRecording);
elements.stopButton.addEventListener("click", stopRecording);
elements.demoButton.addEventListener("click", loadDemo);
elements.frameSlider.addEventListener("input", (event) => {
  state.selectedFrame = Number(event.target.value);
  elements.frameLabel.textContent = String(state.selectedFrame + 1);
  renderPanels();
});
elements.teachingBinSlider.addEventListener("input", (event) => {
  state.selectedTeachingBin = Number(event.target.value);
  elements.teachingBinLabel.textContent = String(state.selectedTeachingBin);
  renderPanels();
});

window.addEventListener("resize", () => renderPanels());

elements.timer.textContent = "Idle";
elements.teachingBinLabel.textContent = String(state.selectedTeachingBin);
renderPanels();
