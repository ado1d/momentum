// WEB TEST SHIM — expo-document-picker stub.
export async function getDocumentAsync(): Promise<{ canceled: boolean; assets: never[] }> {
  return { canceled: true, assets: [] };
}
