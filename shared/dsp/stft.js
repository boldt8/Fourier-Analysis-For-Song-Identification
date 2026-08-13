import { ANALYSIS_CONFIG, EPSILON } from "../config.js";
import { realFftMagnitude } from "./fft.js";

export function createHannWindow(length) {
  const window = new Float32Array(length);
  const denominator = Math.max(1, length - 1);

  for (let index = 0; index < length; index += 1) {
    window[index] = 0.5 - (0.5 * Math.cos((2 * Math.PI * index) / denominator));
  }

  return window;
}

export function frameSignal(samples, frameSize, hopSize) {
  if (samples.length < frameSize) {
    return [];
  }

  const frames = [];
  for (let start = 0; start + frameSize <= samples.length; start += hopSize) {
    frames.push(samples.slice(start, start + frameSize));
  }

  return frames;
}

export function applyWindow(frame, window) {
  const windowedFrame = new Float32Array(frame.length);
  for (let index = 0; index < frame.length; index += 1) {
    windowedFrame[index] = frame[index] * window[index];
  }
  return windowedFrame;
}

export function binToFrequency(binIndex, sampleRate, frameSize) {
  return (binIndex * sampleRate) / frameSize;
}

function magnitudeToDb(value) {
  return 20 * Math.log10(value + EPSILON);
}

export function computeStft(samples, config = ANALYSIS_CONFIG) {
  const { frameSize, hopSize, sampleRate, minFreqHz, maxFreqHz } = config;
  const window = createHannWindow(frameSize);
  const frames = frameSignal(samples, frameSize, hopSize);
  const windowedFrames = [];
  const fullMagnitudes = [];
  const dbSpectrogram = [];

  const minBin = Math.max(0, Math.floor((minFreqHz * frameSize) / sampleRate));
  const maxBin = Math.min(frameSize >> 1, Math.ceil((maxFreqHz * frameSize) / sampleRate));

  for (const frame of frames) {
    const windowed = applyWindow(frame, window);
    const magnitude = realFftMagnitude(windowed);
    const dbBand = new Float32Array(maxBin - minBin + 1);

    for (let bandIndex = 0; bandIndex < dbBand.length; bandIndex += 1) {
      dbBand[bandIndex] = magnitudeToDb(magnitude[minBin + bandIndex]);
    }

    windowedFrames.push(windowed);
    fullMagnitudes.push(magnitude);
    dbSpectrogram.push(dbBand);
  }

  return {
    frames,
    windowedFrames,
    fullMagnitudes,
    dbSpectrogram,
    window,
    minBin,
    maxBin,
    frequencyStepHz: sampleRate / frameSize,
    frameDurationSec: hopSize / sampleRate,
  };
}
