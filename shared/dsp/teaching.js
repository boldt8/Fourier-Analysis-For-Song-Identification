import { ANALYSIS_CONFIG } from "../config.js";

function averageDownsample(frame, targetLength) {
  const reduced = new Float32Array(targetLength);
  const bucketSize = frame.length / targetLength;

  for (let bucket = 0; bucket < targetLength; bucket += 1) {
    const start = Math.floor(bucket * bucketSize);
    const end = Math.max(start + 1, Math.floor((bucket + 1) * bucketSize));
    let sum = 0;

    for (let index = start; index < end; index += 1) {
      sum += frame[index];
    }

    reduced[bucket] = sum / Math.max(1, end - start);
  }

  return reduced;
}

export function createTeachingProjection(
  frame,
  selectedBin,
  targetLength = ANALYSIS_CONFIG.teachingFrameSize,
) {
  const signal = averageDownsample(frame, targetLength);
  const basisReal = new Float32Array(targetLength);
  const basisImaginary = new Float32Array(targetLength);
  const realProducts = new Float32Array(targetLength);
  const imaginaryProducts = new Float32Array(targetLength);

  let realSum = 0;
  let imaginarySum = 0;

  for (let index = 0; index < targetLength; index += 1) {
    const angle = (2 * Math.PI * selectedBin * index) / targetLength;
    basisReal[index] = Math.cos(angle);
    basisImaginary[index] = -Math.sin(angle);
    realProducts[index] = signal[index] * basisReal[index];
    imaginaryProducts[index] = signal[index] * basisImaginary[index];
    realSum += realProducts[index];
    imaginarySum += imaginaryProducts[index];
  }

  return {
    signal,
    basisReal,
    basisImaginary,
    realProducts,
    imaginaryProducts,
    realSum,
    imaginarySum,
    magnitude: Math.hypot(realSum, imaginarySum),
  };
}
