import { stat } from "node:fs/promises";
import { openCatalogDatabase } from "./db.js";
import { CATALOG_DATABASE_PATH } from "./paths.js";

let cachedRepository = null;

async function statOrNull(path) {
  try {
    return await stat(path);
  } catch {
    return null;
  }
}

function parseAnalysisConfig(metadataValue) {
  if (!metadataValue) {
    return null;
  }

  try {
    return JSON.parse(metadataValue);
  } catch {
    return null;
  }
}

function createRepository(db) {
  const metadataEntries = db.query("SELECT key, value FROM metadata").all();
  const metadata = Object.fromEntries(metadataEntries.map((entry) => [entry.key, entry.value]));
  const trackRows = db.query(`
    SELECT
      id,
      slug,
      title,
      artist,
      album,
      source_path AS sourcePath,
      duration_sec AS durationSec,
      sample_rate AS sampleRate,
      peak_count AS peakCount,
      fingerprint_count AS fingerprintCount,
      created_at AS createdAt
    FROM tracks
    ORDER BY artist, title
  `).all();
  const trackMap = new Map(trackRows.map((track) => [track.id, track]));
  const fingerprintQuery = db.query(`
    SELECT
      track_id AS trackId,
      anchor_frame AS anchorFrame
    FROM fingerprints
    WHERE hash = ?
  `);
  const fingerprintStats = db.query(`
    SELECT
      COUNT(*) AS trackCount,
      COALESCE(SUM(fingerprint_count), 0) AS fingerprintCount
    FROM tracks
  `).get() ?? { trackCount: 0, fingerprintCount: 0 };

  return {
    close() {
      db.close();
    },
    getCatalogSummary() {
      return {
        builtAt: metadata.built_at ?? null,
        trackCount: Number(fingerprintStats.trackCount ?? 0),
        fingerprintCount: Number(fingerprintStats.fingerprintCount ?? 0),
        sampleRate: Number(metadata.sample_rate ?? 0),
        analysisConfig: parseAnalysisConfig(metadata.analysis_config),
      };
    },
    listTracks() {
      return trackRows;
    },
    getTrackById(trackId) {
      return trackMap.get(trackId) ?? null;
    },
    findFingerprintsByHash(hash) {
      return fingerprintQuery.all(hash);
    },
  };
}

export async function getCatalogRepository() {
  const dbStats = await statOrNull(CATALOG_DATABASE_PATH);
  if (!dbStats) {
    if (cachedRepository?.repository) {
      cachedRepository.repository.close();
    }
    cachedRepository = null;
    return null;
  }

  if (cachedRepository && cachedRepository.modifiedAtMs === dbStats.mtimeMs) {
    return cachedRepository.repository;
  }

  cachedRepository?.repository?.close();

  const db = await openCatalogDatabase({ createIfMissing: false });
  if (!db) {
    cachedRepository = null;
    return null;
  }

  const repository = createRepository(db);
  cachedRepository = {
    modifiedAtMs: dbStats.mtimeMs,
    repository,
  };
  return repository;
}
