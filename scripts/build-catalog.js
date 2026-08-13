import { rm } from "node:fs/promises";
import { ANALYSIS_CONFIG } from "../shared/config.js";
import { analyzeSamples } from "../shared/dsp/analyze.js";
import { decodeAudioFileToSamples } from "../server/audio.js";
import { resolveCatalogEntries } from "../server/catalog.js";
import { openCatalogDatabase } from "../server/db.js";
import { CATALOG_DATABASE_PATH } from "../server/paths.js";

async function rebuildCatalog() {
  const catalogEntries = await resolveCatalogEntries();

  await rm(CATALOG_DATABASE_PATH, { force: true });
  const db = await openCatalogDatabase();

  const insertMetadata = db.query("INSERT INTO metadata(key, value) VALUES(?, ?)");
  const insertTrack = db.query(`
    INSERT INTO tracks(
      slug,
      title,
      artist,
      album,
      source_path,
      duration_sec,
      sample_rate,
      peak_count,
      fingerprint_count,
      created_at
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertFingerprint = db.query(`
    INSERT INTO fingerprints(hash, track_id, anchor_frame)
    VALUES(?, ?, ?)
  `);
  const lastRowId = db.query("SELECT last_insert_rowid() AS id");

  let indexedTrackCount = 0;
  let indexedFingerprintCount = 0;

  try {
    db.exec("BEGIN");

    insertMetadata.run("built_at", new Date().toISOString());
    insertMetadata.run("sample_rate", String(ANALYSIS_CONFIG.sampleRate));
    insertMetadata.run("analysis_config", JSON.stringify(ANALYSIS_CONFIG));

    for (const [index, entry] of catalogEntries.entries()) {
      const samples = decodeAudioFileToSamples(entry.sourcePath, ANALYSIS_CONFIG.sampleRate);
      if (samples.length < ANALYSIS_CONFIG.frameSize) {
        console.warn(`Skipping ${entry.relativePath}: clip is shorter than one FFT frame.`);
        continue;
      }

      const analysis = analyzeSamples(samples, ANALYSIS_CONFIG);
      const fingerprintCount = analysis.landmarks.length;

      insertTrack.run(
        entry.slug,
        entry.title,
        entry.artist,
        entry.album,
        entry.relativePath,
        samples.length / ANALYSIS_CONFIG.sampleRate,
        ANALYSIS_CONFIG.sampleRate,
        analysis.peaks.length,
        fingerprintCount,
        new Date().toISOString(),
      );
      const trackId = Number(lastRowId.get()?.id ?? 0);

      for (const landmark of analysis.landmarks) {
        insertFingerprint.run(landmark.hash, trackId, landmark.anchorFrame);
      }

      indexedTrackCount += 1;
      indexedFingerprintCount += fingerprintCount;

      console.log(
        `[${index + 1}/${catalogEntries.length}] Indexed ${entry.artist} - ${entry.title} ` +
        `(${analysis.peaks.length} peaks, ${fingerprintCount} hashes)`,
      );
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    db.close();
    throw error;
  }

  db.close();

  console.log("");
  console.log(`Catalog database rebuilt at ${CATALOG_DATABASE_PATH}`);
  console.log(`Indexed tracks: ${indexedTrackCount}`);
  console.log(`Indexed fingerprints: ${indexedFingerprintCount}`);
  if (indexedTrackCount === 0) {
    console.log("No audio files were indexed. Add songs to data/catalog and rerun bun run catalog:build.");
  }
}

rebuildCatalog().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
