import { ANALYSIS_CONFIG } from "../config.js";

export function packLandmarkHash(anchorBin, targetBin, deltaFrames) {
  return (((anchorBin & 0x3ff) << 16) | ((targetBin & 0x3ff) << 6) | (deltaFrames & 0x3f)) >>> 0;
}

export function buildLandmarks(peaks, config = ANALYSIS_CONFIG) {
  if (peaks.length === 0) {
    return [];
  }

  const minDeltaFrames = Math.max(1, Math.round((config.minDeltaSec * config.sampleRate) / config.hopSize));
  const maxDeltaFrames = Math.max(minDeltaFrames + 1, Math.round((config.maxDeltaSec * config.sampleRate) / config.hopSize));
  const landmarks = [];

  for (let anchorIndex = 0; anchorIndex < peaks.length; anchorIndex += 1) {
    const anchorPeak = peaks[anchorIndex];
    let pairCount = 0;

    for (let targetIndex = anchorIndex + 1; targetIndex < peaks.length; targetIndex += 1) {
      const targetPeak = peaks[targetIndex];
      const deltaFrames = targetPeak.frameIndex - anchorPeak.frameIndex;

      if (deltaFrames < minDeltaFrames) {
        continue;
      }

      if (deltaFrames > maxDeltaFrames) {
        break;
      }

      landmarks.push({
        anchorFrame: anchorPeak.frameIndex,
        anchorBin: anchorPeak.binIndex,
        targetFrame: targetPeak.frameIndex,
        targetBin: targetPeak.binIndex,
        deltaFrames,
        hash: packLandmarkHash(anchorPeak.binIndex, targetPeak.binIndex, deltaFrames),
      });

      pairCount += 1;
      if (pairCount >= config.pairsPerAnchor) {
        break;
      }
    }
  }

  return landmarks;
}
