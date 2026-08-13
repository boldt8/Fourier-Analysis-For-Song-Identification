import { ANALYSIS_CONFIG } from "../shared/config.js";
import { analyzeSamples } from "../shared/dsp/analyze.js";
import { normalizeSamples, resampleLinear } from "../shared/dsp/preprocess.js";

function clampSamples(samples) {
  return new Float32Array(samples);
}

function buildHistogramForTrack(offsetVotes, sampleRate, hopSize, maxBars) {
  return [...offsetVotes.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, maxBars)
    .map(([offsetFrames, votes]) => ({
      offsetFrames,
      offsetSec: Number(((offsetFrames * hopSize) / sampleRate).toFixed(3)),
      votes,
    }));
}

export function analyzeQuerySamples(rawSamples, inputSampleRate, config = ANALYSIS_CONFIG) {
  const normalized = normalizeSamples(clampSamples(rawSamples));
  const resampled = resampleLinear(normalized, inputSampleRate, config.sampleRate);
  const analysis = analyzeSamples(resampled, config);

  return {
    samples: resampled,
    ...analysis,
  };
}

export function matchQueryLandmarks(repository, queryLandmarks, config = ANALYSIS_CONFIG) {
  const groupedHashes = new Map();
  for (const landmark of queryLandmarks) {
    const anchorFrames = groupedHashes.get(landmark.hash) ?? [];
    anchorFrames.push(landmark.anchorFrame);
    groupedHashes.set(landmark.hash, anchorFrames);
  }

  const voteMap = new Map();
  const matchedHashes = new Set();
  const perTrackOffsetVotes = new Map();

  for (const [hash, queryAnchorFrames] of groupedHashes.entries()) {
    const fingerprintMatches = repository.findFingerprintsByHash(hash);
    if (fingerprintMatches.length === 0) {
      continue;
    }

    matchedHashes.add(hash);

    for (const match of fingerprintMatches) {
      let offsetVotes = perTrackOffsetVotes.get(match.trackId);
      if (!offsetVotes) {
        offsetVotes = new Map();
        perTrackOffsetVotes.set(match.trackId, offsetVotes);
      }

      for (const queryAnchorFrame of queryAnchorFrames) {
        const offsetFrames = match.anchorFrame - queryAnchorFrame;
        const voteKey = `${match.trackId}:${offsetFrames}`;
        voteMap.set(voteKey, (voteMap.get(voteKey) ?? 0) + 1);
        offsetVotes.set(offsetFrames, (offsetVotes.get(offsetFrames) ?? 0) + 1);
      }
    }
  }

  const candidateMap = new Map();
  for (const [voteKey, voteCount] of voteMap.entries()) {
    const [trackIdText, offsetFramesText] = voteKey.split(":");
    const trackId = Number(trackIdText);
    const offsetFrames = Number(offsetFramesText);
    const currentBest = candidateMap.get(trackId);

    if (!currentBest || voteCount > currentBest.voteCount) {
      candidateMap.set(trackId, {
        trackId,
        offsetFrames,
        voteCount,
      });
    }
  }

  const sortedCandidates = [...candidateMap.values()]
    .sort((left, right) => right.voteCount - left.voteCount)
    .slice(0, config.maxCandidates)
    .map((candidate) => {
      const track = repository.getTrackById(candidate.trackId);
      return {
        trackId: candidate.trackId,
        title: track?.title ?? "Unknown Track",
        artist: track?.artist ?? "Unknown Artist",
        album: track?.album ?? "",
        offsetFrames: candidate.offsetFrames,
        offsetSec: Number(((candidate.offsetFrames * config.hopSize) / config.sampleRate).toFixed(3)),
        voteCount: candidate.voteCount,
      };
    });

  const bestCandidate = sortedCandidates[0] ?? null;
  const secondBestVotes = sortedCandidates[1]?.voteCount ?? 0;
  const bestVotes = bestCandidate?.voteCount ?? 0;
  const ratioForThreshold = secondBestVotes > 0
    ? bestVotes / secondBestVotes
    : Number.POSITIVE_INFINITY;
  const confidentMatch = Boolean(
    bestCandidate &&
    bestVotes >= config.matchMinVotes &&
    ratioForThreshold >= config.matchRatioThreshold,
  );

  return {
    status: confidentMatch ? "ok" : "no_confident_match",
    topMatch: confidentMatch ? bestCandidate : null,
    candidates: sortedCandidates,
    bestVotes,
    secondBestVotes,
    ratioToSecond: Number.isFinite(ratioForThreshold)
      ? Number(ratioForThreshold.toFixed(3))
      : null,
    queryHashCount: queryLandmarks.length,
    matchedHashCount: matchedHashes.size,
    offsetHistogram: bestCandidate
      ? buildHistogramForTrack(
          perTrackOffsetVotes.get(bestCandidate.trackId) ?? new Map(),
          config.sampleRate,
          config.hopSize,
          config.maxHistogramBars,
        )
      : [],
  };
}
