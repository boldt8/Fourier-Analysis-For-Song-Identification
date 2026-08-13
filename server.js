import { extname, join, normalize } from "node:path";
import { ANALYSIS_CONFIG } from "./shared/config.js";
import { getCatalogRepository } from "./server/catalog-repository.js";
import { analyzeQuerySamples, matchQueryLandmarks } from "./server/match.js";

const rootDirectory = process.cwd();

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function jsonResponse(payload, init = {}) {
  return new Response(JSON.stringify(payload, null, 2), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(init.headers ?? {}),
    },
  });
}

function resolveStaticPath(pathname) {
  const relativePath = pathname === "/" ? "client/index.html" : pathname.slice(1);
  const normalizedPath = normalize(relativePath);

  if (normalizedPath.startsWith("..")) {
    return null;
  }

  const absolutePath = join(rootDirectory, normalizedPath);
  if (!absolutePath.startsWith(rootDirectory)) {
    return null;
  }

  return absolutePath;
}

const server = Bun.serve({
  hostname: Bun.env.HOST ?? "0.0.0.0",
  port: Number(Bun.env.PORT ?? 8080),
  development: true,
  async fetch(request) {
    const url = new URL(request.url);
    const repository = await getCatalogRepository();
    const catalogSummary = repository?.getCatalogSummary() ?? {
      builtAt: null,
      trackCount: 0,
      fingerprintCount: 0,
      sampleRate: ANALYSIS_CONFIG.sampleRate,
      analysisConfig: ANALYSIS_CONFIG,
    };
    const catalogIsUsable = Boolean(
      repository &&
      catalogSummary.trackCount > 0 &&
      catalogSummary.fingerprintCount > 0,
    );

    if (url.pathname === "/health") {
      return jsonResponse({
        status: "ok",
        timestamp: new Date().toISOString(),
        catalogStatus: catalogIsUsable
          ? "ready"
          : repository
            ? "empty"
            : "missing",
        catalog: catalogSummary,
      });
    }

    if (url.pathname === "/api/tracks") {
      return jsonResponse({
        status: catalogIsUsable ? "ok" : "no_catalog",
        message: catalogIsUsable
          ? "Catalog metadata loaded successfully."
          : "No usable fingerprint catalog found. Add songs to data/catalog and run `bun run catalog:build`.",
        catalog: catalogSummary,
        tracks: repository?.listTracks() ?? [],
      });
    }

    if (url.pathname === "/api/recognize") {
      if (request.method !== "POST") {
        return jsonResponse(
          { status: "method_not_allowed", message: "Use POST with Float32 PCM samples." },
          { status: 405 },
        );
      }

      if (!catalogIsUsable) {
        return jsonResponse({
          status: "no_catalog",
          message: "No usable fingerprint catalog found. Add songs to data/catalog and run `bun run catalog:build` first.",
          catalog: catalogSummary,
        }, { status: 503 });
      }

      const queryBytes = await request.arrayBuffer();
      if (queryBytes.byteLength === 0 || queryBytes.byteLength % 4 !== 0) {
        return jsonResponse({
          status: "bad_request",
          message: "Request body must contain Float32 PCM samples.",
        }, { status: 400 });
      }

      const sampleRate = Number(request.headers.get("x-sample-rate") ?? ANALYSIS_CONFIG.sampleRate);
      if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
        return jsonResponse({
          status: "bad_request",
          message: "x-sample-rate must be a positive number.",
        }, { status: 400 });
      }

      try {
        const querySamples = new Float32Array(queryBytes);
        const analysis = analyzeQuerySamples(querySamples, sampleRate, ANALYSIS_CONFIG);

        if (analysis.landmarks.length === 0) {
          return jsonResponse({
            status: "no_confident_match",
            message: "The query clip did not produce enough spectral landmarks to match.",
            catalog: catalogSummary,
            query: {
              sampleRate: ANALYSIS_CONFIG.sampleRate,
              sampleCount: analysis.samples.length,
              peakCount: analysis.peaks.length,
              hashCount: analysis.landmarks.length,
            },
            candidates: [],
            topMatch: null,
            offsetHistogram: [],
          });
        }

        const matchResult = matchQueryLandmarks(repository, analysis.landmarks, ANALYSIS_CONFIG);

        return jsonResponse({
          ...matchResult,
          message: matchResult.status === "ok"
            ? `Matched ${matchResult.topMatch.title} by ${matchResult.topMatch.artist}.`
            : "No confident song match was found in the current catalog.",
          catalog: catalogSummary,
          query: {
            inputSampleRate: sampleRate,
            analysisSampleRate: ANALYSIS_CONFIG.sampleRate,
            sampleCount: analysis.samples.length,
            peakCount: analysis.peaks.length,
            hashCount: analysis.landmarks.length,
          },
        });
      } catch (error) {
        return jsonResponse({
          status: "error",
          message: error instanceof Error ? error.message : "Recognition failed unexpectedly.",
        }, { status: 500 });
      }
    }

    const filePath = resolveStaticPath(url.pathname);
    if (!filePath) {
      return new Response("Not found", { status: 404 });
    }

    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      return new Response("Not found", { status: 404 });
    }

    return new Response(file, {
      headers: {
        "content-type": mimeTypes[extname(filePath)] ?? file.type ?? "application/octet-stream",
        "cache-control": "no-store",
      },
    });
  },
});

console.log(`Frontend available at ${server.url}`);
