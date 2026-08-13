import { ANALYSIS_CONFIG } from "../config.js";
import { binToFrequency } from "./stft.js";

export function extractPeaks(dbSpectrogram, config = ANALYSIS_CONFIG) {
  if (dbSpectrogram.length === 0) {
    return [];
  }

  const rows = dbSpectrogram.length;
  const columns = dbSpectrogram[0].length;
  const candidatePeaks = [];

  for (let frameIndex = config.peakNeighborhoodTime; frameIndex < rows - config.peakNeighborhoodTime; frameIndex += 1) {
    const row = dbSpectrogram[frameIndex];

    for (
      let bandBinIndex = config.peakNeighborhoodFreq;
      bandBinIndex < columns - config.peakNeighborhoodFreq;
      bandBinIndex += 1
    ) {
      const magnitudeDb = row[bandBinIndex];
      if (magnitudeDb < config.peakFloorDb) {
        continue;
      }

      let isLocalMaximum = true;

      for (let timeOffset = -config.peakNeighborhoodTime; timeOffset <= config.peakNeighborhoodTime && isLocalMaximum; timeOffset += 1) {
        const comparisonRow = dbSpectrogram[frameIndex + timeOffset];
        for (
          let freqOffset = -config.peakNeighborhoodFreq;
          freqOffset <= config.peakNeighborhoodFreq;
          freqOffset += 1
        ) {
          if (timeOffset === 0 && freqOffset === 0) {
            continue;
          }

          if (comparisonRow[bandBinIndex + freqOffset] > magnitudeDb) {
            isLocalMaximum = false;
            break;
          }
        }
      }

      if (!isLocalMaximum) {
        continue;
      }

      const absoluteBinIndex = config.minBin + bandBinIndex;
      candidatePeaks.push({
        frameIndex,
        bandBinIndex,
        binIndex: absoluteBinIndex,
        timeSec: frameIndex * config.hopSize / config.sampleRate,
        freqHz: binToFrequency(absoluteBinIndex, config.sampleRate, config.frameSize),
        magnitudeDb,
      });
    }
  }

  const durationSec = rows * config.hopSize / config.sampleRate;
  const maxPeaks = Math.max(24, Math.ceil(durationSec * config.peaksPerSecond));

  return candidatePeaks
    .sort((left, right) => right.magnitudeDb - left.magnitudeDb)
    .slice(0, maxPeaks)
    .sort((left, right) => left.frameIndex - right.frameIndex || left.bandBinIndex - right.bandBinIndex);
}
