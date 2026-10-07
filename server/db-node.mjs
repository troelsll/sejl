import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setDb } from "./database.mjs";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const dataDir = process.env.DATA_DIR ?? join(rootDir, "data");
mkdirSync(dataDir, { recursive: true });
setDb(new DatabaseSync(join(dataDir, "kapsejlads.sqlite")));
