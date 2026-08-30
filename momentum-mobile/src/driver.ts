// Native (iOS/Android): the SQLite driver is synchronous — nothing to load.
export async function ensureDriverReady(): Promise<void> {
  /* no-op */
}
