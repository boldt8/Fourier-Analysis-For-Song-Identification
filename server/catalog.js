import { readdir, readFile, stat } from "node:fs/promises";
import { basename, extname, join, normalize } from "node:path";
import { CATALOG_DIRECTORY, CATALOG_MANIFEST_PATH } from "./paths.js";

const SUPPORTED_EXTENSIONS = new Set([
  ".aac",
  ".aif",
  ".aiff",
  ".flac",
  ".m4a",
  ".mp3",
  ".ogg",
  ".wav",
]);

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function inferTitle(fileName) {
  return basename(fileName, extname(fileName))
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "track";
}

function normalizeCatalogFilePath(fileName) {
  const normalizedRelativePath = normalize(fileName).replace(/^(\.\.(\/|\\|$))+/, "");
  const absolutePath = join(CATALOG_DIRECTORY, normalizedRelativePath);

  if (!absolutePath.startsWith(CATALOG_DIRECTORY)) {
    throw new Error(`Catalog file path escapes the catalog directory: ${fileName}`);
  }

  return {
    absolutePath,
    relativePath: normalizedRelativePath,
  };
}

function applyUniqueSlugs(entries) {
  const seenSlugs = new Map();

  return entries.map((entry) => {
    const baseSlug = entry.slug || slugify(`${entry.artist}-${entry.title}`);
    const occurrenceCount = (seenSlugs.get(baseSlug) ?? 0) + 1;
    seenSlugs.set(baseSlug, occurrenceCount);

    return {
      ...entry,
      slug: occurrenceCount === 1 ? baseSlug : `${baseSlug}-${occurrenceCount}`,
    };
  });
}

async function readManifestEntries() {
  if (!(await pathExists(CATALOG_MANIFEST_PATH))) {
    return null;
  }

  const manifestContents = await readFile(CATALOG_MANIFEST_PATH, "utf8");
  const parsedManifest = JSON.parse(manifestContents);
  const rawEntries = Array.isArray(parsedManifest) ? parsedManifest : parsedManifest.tracks;

  if (!Array.isArray(rawEntries)) {
    throw new Error("Catalog manifest must be an array or an object with a tracks array.");
  }

  return rawEntries.map((entry, index) => {
    if (!entry?.file) {
      throw new Error(`Manifest entry ${index + 1} is missing a file field.`);
    }

    const { absolutePath, relativePath } = normalizeCatalogFilePath(entry.file);
    const inferredTitle = inferTitle(entry.file);

    return {
      title: entry.title?.trim() || inferredTitle,
      artist: entry.artist?.trim() || "Unknown Artist",
      album: entry.album?.trim() || "",
      slug: entry.slug?.trim() || slugify(`${entry.artist ?? "unknown"}-${entry.title ?? inferredTitle}`),
      sourcePath: absolutePath,
      relativePath,
    };
  });
}

async function readDirectoryEntries() {
  if (!(await pathExists(CATALOG_DIRECTORY))) {
    return [];
  }

  const entries = await readdir(CATALOG_DIRECTORY, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && SUPPORTED_EXTENSIONS.has(extname(entry.name).toLowerCase()))
    .map((entry) => ({
      title: inferTitle(entry.name),
      artist: "Unknown Artist",
      album: "",
      slug: slugify(inferTitle(entry.name)),
      sourcePath: join(CATALOG_DIRECTORY, entry.name),
      relativePath: entry.name,
    }));
}

export async function resolveCatalogEntries() {
  const manifestEntries = await readManifestEntries();
  const catalogEntries = manifestEntries ?? await readDirectoryEntries();

  for (const entry of catalogEntries) {
    if (!(await pathExists(entry.sourcePath))) {
      throw new Error(`Catalog file does not exist: ${entry.relativePath}`);
    }
  }

  return applyUniqueSlugs(catalogEntries).sort(
    (left, right) => left.artist.localeCompare(right.artist) || left.title.localeCompare(right.title),
  );
}
