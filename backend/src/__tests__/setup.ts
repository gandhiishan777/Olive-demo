import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Force a fresh test DB before any module imports the db singleton.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDbPath = path.resolve(__dirname, "../../data/olive.test.db");
try { fs.rmSync(testDbPath, { force: true }); } catch {}
try { fs.rmSync(`${testDbPath}-wal`, { force: true }); } catch {}
try { fs.rmSync(`${testDbPath}-shm`, { force: true }); } catch {}

process.env.DATABASE_URL = `file:${testDbPath}`;
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "error";
process.env.OLIVE_AGENT_TOKEN = process.env.OLIVE_AGENT_TOKEN ?? "test-token-must-be-16-chars-plus";
