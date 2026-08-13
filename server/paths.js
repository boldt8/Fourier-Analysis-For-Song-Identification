import { join } from "node:path";

export const PROJECT_ROOT = process.cwd();
export const DATA_DIRECTORY = join(PROJECT_ROOT, "data");
export const CATALOG_DIRECTORY = join(DATA_DIRECTORY, "catalog");
export const GENERATED_DIRECTORY = join(DATA_DIRECTORY, "generated");
export const CATALOG_MANIFEST_PATH = join(CATALOG_DIRECTORY, "manifest.json");
export const CATALOG_DATABASE_PATH = join(GENERATED_DIRECTORY, "fingerprints.sqlite");
