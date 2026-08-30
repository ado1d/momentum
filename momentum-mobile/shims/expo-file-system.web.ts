// WEB TEST SHIM — expo-file-system: inert in-memory stubs.
const files = new Map<string, string>();

export const cacheDirectory = "/cache/";
export const documentDirectory = "/docs/";
export const EncodingType = { UTF8: "utf8", Base64: "base64" } as const;

export async function writeAsStringAsync(path: string, content: string): Promise<void> {
  files.set(path, content);
}
export async function readAsStringAsync(path: string): Promise<string> {
  return files.get(path) ?? "";
}
export async function deleteAsStringAsync(path: string): Promise<void> {
  files.delete(path);
}
export async function makeDirectoryAsync(): Promise<void> {
  /* no-op */
}
export function getDocumentDirectory(): string | null {
  return documentDirectory;
}
