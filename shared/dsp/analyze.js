import { ANALYSIS_CONFIG } from "../config.js";
import { buildLandmarks } from "./landmarks.js";
import { extractPeaks } from "./peaks.js";
import { computeStft } from "./stft.js";

export function analyzeSamples(samples, config = ANALYSIS_CONFIG) {
  const stft = computeStft(samples, config);
  const peaks = extractPeaks(stft.dbSpectrogram, {
    ...config,
    minBin: stft.minBin,
  });
  const landmarks = buildLandmarks(peaks, config);

  return {
    stft,
    peaks,
    landmarks,
  };
}
