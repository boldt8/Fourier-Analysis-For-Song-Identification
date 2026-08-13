import { describe, expect, test } from "bun:test";
import { realFftMagnitude } from "../shared/dsp/fft.js";
import { computeStft } from "../shared/dsp/stft.js";
import { buildLandmarks, packLandmarkHash } from "../shared/dsp/landmarks.js";
import { ANALYSIS_CONFIG } from "../shared/config.js";

describe("fft", () => {
  test("dominant bin tracks a sine wave frequency", () => {
    const sampleRate = 1024;
    const frameSize = 1024;
    const targetBin = 64;
    const signal = new Float32Array(frameSize);

    for (let index = 0; index < frameSize; index += 1) {
      signal[index] = Math.sin((2 * Math.PI * targetBin * index) / frameSize);
    }

    const magnitude = realFftMagnitude(signal);
    let dominantBin = 0;
    let dominantValue = -Infinity;

    for (let index = 0; index < magnitude.length; index += 1) {
      if (magnitude[index] > dominantValue) {
        dominantValue = magnitude[index];
        dominantBin = index;
      }
    }

    expect(dominantBin).toBe(targetBin);
    expect(sampleRate / frameSize).toBe(1);
  });
});

describe("stft", () => {
  test("creates overlapping frames for a long enough clip", () => {
    const signal = new Float32Array(ANALYSIS_CONFIG.frameSize + (ANALYSIS_CONFIG.hopSize * 3));
    const result = computeStft(signal, ANALYSIS_CONFIG);
    expect(result.frames.length).toBe(4);
  });
});

describe("landmarks", () => {
  test("packs landmark hashes into 32 bits", () => {
    const hash = packLandmarkHash(512, 700, 23);
    expect(hash >>> 0).toBe(hash);
  });

  test("creates limited forward pairs per anchor", () => {
    const peaks = [
      { frameIndex: 0, binIndex: 300 },
      { frameIndex: 5, binIndex: 320 },
      { frameIndex: 8, binIndex: 350 },
      { frameIndex: 12, binIndex: 360 },
      { frameIndex: 18, binIndex: 390 },
    ];

    const landmarks = buildLandmarks(peaks, {
      ...ANALYSIS_CONFIG,
      minDeltaSec: 0.1,
      maxDeltaSec: 1.2,
      pairsPerAnchor: 2,
    });

    expect(landmarks.length).toBeGreaterThan(0);
    expect(landmarks.every((landmark) => landmark.deltaFrames > 0)).toBe(true);
  });
});
