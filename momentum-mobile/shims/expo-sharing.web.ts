// WEB TEST SHIM — expo-sharing stub.
export async function isAvailableAsync(): Promise<boolean> {
  return false;
}
export async function shareAsync(): Promise<void> {
  /* no-op */
}
