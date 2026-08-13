import { spawnSync } from "node:child_process";
import { ANALYSIS_CONFIG } from "../shared/config.js";
import { normalizeSamples } from "../shared/dsp/preprocess.js";

export function decodeAudioFileToSamples(filePath, sampleRate = ANALYSIS_CONFIG.sampleRate) {
  const ffmpegResult = spawnSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-i",
      filePath,
      "-vn",
      "-ac",
      "1",
      "-ar",
      String(sampleRate),
      "-f",
      "f32le",
      "pipe:1",
    ],
    {
      maxBuffer: 1024 * 1024 * 128,
    },
  );

  if (ffmpegResult.error) {
    throw new Error(`ffmpeg failed for ${filePath}: ${ffmpegResult.error.message}`);
  }

  if (ffmpegResult.status !== 0) {
    const stderr = ffmpegResult.stderr?.toString().trim() || "Unknown ffmpeg error.";
    throw new Error(`ffmpeg could not decode ${filePath}: ${stderr}`);
  }

  if (!ffmpegResult.stdout?.byteLength) {
    throw new Error(`ffmpeg produced no audio samples for ${filePath}.`);
  }

  const pcmBuffer = ffmpegResult.stdout.buffer.slice(
    ffmpegResult.stdout.byteOffset,
    ffmpegResult.stdout.byteOffset + ffmpegResult.stdout.byteLength,
  );

  return normalizeSamples(new Float32Array(pcmBuffer));
}
