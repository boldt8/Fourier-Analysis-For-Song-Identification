export const ANALYSIS_CONFIG = Object.freeze({
  recordSeconds: 8,
  sampleRate: 11025,
  frameSize: 2048,
  hopSize: 512,
  minFreqHz: 250,
  maxFreqHz: 5000,
  peakNeighborhoodTime: 7,
  peakNeighborhoodFreq: 7,
  peakFloorDb: -60,
  peaksPerSecond: 30,
  minDeltaSec: 0.2,
  maxDeltaSec: 1.5,
  pairsPerAnchor: 5,
  matchMinVotes: 12,
  matchRatioThreshold: 1.35,
  maxCandidates: 5,
  maxHistogramBars: 24,
  teachingFrameSize: 32,
  defaultTeachingBin: 3,
});

export const EPSILON = 1e-8;
