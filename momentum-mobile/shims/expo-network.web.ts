// WEB TEST SHIM — expo-network via browser online/offline events.
export async function getNetworkStateAsync(): Promise<{
  isConnected: boolean;
  isInternetReachable: boolean;
}> {
  const online = typeof navigator !== "undefined" ? navigator.onLine : true;
  return { isConnected: online, isInternetReachable: online };
}

export function addNetworkStateListener(
  cb: (state: { isConnected: boolean; isInternetReachable: boolean }) => void,
): { remove: () => void } {
  const on = () => cb({ isConnected: true, isInternetReachable: true });
  const off = () => cb({ isConnected: false, isInternetReachable: false });
  window.addEventListener("online", on);
  window.addEventListener("offline", off);
  return {
    remove: () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    },
  };
}
