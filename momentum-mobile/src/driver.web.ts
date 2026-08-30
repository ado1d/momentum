// Web: sql.js (the test shim's SQLite engine) loads asynchronously — gate the
// first database access behind this promise. Native builds never see this file.
import { __webInit } from "../shims/expo-sqlite.web";

export async function ensureDriverReady(): Promise<void> {
  await __webInit();
}
