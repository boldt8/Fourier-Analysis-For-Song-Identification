import { EPSILON } from "../config.js";

export function removeDcOffset(samples) {
  let sum = 0;
  for (let index = 0; index < samples.length; index += 1) {
    sum += samples[index];
  }

  const mean = samples.length > 0 ? sum / samples.length : 0;
  const centered = new Float32Array(samples.length);

  for (let index = 0; index < samples.length; index += 1) {
    centered[index] = samples[index] - mean;
  }

  return centered;
}

export function normalizeAmplitude(samples, peakTarget = 0.95) {
  let peak = 0;
  for (let index = 0; index < samples.length; index += 1) {
    peak = Math.max(peak, Math.abs(samples[index]));
  }

  const safePeak = Math.max(peak, EPSILON);
  const gain = peakTarget / safePeak;
  const normalized = new Float32Array(samples.length);

  for (let index = 0; index < samples.length; index += 1) {
    normalized[index] = samples[index] * gain;
  }

  return normalized;
}

export function normalizeSamples(samples) {
  return normalizeAmplitude(removeDcOffset(samples));
}

export function resampleLinear(samples, inputRate, outputRate) {
  if (inputRate === outputRate) {
    return new Float32Array(samples);
  }

  const ratio = outputRate / inputRate;
  const outputLength = Math.max(1, Math.round(samples.length * ratio));
  const resampled = new Float32Array(outputLength);

  for (let index = 0; index < outputLength; index += 1) {
    const position = index / ratio;
    const leftIndex = Math.floor(position);
    const rightIndex = Math.min(leftIndex + 1, samples.length - 1);
    const fraction = position - leftIndex;
    const leftValue = samples[leftIndex] ?? 0;
    const rightValue = samples[rightIndex] ?? leftValue;
    resampled[index] = leftValue + ((rightValue - leftValue) * fraction);
  }

  return resampled;
}

export function createDemoSignal(durationSec, sampleRate) {
  const totalSamples = Math.floor(durationSec * sampleRate);
  const signal = new Float32Array(totalSamples);
  const beatLength = Math.floor(sampleRate * 0.5);

  for (let index = 0; index < totalSamples; index += 1) {
    const time = index / sampleRate;
    const beatPhase = (index % beatLength) / beatLength;
    const envelope = Math.exp(-4 * beatPhase);

    const harmonic =
      (0.44 * Math.sin((2 * Math.PI * 220 * time))) +
      (0.24 * Math.sin((2 * Math.PI * 330 * time))) +
      (0.18 * Math.sin((2 * Math.PI * 440 * time))) +
      (0.1 * Math.sin((2 * Math.PI * (740 + (80 * Math.sin(2 * Math.PI * 0.25 * time))) * time)));

    const click = beatPhase < 0.08 ? Math.sin((2 * Math.PI * 1200 * time)) * (1 - (beatPhase / 0.08)) : 0;
    signal[index] = (harmonic * (0.55 + (0.45 * envelope))) + (0.25 * click);
  }

  return normalizeSamples(signal);
}
